"use client";

import { useMemo, useState } from "react";
import { Building2, Trash2, Plus, ExternalLink, Merge } from "lucide-react";
import { Modal, GhostBtn, PrimaryBtn } from "./modal";
import { COLORS } from "@/lib/design/tokens";
import type { AccountCompany, OrgPerson } from "@/lib/orgchart/types";

interface Props {
  companies: AccountCompany[];
  people: OrgPerson[];
  onClose: () => void;
  onAddCompany: () => void;
  onRemove: (hubspotCompanyId: string) => void;
  onMerge: (from: string[], into: string) => void;
}

const th: React.CSSProperties = {
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  color: COLORS.ink2,
  padding: "6px 10px",
  borderBottom: `1px solid ${COLORS.lineStrong}`,
};
const td: React.CSSProperties = {
  fontSize: 12.5,
  color: COLORS.ink0,
  padding: "8px 10px",
  borderBottom: `1px solid ${COLORS.line}`,
};

export function CompaniesManager({ companies, people, onClose, onAddCompany, onRemove, onMerge }: Props) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const countFor = (hubspotCompanyId: string) =>
    people.filter((p) => p.hubspot_company_id === hubspotCompanyId).length;

  // Entités présentes sur le whiteboard (= cartes regroupées par `entity`).
  const entities = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of people) {
      const e = (p.entity ?? "").trim();
      if (!e) continue;
      m.set(e, (m.get(e) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [people]);

  const [sel, setSel] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState("");
  const toggleEntity = (name: string) => {
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      // Cible par défaut = 1ʳᵉ sélectionnée (la plus grosse, l'ordre est par taille).
      if (!next.has(target)) setTarget(next.size ? [...next][0] : "");
      return next;
    });
  };
  const doMerge = () => {
    const into = target || [...sel][0];
    const from = [...sel].filter((n) => n !== into);
    if (!into || from.length === 0) return;
    onMerge(from, into);
    setSel(new Set());
    setTarget("");
  };

  return (
    <Modal
      title="HubSpot companies"
      width={620}
      onClose={onClose}
      footer={<GhostBtn onClick={onClose}>Close</GhostBtn>}
    >
      <p style={{ fontSize: 12.5, color: COLORS.ink2, margin: "0 0 12px" }}>
        Companies linked to this account. An account can span several HubSpot companies.
      </p>

      {companies.length === 0 ? (
        <div style={{ fontSize: 13, color: COLORS.ink3, padding: "8px 0" }}>No company linked yet.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", background: COLORS.bgCard, borderRadius: 8 }}>
          <thead>
            <tr>
              <th style={th}>Company</th>
              <th style={th}>Domain</th>
              <th style={{ ...th, textAlign: "center" }}>People</th>
              <th style={{ ...th, width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id}>
                <td style={td}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                    <Building2 size={14} style={{ color: COLORS.ink3 }} />
                    <span style={{ fontWeight: 600 }}>{c.name ?? "(no name)"}</span>
                  </span>
                </td>
                <td style={{ ...td, color: COLORS.ink2 }}>{c.domain ?? "—"}</td>
                <td style={{ ...td, textAlign: "center" }}>{countFor(c.hubspot_company_id)}</td>
                <td style={{ ...td, textAlign: "right" }}>
                  {confirm === c.hubspot_company_id ? (
                    <button
                      onClick={() => {
                        onRemove(c.hubspot_company_id);
                        setConfirm(null);
                      }}
                      style={{ color: "#fff", background: COLORS.err, padding: "4px 9px", borderRadius: 7, fontSize: 11.5, fontWeight: 600 }}
                    >
                      Confirm
                    </button>
                  ) : (
                    <button onClick={() => setConfirm(c.hubspot_company_id)} style={{ color: COLORS.err, padding: 5 }} title="Unlink">
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {entities.length >= 2 && (
        <div style={{ marginTop: 18, borderTop: `1px solid ${COLORS.line}`, paddingTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: COLORS.ink2, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 6 }}>
            <Merge size={13} /> Merge companies
          </div>
          <p style={{ fontSize: 12, color: COLORS.ink3, margin: "0 0 10px" }}>
            Two companies that are the same in practice (e.g. Allianz / Allianz Trade)? Check them and merge into a single
            box. The HubSpot companies stay linked - only the grouping changes.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto" }}>
            {entities.map((e) => {
              const on = sel.has(e.name);
              return (
                <label
                  key={e.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: `1px solid ${on ? COLORS.brand : COLORS.line}`,
                    background: on ? COLORS.brandTint : COLORS.bgCard,
                    cursor: "pointer",
                  }}
                >
                  <input type="checkbox" checked={on} onChange={() => toggleEntity(e.name)} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: COLORS.ink0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.name}
                  </span>
                  <span style={{ fontSize: 11.5, color: COLORS.ink3, flexShrink: 0 }}>
                    {e.count} {e.count === 1 ? "person" : "people"}
                  </span>
                </label>
              );
            })}
          </div>
          {sel.size >= 2 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: COLORS.ink2 }}>Keep name:</span>
              <select
                value={target || [...sel][0]}
                onChange={(e) => setTarget(e.target.value)}
                style={{ fontSize: 12.5, padding: "6px 9px", border: `1px solid ${COLORS.lineStrong}`, borderRadius: 8, color: COLORS.ink0, background: COLORS.bgCard }}
              >
                {[...sel].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <div style={{ flex: 1 }} />
              <PrimaryBtn onClick={doMerge}>
                Merge {sel.size} → {target || [...sel][0]}
              </PrimaryBtn>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
        <button
          onClick={onAddCompany}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            fontSize: 12.5,
            fontWeight: 600,
            color: COLORS.brand,
            background: COLORS.brandTint,
            borderRadius: 8,
          }}
        >
          <Plus size={14} /> Add HubSpot company
        </button>
        <span style={{ fontSize: 11, color: COLORS.ink3, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <ExternalLink size={11} /> Unlink keeps already-imported people
        </span>
      </div>
    </Modal>
  );
}
