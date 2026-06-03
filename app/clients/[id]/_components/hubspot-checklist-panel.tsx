"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Sparkles, RefreshCw, Copy, Check, CheckCircle2 } from "lucide-react";
import { COLORS } from "@/lib/design/tokens";
import {
  HUBSPOT_CHECKLIST_FIELDS,
  getMissingHubspotFields,
  isHubspotFieldEmpty,
  type ClientRow,
  type HubspotChecklistFieldDef,
} from "@/lib/clients/types";

const GROUP_LABELS: Record<HubspotChecklistFieldDef["group"], string> = {
  qualification: "Qualification",
  deal_info: "Deal information",
  general_info: "General information",
  contract_billing: "Contract & billing",
};

// "HubSpot checklist" card (left column). Lists the deal qualification / info
// fields still empty in HubSpot, each with an AI fill suggestion. Validating
// writes to HubSpot. Filled fields collapse at the bottom. The card disappears
// once nothing is missing.
export function HubspotChecklistPanel({ client, onUpdated }: { client: ClientRow; onUpdated: () => void }) {
  const dealFields = client.hubspot_deal_fields ?? null;
  const suggestions = client.hubspot_field_suggestions ?? null;

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missing = getMissingHubspotFields(dealFields);
  const filled = HUBSPOT_CHECKLIST_FIELDS.filter((f) => !isHubspotFieldEmpty(dealFields?.[f.property]));

  // No HubSpot values read (HubSpot down): hide the card rather than mislead.
  if (!dealFields) return null;
  if (missing.length === 0) return null;

  const suggestionByProp = new Map((suggestions?.fields ?? []).map((s) => [s.property, s]));

  // Group missing fields by their HubSpot card group, preserving config order.
  const groups: Array<{ key: HubspotChecklistFieldDef["group"]; fields: HubspotChecklistFieldDef[] }> = [];
  for (const f of missing) {
    let g = groups.find((x) => x.key === f.group);
    if (!g) {
      g = { key: f.group, fields: [] };
      groups.push(g);
    }
    g.fields.push(f);
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${client.id}/hubspot-suggestions`, { method: "POST" });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `HTTP ${res.status}`);
      }
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 12, overflow: "hidden" }}>
      <div
        style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${COLORS.line}`,
          background: COLORS.warnBg,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <AlertTriangle size={15} style={{ color: COLORS.warn, flexShrink: 0 }} />
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: COLORS.warn }}>
          HubSpot checklist · {missing.length} missing field{missing.length > 1 ? "s" : ""}
        </h3>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={generating}
          title={suggestions ? "Regenerate suggestions" : "Generate fill suggestions"}
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 12,
            fontWeight: 600,
            padding: "5px 10px",
            borderRadius: 8,
            border: `1px solid ${COLORS.warn}`,
            background: "transparent",
            color: COLORS.warn,
            cursor: generating ? "not-allowed" : "pointer",
          }}
        >
          {generating ? (
            <Loader2 size={13} className="animate-spin" />
          ) : suggestions ? (
            <RefreshCw size={13} />
          ) : (
            <Sparkles size={13} />
          )}
          {suggestions ? "Refresh" : "Analyze"}
        </button>
      </div>

      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
        {error && <div style={{ fontSize: 12, color: COLORS.err }}>{error}</div>}

        {!suggestions && (
          <div style={{ fontSize: 12, color: COLORS.ink2, lineHeight: 1.5 }}>
            Run the analysis to suggest a fill value for each missing field, based on the enriched account data.
          </div>
        )}

        {groups.map((g) => (
          <div key={g.key} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.ink3, textTransform: "uppercase", letterSpacing: 0.4 }}>
              {GROUP_LABELS[g.key]}
            </div>
            {g.fields.map((f) => (
              <FieldRow
                key={f.property}
                clientId={client.id}
                def={f}
                suggestion={suggestionByProp.get(f.property)?.suggestion ?? ""}
                rationale={suggestionByProp.get(f.property)?.rationale ?? ""}
                onSaved={onUpdated}
              />
            ))}
          </div>
        ))}

        {filled.length > 0 && (
          <div style={{ marginTop: 2, paddingTop: 10, borderTop: `1px dashed ${COLORS.line}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.ink3, marginBottom: 6 }}>Filled in</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {filled.map((f) => (
                <span
                  key={f.property}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                    color: COLORS.ink3,
                    background: COLORS.bgSoft,
                    border: `1px solid ${COLORS.line}`,
                    borderRadius: 999,
                    padding: "2px 8px",
                  }}
                >
                  <CheckCircle2 size={11} style={{ color: COLORS.ok }} />
                  {f.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldRow({
  clientId,
  def,
  suggestion,
  rationale,
  onSaved,
}: {
  clientId: string;
  def: HubspotChecklistFieldDef;
  suggestion: string;
  rationale: string;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(suggestion);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Resync when the AI suggestion arrives after mount (unless the user typed).
  useEffect(() => {
    if (!touched && suggestion) setValue(suggestion);
  }, [suggestion, touched]);

  // Human-readable value for the confirmation popup (enum -> option label).
  const displayValue =
    def.type === "enumeration" ? def.options?.find((o) => o.value === value)?.label ?? value : value;

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  }

  async function save() {
    if (!value.trim()) {
      setError("Empty value");
      return;
    }
    setConfirmOpen(false);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/hubspot-field`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property: def.property, value }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `HTTP ${res.status}`);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setSaving(false);
    }
  }

  function askConfirm() {
    if (!value.trim()) {
      setError("Empty value");
      return;
    }
    setError(null);
    setConfirmOpen(true);
  }

  function onChange(v: string) {
    setTouched(true);
    setValue(v);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.ink0 }}>{def.label}</span>
        {rationale && (
          <span title={rationale} style={{ fontSize: 11, color: COLORS.ink4, cursor: "help" }}>
            ⓘ
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
        <FieldInput def={def} value={value} disabled={saving} onChange={onChange} />
        {def.type !== "enumeration" && (
          <button type="button" onClick={() => void copy()} title="Copy" disabled={!value.trim()} style={iconBtn(!value.trim())}>
            {copied ? <Check size={13} style={{ color: COLORS.ok }} /> : <Copy size={13} />}
          </button>
        )}
        <button
          type="button"
          onClick={askConfirm}
          disabled={saving || !value.trim()}
          title="Write to HubSpot"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            fontWeight: 600,
            padding: "6px 10px",
            borderRadius: 8,
            border: "none",
            background: saving || !value.trim() ? COLORS.bgSoft : COLORS.brand,
            color: saving || !value.trim() ? COLORS.ink3 : "#fff",
            cursor: saving || !value.trim() ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Validate
        </button>
      </div>
      {error && <div style={{ fontSize: 11, color: COLORS.err }}>{error}</div>}

      {confirmOpen && (
        <ConfirmWriteDialog
          label={def.label}
          value={displayValue}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void save()}
        />
      )}
    </div>
  );
}

// Popup de confirmation avant écriture dans HubSpot.
function ConfirmWriteDialog({
  label,
  value,
  onCancel,
  onConfirm,
}: {
  label: string;
  value: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 70,
        padding: 20,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.bgCard,
          borderRadius: 12,
          border: `1px solid ${COLORS.line}`,
          maxWidth: 420,
          width: "100%",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: COLORS.ink0 }}>Write to HubSpot?</h4>
        <p style={{ margin: 0, fontSize: 13, color: COLORS.ink1, lineHeight: 1.5 }}>
          This will set the deal field <strong style={{ fontWeight: 600 }}>{label}</strong> to:
        </p>
        <div
          style={{
            fontSize: 13,
            color: COLORS.ink0,
            background: COLORS.bgSoft,
            border: `1px solid ${COLORS.line}`,
            borderRadius: 8,
            padding: "8px 10px",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {value}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              fontSize: 13,
              fontWeight: 500,
              padding: "7px 14px",
              borderRadius: 8,
              border: `1px solid ${COLORS.line}`,
              background: "white",
              color: COLORS.ink2,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              fontSize: 13,
              fontWeight: 600,
              padding: "7px 14px",
              borderRadius: 8,
              border: "none",
              background: COLORS.brand,
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Write to HubSpot
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldInput({
  def,
  value,
  disabled,
  onChange,
}: {
  def: HubspotChecklistFieldDef;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  const base: React.CSSProperties = {
    flex: 1,
    fontSize: 12,
    padding: "6px 8px",
    borderRadius: 8,
    border: `1px solid ${COLORS.line}`,
    background: "white",
    color: COLORS.ink0,
    fontFamily: "inherit",
    boxSizing: "border-box",
    minHeight: 32,
  };

  if (def.type === "enumeration") {
    // Si la valeur courante n'est pas une option (rare), on l'ajoute en tête
    // pour ne pas la perdre silencieusement.
    const opts = def.options ?? [];
    const known = opts.some((o) => o.value === value);
    return (
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={base}>
        <option value="">Select…</option>
        {!known && value && <option value={value}>{value}</option>}
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (def.type === "date") {
    return <input type="date" value={value.slice(0, 10)} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={base} />;
  }

  if (def.type === "number") {
    return (
      <input
        type="number"
        value={value}
        disabled={disabled}
        placeholder="Fill suggestion…"
        onChange={(e) => onChange(e.target.value)}
        style={base}
      />
    );
  }

  return <AutoTextarea value={value} disabled={disabled} onChange={onChange} style={base} />;
}

// Textarea qui s'agrandit pour afficher tout son contenu (pas de scroll interne).
// La hauteur suit le contenu, avec un minimum confortable et un plafond au-delà
// duquel on scrolle.
function AutoTextarea({
  value,
  disabled,
  onChange,
  style,
}: {
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
  style: React.CSSProperties;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      disabled={disabled}
      placeholder="Fill suggestion…"
      onChange={(e) => onChange(e.target.value)}
      style={{ ...style, resize: "vertical", minHeight: 60, maxHeight: 240, overflowY: "auto", lineHeight: 1.45 }}
    />
  );
}

function iconBtn(disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 8px",
    borderRadius: 8,
    border: `1px solid ${COLORS.line}`,
    background: "white",
    color: disabled ? COLORS.ink4 : COLORS.ink2,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
