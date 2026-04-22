"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X, ExternalLink, RefreshCw, Inbox, Loader2, Undo2 } from "lucide-react";
import { useLeads, type LeadsStatusFilter } from "@/lib/hooks/use-marketing";
import type { Lead, LeadFile, LeadValidationStatus } from "@/lib/marketing-types";
import { SlackText } from "@/lib/slack-mrkdwn";

const ACCENT = "#f01563";
const GREEN = "#10b981";
const RED = "#ef4444";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isImage(file: LeadFile): boolean {
  return file.mimetype.startsWith("image/");
}

function fileProxyUrl(leadId: string, fileId: string, variant: "thumb" | "full" = "full"): string {
  return `/api/marketing/leads/file?leadId=${encodeURIComponent(leadId)}&fileId=${encodeURIComponent(fileId)}&variant=${variant}`;
}

function StatusBadge({ status }: { status: LeadValidationStatus }) {
  if (status === "pending") return null;
  const validated = status === "validated";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 10,
        color: "#fff",
        background: validated ? GREEN : RED,
      }}
    >
      {validated ? <Check size={11} /> : <X size={11} />}
      {validated ? "Validé" : "Rejeté"}
    </span>
  );
}

function FilterButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="text-sm px-3 py-1.5 font-medium transition-colors"
      style={{
        background: active ? ACCENT : "#fff",
        color: active ? "#fff" : "#555",
        border: `1px solid ${active ? ACCENT : "#e5e5e5"}`,
        borderRadius: 6,
      }}
    >
      {label}
      {typeof count === "number" ? ` (${count})` : ""}
    </button>
  );
}

function LeadCard({
  lead,
  onValidate,
  onOpenImage,
  busy,
}: {
  lead: Lead;
  onValidate: (status: LeadValidationStatus) => void;
  onOpenImage: (url: string) => void;
  busy: boolean;
}) {
  const imageFiles = lead.files.filter(isImage);
  const otherFiles = lead.files.filter((f) => !isImage(f));

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #eee",
        borderRadius: 8,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>
          {lead.author_name ?? "(auteur inconnu)"}
        </div>
        <div style={{ fontSize: 12, color: "#888" }}>{formatDate(lead.posted_at)}</div>
        {lead.slack_permalink && (
          <a
            href={lead.slack_permalink}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 12,
              color: "#555",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              textDecoration: "none",
            }}
          >
            <ExternalLink size={12} /> Slack
          </a>
        )}
        <div style={{ marginLeft: "auto" }}>
          <StatusBadge status={lead.validation_status} />
        </div>
      </div>

      {/* Text */}
      {lead.text && (
        <div style={{ fontSize: 14, color: "#222", lineHeight: 1.5, wordBreak: "break-word" }}>
          <SlackText text={lead.text} />
        </div>
      )}

      {/* Image grid */}
      {imageFiles.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {imageFiles.map((f) => {
            const thumbUrl = fileProxyUrl(lead.id, f.id, "thumb");
            const fullUrl = fileProxyUrl(lead.id, f.id, "full");
            return (
              <button
                key={f.id}
                onClick={() => onOpenImage(fullUrl)}
                style={{
                  width: 140,
                  height: 140,
                  border: "1px solid #eee",
                  borderRadius: 6,
                  overflow: "hidden",
                  padding: 0,
                  cursor: "pointer",
                  background: "#f4f4f4",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbUrl}
                  alt={f.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </button>
            );
          })}
        </div>
      )}

      {/* Other files (non-image) */}
      {otherFiles.length > 0 && (
        <div style={{ fontSize: 12, color: "#666" }}>
          {otherFiles.map((f) => (
            <div key={f.id}>📎 {f.name || f.id}</div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid #f4f4f4", paddingTop: 12 }}>
        {lead.validation_status === "pending" ? (
          <>
            <button
              onClick={() => onValidate("rejected")}
              disabled={busy}
              className="text-sm px-3 py-1.5 font-medium transition-colors"
              style={{
                background: "#fff",
                color: RED,
                border: `1px solid ${RED}`,
                borderRadius: 6,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: busy ? "wait" : "pointer",
                opacity: busy ? 0.6 : 1,
              }}
            >
              <X size={14} /> Rejeter
            </button>
            <button
              onClick={() => onValidate("validated")}
              disabled={busy}
              className="text-sm px-3 py-1.5 font-medium transition-colors"
              style={{
                background: GREEN,
                color: "#fff",
                border: `1px solid ${GREEN}`,
                borderRadius: 6,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: busy ? "wait" : "pointer",
                opacity: busy ? 0.6 : 1,
              }}
            >
              <Check size={14} /> Valider
            </button>
          </>
        ) : (
          <button
            onClick={() => onValidate("pending")}
            disabled={busy}
            className="text-sm px-3 py-1.5 font-medium transition-colors"
            style={{
              background: "#fff",
              color: "#555",
              border: "1px solid #e5e5e5",
              borderRadius: 6,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              cursor: busy ? "wait" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Undo2 size={14} /> Remettre en attente
          </button>
        )}
      </div>
    </div>
  );
}

export default function LeadsTab() {
  const [filter, setFilter] = useState<LeadsStatusFilter>("pending");
  const { leads, counts, isLoading, validateLead, syncLeads } = useLeads(filter);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const autoSyncDone = useRef(false);

  const runSync = async (silent = false) => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const { inserted } = await syncLeads();
      if (!silent) {
        setSyncMessage(
          inserted > 0 ? `${inserted} nouveau${inserted > 1 ? "x" : ""} lead${inserted > 1 ? "s" : ""}` : "Aucun nouveau lead",
        );
      }
    } catch (e) {
      setSyncMessage(`Erreur sync : ${e instanceof Error ? e.message : "inconnue"}`);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (autoSyncDone.current) return;
    autoSyncDone.current = true;
    void runSync(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleValidate = async (lead: Lead, status: LeadValidationStatus) => {
    setBusyId(lead.id);
    try {
      await validateLead(lead.id, status);
    } catch (e) {
      setSyncMessage(`Erreur : ${e instanceof Error ? e.message : "inconnue"}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <FilterButton
          active={filter === "pending"}
          onClick={() => setFilter("pending")}
          label="À valider"
          count={counts.pending}
        />
        <FilterButton
          active={filter === "validated"}
          onClick={() => setFilter("validated")}
          label="Validés"
          count={counts.validated}
        />
        <FilterButton
          active={filter === "rejected"}
          onClick={() => setFilter("rejected")}
          label="Rejetés"
          count={counts.rejected}
        />
        <FilterButton active={filter === "all"} onClick={() => setFilter("all")} label="Tous" />

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          {syncMessage && <div style={{ fontSize: 12, color: "#888" }}>{syncMessage}</div>}
          <button
            onClick={() => runSync(false)}
            disabled={syncing}
            className="text-sm px-3 py-1.5 font-medium transition-colors"
            style={{
              background: "#fff",
              color: "#555",
              border: "1px solid #e5e5e5",
              borderRadius: 6,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              cursor: syncing ? "wait" : "pointer",
            }}
          >
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Sync Slack
          </button>
        </div>
      </div>

      {/* List */}
      {isLoading && leads.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40, color: "#888" }}>
          <Loader2 size={16} className="animate-spin" style={{ marginRight: 8 }} /> Chargement…
        </div>
      ) : leads.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            padding: 40,
            background: "#fff",
            border: "1px solid #eee",
            borderRadius: 8,
            color: "#888",
          }}
        >
          <Inbox size={32} />
          <div style={{ fontSize: 14 }}>Aucun lead dans cette catégorie</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onValidate={(s) => handleValidate(lead, s)}
              onOpenImage={setLightboxUrl}
              busy={busyId === lead.id}
            />
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            cursor: "zoom-out",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="preview"
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
        </div>
      )}
    </div>
  );
}
