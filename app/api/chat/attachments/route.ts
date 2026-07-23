import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  classifyAttachment,
  capExtractedText,
  MAX_ATTACHMENT_BYTES,
  type AttachmentKind,
} from "@/lib/chat/attachments";

export const dynamic = "force-dynamic";

/**
 * Upload d'une pièce jointe pour le chat (cahier des charges, RFP, brief...).
 * Body JSON : { filename, mime, base64 }. Le contenu est extrait/stocké dans
 * chat_attachments ; le front référence ensuite les IDs dans POST /api/chat.
 *
 * Formats : PDF et images -> servis nativement au modèle (base64) ;
 * xlsx/xls -> CSV texte ; docx -> texte (mammoth) ; csv/txt/md/json -> texte.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { filename?: string; mime?: string; base64?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const filename = (body.filename ?? "").trim();
  const mime = (body.mime ?? "application/octet-stream").trim();
  const base64 = body.base64 ?? "";
  if (!filename) {
    return NextResponse.json({ error: "filename requis" }, { status: 400 });
  }
  if (!base64) {
    return NextResponse.json({ error: `"${filename}" est vide (0 octet).` }, { status: 422 });
  }

  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength === 0) {
    return NextResponse.json({ error: `"${filename}" est vide ou illisible.` }, { status: 422 });
  }
  if (buffer.byteLength > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json(
      { error: `Fichier trop volumineux (max ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)} Mo).` },
      { status: 413 }
    );
  }

  const kind = classifyAttachment(filename, mime);
  if (!kind) {
    return NextResponse.json(
      { error: `Format non supporté (${filename}). Formats acceptés : PDF, images, xlsx, docx, csv, txt, md.` },
      { status: 415 }
    );
  }

  let textContent: string | null = null;
  let storedBase64: string | null = null;

  try {
    if (kind === "pdf" || kind === "image") {
      // Un PDF corrompu ferait échouer TOUT l'appel de chat (400 Anthropic sur
      // le bloc document) : on valide le magic number ici, à l'upload.
      if (kind === "pdf" && !buffer.subarray(0, 5).toString("latin1").startsWith("%PDF")) {
        return NextResponse.json(
          { error: `"${filename}" n'est pas un PDF valide.` },
          { status: 422 }
        );
      }
      storedBase64 = base64;
    } else {
      const ext = filename.toLowerCase().split(".").pop() ?? "";
      if (ext === "xlsx" || ext === "xls") {
        const wb = XLSX.read(buffer, { type: "buffer" });
        const parts = wb.SheetNames.map((name) => {
          const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name], { strip: true });
          return `### Onglet : ${name}\n${csv}`;
        });
        textContent = capExtractedText(parts.join("\n\n"));
      } else if (ext === "docx") {
        const result = await mammoth.extractRawText({ buffer });
        textContent = capExtractedText(result.value);
      } else {
        textContent = capExtractedText(buffer.toString("utf-8"));
      }
    }
  } catch (e) {
    return NextResponse.json(
      { error: `Impossible de lire "${filename}" : ${e instanceof Error ? e.message : "erreur inconnue"}` },
      { status: 422 }
    );
  }

  const { data, error } = await db
    .from("chat_attachments")
    .insert({
      user_id: user.id,
      filename,
      mime,
      size_bytes: buffer.byteLength,
      kind: kind as AttachmentKind,
      text_content: textContent,
      base64: storedBase64,
    })
    .select("id, filename, kind, size_bytes")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  return NextResponse.json({ attachment: data }, { status: 201 });
}
