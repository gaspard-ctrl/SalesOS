"use client";

export interface FilterState {
  users: boolean;
  leads: boolean;
  articles: boolean;
  salon: boolean;
  linkedin_pro: boolean;
  linkedin_perso: boolean;
  nurturing_campaign: boolean;
  impressions: boolean;
}

export const DEFAULT_FILTERS: FilterState = {
  users: true,
  leads: true,
  articles: true,
  salon: true,
  linkedin_pro: true,
  linkedin_perso: true,
  nurturing_campaign: true,
  impressions: true,
};

const FILTER_CONFIG: { key: keyof FilterState; label: string; color: string }[] = [
  { key: "users",              label: "Users",          color: "#f01563" },
  { key: "leads",              label: "Leads",          color: "#facc15" },
  { key: "articles",           label: "Articles",       color: "#0ea5e9" },
  { key: "salon",              label: "Salons",         color: "#16a34a" },
  { key: "linkedin_pro",       label: "LinkedIn Pro",   color: "#3b82f6" },
  { key: "linkedin_perso",     label: "LinkedIn Perso", color: "#8b5cf6" },
  { key: "nurturing_campaign", label: "Nurturing",      color: "#14b8a6" },
  { key: "impressions",        label: "Impressions",    color: "#06b6d4" },
];

export function FilterRow({
  filters, onChange, hiddenKeys,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  hiddenKeys?: Array<keyof FilterState>;
}) {
  const hidden = new Set(hiddenKeys ?? []);
  return (
    <div className="flex items-center flex-wrap gap-2">
      {FILTER_CONFIG.filter((f) => !hidden.has(f.key)).map((f) => {
        const on = filters[f.key];
        return (
          <button
            key={f.key}
            onClick={() => onChange({ ...filters, [f.key]: !on })}
            className="text-xs font-medium rounded-full px-3 py-1 transition-colors inline-flex items-center gap-1.5"
            style={{
              background: on ? "#fff" : "#fafafa",
              color: on ? "#333" : "#aaa",
              border: on ? `1px solid ${f.color}` : "1px solid #eeeeee",
              opacity: on ? 1 : 0.6,
            }}
          >
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: on ? f.color : "#ddd" }} />
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
