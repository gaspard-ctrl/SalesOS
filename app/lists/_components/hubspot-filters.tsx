"use client";

import * as React from "react";
import { Search, ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { COLORS } from "@/lib/design/tokens";
import type { HubspotCriteria, HubspotOwner } from "@/lib/intel-types";

const RANGES: { value: NonNullable<HubspotCriteria["createdRange"]>; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "year", label: "Year" },
  { value: "all", label: "All" },
  { value: "custom", label: "Custom" },
];

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1001-5000", "5001+"];
const COUNTRY_PRESETS = ["France", "Belgium", "Switzerland", "Germany", "United Kingdom", "United States", "Spain", "Italy", "Netherlands"];

/**
 * Formulaire de filtres CONTACT (contrôlé). Édite directement `value` via `onChange`.
 * La recherche live et la sélection se font dans le composant parent (HubspotListBuilder).
 */
export function HubspotFilters({
  value,
  onChange,
  scopeCompanies = [],
}: {
  value: HubspotCriteria;
  onChange: (c: HubspotCriteria) => void;
  scopeCompanies?: { id: string; name: string }[];
}) {
  const c = value;
  const set = (patch: Partial<HubspotCriteria>) => onChange({ ...c, ...patch });

  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [owners, setOwners] = React.useState<HubspotOwner[]>([]);
  const [myOwnerId, setMyOwnerId] = React.useState<string | null>(null);

  React.useEffect(() => {
    void fetch("/api/intel/enrich/hubspot-owners")
      .then((r) => r.json())
      .then((d) => {
        setOwners(d.owners ?? []);
        setMyOwnerId(d.myOwnerId ?? null);
      })
      .catch(() => {});
  }, []);

  return (
    <div style={formStyle()}>
      {/* Recherche libre */}
      <div>
        <Label>Free search</Label>
        <div style={{ position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: COLORS.ink3 }} />
          <input
            value={c.q ?? ""}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="Name, email, phone…"
            style={{
              width: "100%",
              paddingLeft: 32,
              paddingRight: 10,
              paddingTop: 8,
              paddingBottom: 8,
              borderRadius: 8,
              border: `1px solid ${COLORS.line}`,
              fontSize: 13,
              outline: "none",
              background: COLORS.bgCard,
            }}
          />
        </div>
      </div>

      {/* Owners */}
      <div>
        <Label>Owners</Label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button
            type="button"
            onClick={() => set({ owner: myOwnerId ? [myOwnerId] : undefined })}
            style={chip(c.owner?.length === 1 && c.owner[0] === myOwnerId)}
          >
            Only me
          </button>
          <button type="button" onClick={() => set({ owner: undefined })} style={chip(!c.owner || c.owner.length === 0)}>
            All
          </button>
          <OwnersDropdown
            owners={owners}
            selected={c.owner ?? []}
            onChange={(next) => set({ owner: next.length ? next : undefined })}
          />
        </div>
      </div>

      {/* Companies (watchlist) */}
      {scopeCompanies.length > 0 && (
        <div>
          <LabelWithHelp
            label="Companies (watchlist)"
            help="Restricts to contacts associated (in HubSpot) with a company from your watchlist. These are the same contacts shown on the company page."
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button type="button" onClick={() => set({ companies: undefined })} style={chip(!c.companies || c.companies.length === 0)}>
              All
            </button>
            <CompaniesDropdown
              companies={scopeCompanies}
              selected={c.companies ?? []}
              onChange={(next) => set({ companies: next.length ? next : undefined })}
            />
          </div>
        </div>
      )}

      {/* Date d'ajout */}
      <div>
        <Label>Date added (contact)</Label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {RANGES.map((r) => (
            <button key={r.value} type="button" onClick={() => set({ createdRange: r.value })} style={chip(c.createdRange === r.value)}>
              {r.label}
            </button>
          ))}
        </div>
        {c.createdRange === "custom" && (
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <input type="date" value={c.createdFrom ?? ""} onChange={(e) => set({ createdFrom: e.target.value })} style={inp()} />
            <input type="date" value={c.createdTo ?? ""} onChange={(e) => set({ createdTo: e.target.value })} style={inp()} />
          </div>
        )}
      </div>

      {/* Engagement */}
      <div>
        <LabelWithHelp label="Engagement" help="Filter based on the date of the last contact logged in HubSpot (notes_last_contacted)." />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          <button
            type="button"
            onClick={() => set({ neverContacted: false, daysSinceLastContact: undefined })}
            style={chip(!c.neverContacted && !c.daysSinceLastContact)}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => set({ neverContacted: !c.neverContacted, daysSinceLastContact: undefined })}
            style={chip(!!c.neverContacted)}
          >
            Never contacted
          </button>
          {[30, 90, 180].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => set({ daysSinceLastContact: c.daysSinceLastContact === d ? undefined : d, neverContacted: false })}
              style={chip(c.daysSinceLastContact === d)}
            >
              &gt;{d}d
            </button>
          ))}
        </div>
      </div>

      {/* Tri */}
      <div>
        <Label>Sort</Label>
        <select value={c.sort ?? "createdate-desc"} onChange={(e) => set({ sort: e.target.value as HubspotCriteria["sort"] })} style={inp()}>
          <option value="createdate-desc">Date added (recent)</option>
          <option value="lastcontacted-desc">Last contact (recent)</option>
          <option value="lastcontacted-asc">Not contacted in a long time</option>
          <option value="alpha">Alphabetical (name)</option>
        </select>
      </div>

      {/* Filtres avancés */}
      <div>
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            background: "transparent",
            border: "none",
            color: COLORS.ink2,
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            cursor: "pointer",
            padding: 0,
          }}
        >
          {advancedOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Advanced filters
        </button>
        {advancedOpen && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
            <div>
              <Label>Industry</Label>
              <input
                value={(c.industry ?? []).join(", ")}
                onChange={(e) => set({ industry: parseList(e.target.value) })}
                placeholder="Tech, Finance, Retail"
                style={inp()}
              />
            </div>
            <div>
              <Label>Country</Label>
              <select value={(c.country ?? [])[0] ?? ""} onChange={(e) => set({ country: e.target.value ? [e.target.value] : undefined })} style={inp()}>
                <option value="">All</option>
                {COUNTRY_PRESETS.map((co) => (
                  <option key={co} value={co}>
                    {co}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <Label>Company size</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {COMPANY_SIZES.map((s) => {
                  const sel = c.companysize?.includes(s) ?? false;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        const cur = c.companysize ?? [];
                        set({ companysize: sel ? cur.filter((x) => x !== s) : [...cur, s] });
                      }}
                      style={chip(sel)}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>LinkedIn</Label>
              <select
                value={c.hasLinkedin === true ? "yes" : c.hasLinkedin === false ? "no" : ""}
                onChange={(e) => set({ hasLinkedin: e.target.value === "yes" ? true : e.target.value === "no" ? false : undefined })}
                style={inp()}
              >
                <option value="">All</option>
                <option value="yes">Has a LinkedIn</option>
                <option value="no">No LinkedIn</option>
              </select>
            </div>
            <div>
              <Label>Limit (per page)</Label>
              <input
                type="number"
                min={10}
                max={500}
                step={50}
                value={c.limit ?? 50}
                onChange={(e) => set({ limit: parseInt(e.target.value, 10) || 50 })}
                style={inp()}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OwnersDropdown({
  owners,
  selected,
  onChange,
}: {
  owners: HubspotOwner[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (owners.length === 0) return null;

  const filtered = q.trim()
    ? owners.filter((o) => o.name.toLowerCase().includes(q.toLowerCase()) || o.email.toLowerCase().includes(q.toLowerCase()))
    : owners;

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };

  const label = selected.length === 0 ? "Choose owners…" : `${selected.length} owner${selected.length > 1 ? "s" : ""} selected`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 11px",
          fontSize: 11,
          fontWeight: 500,
          borderRadius: 99,
          border: `1px solid ${selected.length > 0 ? COLORS.brand : COLORS.line}`,
          background: selected.length > 0 ? COLORS.brandTint : COLORS.bgCard,
          color: selected.length > 0 ? COLORS.brand : COLORS.ink2,
          cursor: "pointer",
        }}
      >
        {label}
        <ChevronDown size={11} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            minWidth: 280,
            maxWidth: 360,
            background: COLORS.bgCard,
            border: `1px solid ${COLORS.line}`,
            borderRadius: 8,
            boxShadow: "0 6px 24px rgba(0,0,0,0.1)",
            zIndex: 30,
            display: "flex",
            flexDirection: "column",
            maxHeight: 320,
          }}
        >
          <div style={{ padding: 8, borderBottom: `1px solid ${COLORS.line}`, display: "flex", gap: 6, alignItems: "center" }}>
            <Search size={12} style={{ color: COLORS.ink3, flexShrink: 0 }} />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search an owner…"
              style={{ flex: 1, fontSize: 12, border: "none", outline: "none", background: "transparent", padding: 0 }}
            />
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, border: `1px solid ${COLORS.line}`, background: COLORS.bgSoft, color: COLORS.ink2, cursor: "pointer" }}
              >
                Clear
              </button>
            )}
          </div>
          <div style={{ overflowY: "auto", padding: 4 }}>
            {filtered.length === 0 ? (
              <p style={{ padding: 12, fontSize: 11, color: COLORS.ink3, margin: 0, textAlign: "center" }}>No owners.</p>
            ) : (
              filtered.map((o) => {
                const sel = selected.includes(o.id);
                return (
                  <label
                    key={o.id}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, cursor: "pointer", background: sel ? COLORS.brandTintSoft : "transparent" }}
                  >
                    <input type="checkbox" checked={sel} onChange={() => toggle(o.id)} style={{ accentColor: COLORS.brand, width: 14, height: 14 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: COLORS.ink0, fontWeight: 500 }}>{o.name}</div>
                      {o.email && (
                        <div style={{ fontSize: 10, color: COLORS.ink3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.email}</div>
                      )}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CompaniesDropdown({
  companies,
  selected,
  onChange,
}: {
  companies: { id: string; name: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (companies.length === 0) return null;

  const filtered = q.trim() ? companies.filter((co) => co.name.toLowerCase().includes(q.toLowerCase())) : companies;

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };

  const label = selected.length === 0 ? "Choose companies…" : `${selected.length} compan${selected.length > 1 ? "ies" : "y"} selected`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 11px",
          fontSize: 11,
          fontWeight: 500,
          borderRadius: 99,
          border: `1px solid ${selected.length > 0 ? COLORS.brand : COLORS.line}`,
          background: selected.length > 0 ? COLORS.brandTint : COLORS.bgCard,
          color: selected.length > 0 ? COLORS.brand : COLORS.ink2,
          cursor: "pointer",
        }}
      >
        {label}
        <ChevronDown size={11} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            minWidth: 280,
            maxWidth: 360,
            background: COLORS.bgCard,
            border: `1px solid ${COLORS.line}`,
            borderRadius: 8,
            boxShadow: "0 6px 24px rgba(0,0,0,0.1)",
            zIndex: 30,
            display: "flex",
            flexDirection: "column",
            maxHeight: 320,
          }}
        >
          <div style={{ padding: 8, borderBottom: `1px solid ${COLORS.line}`, display: "flex", gap: 6, alignItems: "center" }}>
            <Search size={12} style={{ color: COLORS.ink3, flexShrink: 0 }} />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a company…"
              style={{ flex: 1, fontSize: 12, border: "none", outline: "none", background: "transparent", padding: 0 }}
            />
            {selected.length < companies.length && (
              <button
                type="button"
                onClick={() => onChange(companies.map((co) => co.id))}
                style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, border: `1px solid ${COLORS.brand}`, background: COLORS.brandTint, color: COLORS.brand, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                Select all
              </button>
            )}
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, border: `1px solid ${COLORS.line}`, background: COLORS.bgSoft, color: COLORS.ink2, cursor: "pointer" }}
              >
                Clear
              </button>
            )}
          </div>
          <div style={{ overflowY: "auto", padding: 4 }}>
            {filtered.length === 0 ? (
              <p style={{ padding: 12, fontSize: 11, color: COLORS.ink3, margin: 0, textAlign: "center" }}>No companies.</p>
            ) : (
              filtered.map((co) => {
                const sel = selected.includes(co.id);
                return (
                  <label
                    key={co.id}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, cursor: "pointer", background: sel ? COLORS.brandTintSoft : "transparent" }}
                  >
                    <input type="checkbox" checked={sel} onChange={() => toggle(co.id)} style={{ accentColor: COLORS.brand, width: 14, height: 14 }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: COLORS.ink0, fontWeight: 500 }}>{co.name}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{ display: "block", fontSize: 10, fontWeight: 700, color: COLORS.ink2, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}
    >
      {children}
    </label>
  );
}

function LabelWithHelp({ label, help }: { label: string; help: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.ink2, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      <span title={help} style={{ color: COLORS.ink3, cursor: "help", display: "inline-flex" }}>
        <HelpCircle size={11} />
      </span>
    </div>
  );
}

function chip(active: boolean): React.CSSProperties {
  return {
    padding: "5px 11px",
    fontSize: 11,
    fontWeight: 500,
    borderRadius: 99,
    border: `1px solid ${active ? COLORS.brand : COLORS.line}`,
    background: active ? COLORS.brandTint : COLORS.bgCard,
    color: active ? COLORS.brand : COLORS.ink2,
    cursor: "pointer",
  };
}

function inp(): React.CSSProperties {
  return {
    width: "100%",
    padding: "8px 10px",
    fontSize: 13,
    border: `1px solid ${COLORS.line}`,
    borderRadius: 8,
    outline: "none",
    background: COLORS.bgCard,
  };
}

function parseList(s: string): string[] | undefined {
  const arr = s.split(",").map((x) => x.trim()).filter(Boolean);
  return arr.length ? arr : undefined;
}

function formStyle(): React.CSSProperties {
  return {
    padding: 16,
    background: COLORS.bgSoft,
    borderRadius: 10,
    border: `1px solid ${COLORS.line}`,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  };
}
