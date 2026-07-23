/**
 * Pièces jointes du chat (cahiers des charges, RFP, briefs...).
 *
 * Upload : POST /api/chat/attachments extrait/stocke le contenu dans la table
 * chat_attachments (texte extrait pour xlsx/docx/csv/txt/md, base64 pour
 * pdf/image). Envoi : POST /api/chat expand les IDs en blocs de contenu
 * Anthropic natifs (document PDF, image, texte), attachés AVANT le texte du
 * message user (recommandation Anthropic : documents d'abord).
 *
 * Le contenu expandé vit ensuite dans l'historique (chat_jobs.history puis
 * conversation_messages.api_history) : les tours suivants relisent le document
 * sans re-fetch, et le prompt caching absorbe le coût.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

// Netlify limite le payload des fonctions sync à ~6 Mo : on cape le fichier à
// 4 Mo (≈5,5 Mo en base64) pour garder de la marge.
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_MESSAGE = 3;
const MAX_EXTRACTED_CHARS = 60_000;

export type AttachmentKind = "pdf" | "image" | "text";

export type AttachmentRow = {
  id: string;
  user_id: string;
  filename: string;
  mime: string;
  size_bytes: number;
  kind: AttachmentKind;
  text_content: string | null;
  base64: string | null;
};

export type AttachmentMeta = { id: string; filename: string; kind: AttachmentKind; size_bytes: number };

const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

/** Décide comment un fichier sera servi au modèle, d'après son mime/extension. */
export function classifyAttachment(filename: string, mime: string): AttachmentKind | null {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (IMAGE_MIMES.has(mime)) return "image";
  if (
    ext === "xlsx" || ext === "xls" || ext === "docx" ||
    ext === "csv" || ext === "txt" || ext === "md" || ext === "json" ||
    mime.startsWith("text/")
  ) return "text";
  return null;
}

/** Tronque le texte extrait avec une note explicite (jamais de coupe silencieuse). */
export function capExtractedText(text: string): string {
  if (text.length <= MAX_EXTRACTED_CHARS) return text;
  return text.slice(0, MAX_EXTRACTED_CHARS) + `\n…(document tronqué à ${MAX_EXTRACTED_CHARS} caractères)`;
}

/**
 * Marqueur léger placé AVANT chaque bloc lourd (PDF/image base64) dans le
 * message user. L'historique persisté/rejoué ne garde QUE le marqueur (le
 * base64 est strippé par stripAttachmentPayloads, sinon le JSON du polling et
 * du POST au tour suivant dépasserait la limite ~6 Mo des fonctions Netlify) ;
 * le serveur ré-expand le marqueur en bloc réel à chaque tour
 * (reexpandAttachmentMarkers dans POST /api/chat).
 */
const MARKER_RE = /^\[\[piece-jointe id=([0-9a-f-]{36}) nom="(.*)"\]\]$/;

function attachmentMarker(row: { id: string; filename: string }): Anthropic.ContentBlockParam {
  return { type: "text", text: `[[piece-jointe id=${row.id} nom="${row.filename.replace(/"/g, "'")}"]]` };
}

function heavyBlockForAttachment(row: AttachmentRow): Anthropic.ContentBlockParam | null {
  if (row.kind === "pdf" && row.base64) {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: row.base64 },
      title: row.filename,
    };
  }
  if (row.kind === "image" && row.base64) {
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: row.mime as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
        data: row.base64,
      },
    };
  }
  return null;
}

function blocksForAttachment(row: AttachmentRow): Anthropic.ContentBlockParam[] {
  const heavy = heavyBlockForAttachment(row);
  if (heavy) return [attachmentMarker(row), heavy];
  return [{
    type: "text",
    text: `[Document joint par l'utilisateur : "${row.filename}"]\n\n${row.text_content ?? "(contenu vide)"}\n\n[Fin du document "${row.filename}"]`,
  }];
}

/**
 * Retire les payloads lourds (document/image base64) des messages, en gardant
 * les marqueurs. Appliqué à l'historique AVANT persistance/émission : les
 * surfaces et la DB ne voient jamais le base64, seul le contexte du modèle
 * pendant la boucle le porte.
 */
export function stripAttachmentPayloads(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  return messages.map((msg) => {
    if (msg.role !== "user" || !Array.isArray(msg.content)) return msg;
    const blocks = msg.content as Anthropic.ContentBlockParam[];
    if (!blocks.some((b) => b.type === "document" || b.type === "image")) return msg;
    return { ...msg, content: blocks.filter((b) => b.type !== "document" && b.type !== "image") };
  });
}

/**
 * Ré-expand les marqueurs de pièces jointes d'un historique rejoué en blocs
 * réels (fetch DB par IDs, vérifiés comme appartenant au user). Idempotent :
 * un marqueur déjà suivi de son bloc n'est pas re-expandé.
 */
export async function reexpandAttachmentMarkers(
  userId: string,
  messages: Anthropic.MessageParam[]
): Promise<Anthropic.MessageParam[]> {
  // Collecte des IDs de marqueurs sans bloc lourd juste après.
  const missingIds = new Set<string>();
  for (const msg of messages) {
    if (msg.role !== "user" || !Array.isArray(msg.content)) continue;
    const blocks = msg.content as Anthropic.ContentBlockParam[];
    blocks.forEach((b, i) => {
      if (b.type !== "text") return;
      const m = b.text.match(MARKER_RE);
      if (!m) return;
      const next = blocks[i + 1];
      if (!next || (next.type !== "document" && next.type !== "image")) missingIds.add(m[1]);
    });
  }
  if (missingIds.size === 0) return messages;

  const { data } = await db
    .from("chat_attachments")
    .select("id, user_id, filename, mime, size_bytes, kind, text_content, base64")
    .in("id", [...missingIds])
    .eq("user_id", userId);
  const byId = new Map(((data ?? []) as AttachmentRow[]).map((r) => [r.id, r]));

  return messages.map((msg) => {
    if (msg.role !== "user" || !Array.isArray(msg.content)) return msg;
    const blocks = msg.content as Anthropic.ContentBlockParam[];
    const rebuilt: Anthropic.ContentBlockParam[] = [];
    blocks.forEach((b, i) => {
      rebuilt.push(b);
      if (b.type !== "text") return;
      const m = b.text.match(MARKER_RE);
      if (!m) return;
      const next = blocks[i + 1];
      if (next && (next.type === "document" || next.type === "image")) return;
      const row = byId.get(m[1]);
      const heavy = row ? heavyBlockForAttachment(row) : null;
      if (heavy) rebuilt.push(heavy);
    });
    return rebuilt.length === blocks.length ? msg : { ...msg, content: rebuilt };
  });
}

/**
 * Attache les pièces jointes (par IDs, vérifiées comme appartenant au user) au
 * DERNIER message user de la conversation. Renvoie les messages modifiés.
 */
export async function expandMessagesWithAttachments(
  userId: string,
  attachmentIds: string[],
  messages: Anthropic.MessageParam[]
): Promise<Anthropic.MessageParam[]> {
  const requested = attachmentIds.filter(Boolean);
  const ids = requested.slice(0, MAX_ATTACHMENTS_PER_MESSAGE);
  // Jamais de drop silencieux : si le front a laissé passer plus de 3 fichiers,
  // le modèle (et donc l'utilisateur) est prévenu de ceux qui manquent.
  const droppedCount = requested.length - ids.length;
  if (ids.length === 0 || messages.length === 0) return messages;

  const { data } = await db
    .from("chat_attachments")
    .select("id, user_id, filename, mime, size_bytes, kind, text_content, base64")
    .in("id", ids)
    .eq("user_id", userId);
  const rows = (data ?? []) as AttachmentRow[];
  if (rows.length === 0) return messages;

  // Respecte l'ordre demandé par le front.
  const ordered = ids
    .map((id) => rows.find((r) => r.id === id))
    .filter((r): r is AttachmentRow => !!r);

  const lastUserIdx = messages.map((m) => m.role).lastIndexOf("user");
  if (lastUserIdx < 0) return messages;

  const attachmentBlocks = ordered.flatMap(blocksForAttachment);
  if (droppedCount > 0) {
    attachmentBlocks.push({
      type: "text",
      text: `[Note : ${droppedCount} document(s) supplémentaire(s) n'ont PAS pu être joints (maximum ${MAX_ATTACHMENTS_PER_MESSAGE} par message). Signale-le à l'utilisateur.]`,
    });
  }
  const target = messages[lastUserIdx];
  const existing: Anthropic.ContentBlockParam[] = typeof target.content === "string"
    ? [{ type: "text", text: target.content }]
    : (target.content as Anthropic.ContentBlockParam[]);

  const updated: Anthropic.MessageParam = {
    role: "user",
    content: [...attachmentBlocks, ...existing],
  };
  return [...messages.slice(0, lastUserIdx), updated, ...messages.slice(lastUserIdx + 1)];
}
