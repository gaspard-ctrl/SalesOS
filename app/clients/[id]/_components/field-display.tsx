"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil, Check, X } from "lucide-react";
import { COLORS } from "@/lib/design/tokens";
import type { ClientFieldSource, ClientFieldValue, FieldDefinition } from "@/lib/clients/types";

// ── Confidence dot ───────────────────────────────────────────────────────

function ConfidenceDot({ confidence, source }: { confidence: number; source: ClientFieldSource | null }) {
  let color: string = COLORS.err;
  let label = "Faible";
  if (confidence >= 0.7) {
    color = COLORS.ok;
    label = "Haute";
  } else if (confidence >= 0.4) {
    color = COLORS.warn;
    label = "Moyenne";
  }
  const sourceLabel = renderSourceLabel(source);
  return (
    <span
      title={`Confiance ${label} (${Math.round(confidence * 100)}%) — Source : ${sourceLabel}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 10,
        color: COLORS.ink3,
        flexShrink: 0,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
      <span>{Math.round(confidence * 100)}%</span>
    </span>
  );
}

function renderSourceLabel(source: ClientFieldSource | null): string {
  if (!source) return "—";
  if (source.kind === "manual") return `Édition manuelle${source.userEmail ? ` · ${source.userEmail}` : ""}`;
  if (source.kind === "inferred") return "Inféré";
  if (source.kind === "claap") return `Claap${source.recordingId ? ` · ${source.recordingId}` : ""}`;
  if (source.kind === "hubspot") {
    const entity = source.entity ?? "?";
    return `HubSpot · ${entity}${source.id ? ` · ${source.id}` : ""}`;
  }
  return "—";
}

function MissingValue() {
  return <span style={{ color: COLORS.ink4, fontStyle: "italic", fontSize: 13 }}>Non renseigné</span>;
}

// ── Read-only rendering ──────────────────────────────────────────────────

function renderValue(value: unknown, kind: FieldDefinition["kind"]): React.ReactNode {
  if (value === null || value === undefined) return <MissingValue />;
  if (Array.isArray(value) && value.length === 0) return <MissingValue />;
  if (typeof value === "string" && !value.trim()) return <MissingValue />;

  switch (kind) {
    case "text":
    case "long_text":
      return <span style={{ fontSize: 13, color: COLORS.ink0, whiteSpace: "pre-wrap" }}>{String(value)}</span>;
    case "number":
      return <span style={{ fontSize: 13, color: COLORS.ink0, fontVariantNumeric: "tabular-nums" }}>{String(value)}</span>;
    case "date": {
      try {
        const d = new Date(String(value));
        if (Number.isNaN(d.getTime())) return <span style={{ fontSize: 13, color: COLORS.ink0 }}>{String(value)}</span>;
        return (
          <span style={{ fontSize: 13, color: COLORS.ink0 }}>
            {d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
          </span>
        );
      } catch {
        return <span style={{ fontSize: 13, color: COLORS.ink0 }}>{String(value)}</span>;
      }
    }
    case "enum":
      return (
        <span
          style={{
            display: "inline-flex",
            padding: "2px 8px",
            borderRadius: 999,
            background: COLORS.brandTint,
            color: COLORS.brand,
            fontSize: 12,
            fontWeight: 600,
            textTransform: "capitalize",
          }}
        >
          {String(value)}
        </span>
      );
    case "array_string": {
      const arr = value as string[];
      return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {arr.map((s, i) => (
            <span
              key={i}
              style={{
                padding: "2px 8px",
                borderRadius: 999,
                background: COLORS.bgSoft,
                color: COLORS.ink1,
                fontSize: 12,
                border: `1px solid ${COLORS.line}`,
              }}
            >
              {s}
            </span>
          ))}
        </div>
      );
    }
    case "array_contact": {
      const arr = value as Array<{ name: string; email?: string; role?: string }>;
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {arr.map((c, i) => (
            <div key={i} style={{ fontSize: 13, color: COLORS.ink0 }}>
              {c.name}
              {c.role ? <span style={{ color: COLORS.ink3 }}> — {c.role}</span> : null}
              {c.email ? <span style={{ color: COLORS.ink3 }}> · {c.email}</span> : null}
            </div>
          ))}
        </div>
      );
    }
    case "contact": {
      const c = value as { name: string; email?: string; role?: string };
      return (
        <div style={{ fontSize: 13, color: COLORS.ink0 }}>
          {c.name}
          {c.role ? <span style={{ color: COLORS.ink3 }}> — {c.role}</span> : null}
          {c.email ? <span style={{ color: COLORS.ink3 }}> · {c.email}</span> : null}
        </div>
      );
    }
    case "array_doc": {
      const arr = value as Array<{ title: string; url?: string }>;
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {arr.map((d, i) => (
            <div key={i} style={{ fontSize: 13, color: COLORS.ink0 }}>
              {d.url ? (
                <a href={d.url} target="_blank" rel="noreferrer" style={{ color: COLORS.brand }}>
                  {d.title}
                </a>
              ) : (
                d.title
              )}
            </div>
          ))}
        </div>
      );
    }
    case "bool_with_details": {
      const b = value as { enabled: boolean; details?: string };
      return (
        <div style={{ fontSize: 13, color: COLORS.ink0 }}>
          <span
            style={{
              display: "inline-block",
              padding: "1px 8px",
              borderRadius: 999,
              fontWeight: 600,
              fontSize: 11,
              background: b.enabled ? COLORS.okBg : COLORS.bgSoft,
              color: b.enabled ? COLORS.ok : COLORS.ink3,
            }}
          >
            {b.enabled ? "Activé" : "Non"}
          </span>
          {b.details && <span style={{ marginLeft: 8, color: COLORS.ink1 }}>{b.details}</span>}
        </div>
      );
    }
    default:
      return <span style={{ fontSize: 13, color: COLORS.ink0 }}>{JSON.stringify(value)}</span>;
  }
}

// ── Edit input ───────────────────────────────────────────────────────────
// Supporte les kinds "simples" : text, long_text, number, date, array_string,
// enum, bool_with_details. Les objets complexes (contact, array_contact,
// array_doc) restent en lecture seule pour cette itération — on les éditera
// plus tard avec un sous-modal dédié.

const EDITABLE_KINDS = new Set<FieldDefinition["kind"]>([
  "text", "long_text", "number", "date", "array_string", "enum", "bool_with_details",
]);

function FieldEditor({
  definition,
  initial,
  onSave,
  onCancel,
}: {
  definition: FieldDefinition;
  initial: unknown;
  onSave: (value: unknown) => Promise<void>;
  onCancel: () => void;
}) {
  // Cast unifié : on garde tout en string pendant l'édition et on convertit au save
  const initialString = (() => {
    if (initial === null || initial === undefined) return "";
    if (Array.isArray(initial)) return (initial as string[]).join(", ");
    if (typeof initial === "object") return JSON.stringify(initial);
    return String(initial);
  })();

  const [val, setVal] = useState<string>(initialString);
  const [enabled, setEnabled] = useState<boolean>(
    definition.kind === "bool_with_details" && initial && typeof initial === "object" && "enabled" in initial
      ? (initial as { enabled: boolean }).enabled
      : false,
  );
  const [details, setDetails] = useState<string>(
    definition.kind === "bool_with_details" && initial && typeof initial === "object" && "details" in initial
      ? String((initial as { details?: string }).details ?? "")
      : "",
  );
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (inputRef.current && "select" in inputRef.current) {
      try {
        (inputRef.current as HTMLInputElement).select();
      } catch {
        // selecting fails on some input types — ignore
      }
    }
  }, []);

  async function commit() {
    setSaving(true);
    try {
      let parsed: unknown;
      const trimmed = val.trim();
      switch (definition.kind) {
        case "text":
        case "long_text":
          parsed = trimmed ? trimmed : null;
          break;
        case "number":
          parsed = trimmed ? Number(trimmed) : null;
          if (parsed !== null && Number.isNaN(parsed as number)) parsed = null;
          break;
        case "date":
          parsed = trimmed || null;
          break;
        case "array_string":
          parsed = trimmed
            ? trimmed.split(",").map((s) => s.trim()).filter(Boolean)
            : null;
          break;
        case "enum":
          parsed = trimmed || null;
          break;
        case "bool_with_details":
          parsed = { enabled, details: details.trim() || undefined };
          break;
        default:
          parsed = trimmed || null;
      }
      await onSave(parsed);
    } finally {
      setSaving(false);
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (definition.kind !== "long_text" || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }

  const inputStyle: React.CSSProperties = {
    fontSize: 13,
    padding: "4px 8px",
    borderRadius: 6,
    border: `1px solid ${COLORS.brand}`,
    outline: "none",
    background: "white",
    color: COLORS.ink0,
    fontFamily: "inherit",
    width: "100%",
    boxSizing: "border-box",
  };

  function renderInput() {
    if (definition.kind === "long_text") {
      return (
        <textarea
          ref={(el) => {
            inputRef.current = el;
          }}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={onKey}
          disabled={saving}
          rows={3}
          style={{ ...inputStyle, resize: "vertical", minHeight: 60 }}
          placeholder="Cmd/Ctrl+Enter pour valider, Esc pour annuler"
        />
      );
    }
    if (definition.kind === "enum") {
      const options = definition.options ?? [];
      return (
        <select
          ref={(el) => {
            inputRef.current = el;
          }}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={onKey}
          disabled={saving}
          style={inputStyle}
        >
          <option value="">— vide —</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }
    if (definition.kind === "bool_with_details") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: COLORS.ink0 }}>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} disabled={saving} />
            Activé
          </label>
          <input
            ref={(el) => {
              inputRef.current = el;
            }}
            type="text"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            onKeyDown={onKey}
            disabled={saving}
            placeholder="Détails (optionnel)"
            style={inputStyle}
          />
        </div>
      );
    }
    return (
      <input
        ref={(el) => {
          inputRef.current = el;
        }}
        type={definition.kind === "number" ? "number" : definition.kind === "date" ? "date" : "text"}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={onKey}
        disabled={saving}
        placeholder={definition.kind === "array_string" ? "valeurs séparées par des virgules" : undefined}
        style={inputStyle}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {renderInput()}
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={commit}
          disabled={saving}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            padding: "3px 8px",
            borderRadius: 6,
            border: `1px solid ${COLORS.brand}`,
            background: COLORS.brand,
            color: "white",
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          <Check size={11} /> Enregistrer
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            padding: "3px 8px",
            borderRadius: 6,
            border: `1px solid ${COLORS.line}`,
            background: "white",
            color: COLORS.ink2,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          <X size={11} /> Annuler
        </button>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────

export function FieldDisplay({
  definition,
  field,
  clientId,
  sectionKey,
  onUpdated,
}: {
  definition: FieldDefinition;
  field: ClientFieldValue | undefined;
  clientId?: string;
  sectionKey?: string;
  onUpdated?: () => void;
}) {
  const value = field?.value;
  const confidence = field?.confidence ?? 0;
  const source = field?.source ?? null;
  const hasValue = value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0);

  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canEdit = !!clientId && !!sectionKey && EDITABLE_KINDS.has(definition.kind);

  async function save(newValue: unknown) {
    if (!clientId || !sectionKey) return;
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/fields`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionKey, fieldKey: definition.key, value: newValue }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setEditing(false);
      onUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "200px 1fr auto",
        gap: 16,
        padding: "10px 0",
        borderBottom: `1px solid ${COLORS.line}`,
        alignItems: "flex-start",
      }}
      onDoubleClick={() => {
        if (canEdit && !editing) setEditing(true);
      }}
    >
      <div style={{ fontSize: 12, color: COLORS.ink2, fontWeight: 500, paddingTop: 2 }}>
        {definition.label}
      </div>
      <div style={{ minWidth: 0 }}>
        {editing ? (
          <FieldEditor
            definition={definition}
            initial={value}
            onSave={save}
            onCancel={() => {
              setEditing(false);
              setError(null);
            }}
          />
        ) : (
          renderValue(value, definition.kind)
        )}
        {error && (
          <div style={{ fontSize: 11, color: COLORS.err, marginTop: 4 }}>{error}</div>
        )}
      </div>
      <div style={{ paddingTop: 3, display: "flex", alignItems: "center", gap: 8 }}>
        {hasValue && !editing ? <ConfidenceDot confidence={confidence} source={source} /> : null}
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Éditer (ou double-clic sur la ligne)"
            style={{
              background: "none",
              border: "none",
              padding: 2,
              cursor: "pointer",
              color: COLORS.ink4,
              opacity: 0.6,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "1";
              e.currentTarget.style.color = COLORS.brand;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "0.6";
              e.currentTarget.style.color = COLORS.ink4;
            }}
          >
            <Pencil size={11} />
          </button>
        )}
      </div>
    </div>
  );
}
