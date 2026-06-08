"use client";

import React, { useState, useRef } from "react";
import {
  Search,
  Loader2,
  Linkedin,
  Building2,
  MapPin,
  X,
  Globe,
  Newspaper,
  TrendingUp,
  Map as MapIcon,
  ShoppingBag,
  Image as ImageIcon,
} from "lucide-react";

const BRAND = "#f01563";

// ════════════════════════════════════════════════════════════════════════
//  Page : lab Bright Data à onglets (LinkedIn + SERP Google complet)
// ════════════════════════════════════════════════════════════════════════
type Tab = "serp" | "linkedin";

export default function ScrapeTestPage() {
  const [tab, setTab] = useState<Tab>("serp");

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 20px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Bright Data · Lab</h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>
        Bright Data API testbed. <strong>Google SERP</strong> tab: query all Google verticals
        (Web, News, Trends, Maps, Shopping, Images) via the <code>salesos_serp</code> zone - the core of intel / market /
        monitoring. <strong>LinkedIn</strong> tab: profile scraping.
      </p>

      {/* Onglets en pilule */}
      <div
        style={{
          display: "inline-flex",
          gap: 2,
          border: "1px solid #eee",
          borderRadius: 8,
          padding: 2,
          background: "#fafafa",
          marginBottom: 24,
        }}
      >
        <button type="button" onClick={() => setTab("serp")} style={tabBtn(tab === "serp")}>
          <Globe size={13} /> SERP Google
        </button>
        <button type="button" onClick={() => setTab("linkedin")} style={tabBtn(tab === "linkedin")}>
          <Linkedin size={13} /> LinkedIn
        </button>
      </div>

      {tab === "serp" ? <SerpTab /> : <LinkedInTab />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
//  Onglet SERP — tous les moteurs Google
// ════════════════════════════════════════════════════════════════════════
type Engine = "web" | "news" | "trends" | "maps" | "shopping" | "images";

const ENGINES: {
  key: Engine;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  hint: string;
  examples: string[];
}[] = [
  {
    key: "web",
    label: "Web",
    icon: Globe,
    hint: "Organic results + knowledge graph (company card), people-also-ask, related searches.",
    examples: ["Salesforce", "best CRM software 2026", "Datadog headquarters"],
  },
  {
    key: "news",
    label: "News",
    icon: Newspaper,
    hint: "Company / market monitoring: recent articles (title, source, date, excerpt).",
    examples: ["Datadog layoffs", "OpenAI funding round", "Salesforce acquisition"],
  },
  {
    key: "trends",
    label: "Trends",
    icon: TrendingUp,
    hint: "Interest over time (best-effort: Google Trends often returns raw data).",
    examples: ["CRM software", "AI agents", "cold email"],
  },
  {
    key: "maps",
    label: "Maps / Local",
    icon: MapIcon,
    hint: "Local presence: businesses, addresses, ratings, reviews, phone.",
    examples: ["SaaS companies Paris", "coworking Lyon", "marketing agency London"],
  },
  {
    key: "shopping",
    label: "Shopping",
    icon: ShoppingBag,
    hint: "Competitor pricing: products, prices, merchants.",
    examples: ["macbook pro 16", "standing desk", "office chair ergonomic"],
  },
  {
    key: "images",
    label: "Images",
    icon: ImageIcon,
    hint: "Images: source URLs, thumbnails.",
    examples: ["Salesforce logo", "Datadog office", "org chart"],
  },
];

const COUNTRIES = [
  { code: "us", label: "🇺🇸 US" },
  { code: "fr", label: "🇫🇷 France" },
  { code: "gb", label: "🇬🇧 UK" },
  { code: "de", label: "🇩🇪 Germany" },
  { code: "es", label: "🇪🇸 Spain" },
  { code: "ca", label: "🇨🇦 Canada" },
];
const LANGS = ["en", "fr", "de", "es", "it"];

interface SerpResponse {
  engine: Engine;
  ok: boolean;
  status: number;
  ms: number;
  isJson: boolean;
  request: { googleUrl: string; zone: string; sentBody: Record<string, unknown> };
  parsed: Record<string, unknown> | null;
  raw: unknown;
  error?: string;
}

function SerpTab() {
  const [engine, setEngine] = useState<Engine>("web");
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("us");
  const [lang, setLang] = useState("en");
  const [num, setNum] = useState(10);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resp, setResp] = useState<SerpResponse | null>(null);

  const current = ENGINES.find((e) => e.key === engine)!;

  async function run(queryOverride?: string) {
    const query = (queryOverride ?? q).trim();
    if (!query) return;
    if (queryOverride) setQ(queryOverride);
    setLoading(true);
    setError("");
    setResp(null);
    try {
      const res = await fetch("/api/brightdata/serp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engine, q: query, country, lang, num }),
      });
      const json = (await res.json()) as SerpResponse;
      if (!res.ok && json.error) throw new Error(json.error);
      setResp(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Sélecteur de moteur */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {ENGINES.map((e) => {
          const Icon = e.icon;
          const active = e.key === engine;
          return (
            <button
              key={e.key}
              type="button"
              onClick={() => {
                setEngine(e.key);
                setResp(null);
                setError("");
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 8,
                border: `1px solid ${active ? BRAND : "#e5e7eb"}`,
                background: active ? BRAND : "white",
                color: active ? "white" : "#374151",
                cursor: "pointer",
              }}
            >
              <Icon size={13} /> {e.label}
            </button>
          );
        })}
      </div>

      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>{current.hint}</p>

      {/* Contrôles partagés */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!loading) run();
        }}
        style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Query…"
          style={{ ...inputStyle, flex: "2 1 260px" }}
        />
        <select value={country} onChange={(e) => setCountry(e.target.value)} style={selectStyle}>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
        <select value={lang} onChange={(e) => setLang(e.target.value)} style={selectStyle}>
          {LANGS.map((l) => (
            <option key={l} value={l}>
              {l.toUpperCase()}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          max={100}
          value={num}
          onChange={(e) => setNum(Number(e.target.value))}
          title="Number of results"
          style={{ ...inputStyle, flex: "0 0 70px", minWidth: 70 }}
        />
        <button
          type="submit"
          disabled={loading || !q.trim()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 20px",
            height: 42,
            borderRadius: 8,
            border: "none",
            background: loading || !q.trim() ? "#f3a8c4" : BRAND,
            color: "white",
            fontWeight: 600,
            fontSize: 14,
            cursor: loading || !q.trim() ? "not-allowed" : "pointer",
          }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          {loading ? "…" : "Run"}
        </button>
      </form>

      {/* Chips d'exemples */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
        <span style={{ fontSize: 12, color: "#9ca3af", alignSelf: "center" }}>Examples:</span>
        {current.examples.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => !loading && run(ex)}
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid #e5e7eb",
              background: "#fafafa",
              color: "#374151",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {ex}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: "#fef2f2", color: "#b91c1c", padding: "12px 16px", borderRadius: 8, fontSize: 14, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {resp && <SerpResult resp={resp} />}
    </div>
  );
}

// ── Rendu d'une réponse SERP : parsé + inspecteur + JSON brut ──────────────
function SerpResult({ resp }: { resp: SerpResponse }) {
  return (
    <div>
      {/* Bandeau méta */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, fontSize: 12, flexWrap: "wrap" }}>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 999,
            background: resp.ok ? "#ecfdf5" : "#fef2f2",
            color: resp.ok ? "#059669" : "#dc2626",
            fontWeight: 600,
          }}
        >
          HTTP {resp.status}
        </span>
        <span style={{ color: "#6b7280" }}>{resp.ms} ms</span>
        {!resp.isJson && <span style={{ color: "#b45309" }}>non-JSON response (shown raw)</span>}
      </div>

      {/* Bloc parsé lisible */}
      <ParsedView engine={resp.engine} parsed={resp.parsed} />

      {/* Inspecteur de requête */}
      <details open style={{ marginTop: 18 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, color: "#6b7280", fontWeight: 500 }}>Request inspector</summary>
        <div style={{ marginTop: 8, fontSize: 12, color: "#374151" }}>
          <div style={{ marginBottom: 6 }}>
            <strong>Zone:</strong> <code>{resp.request.zone}</code>
          </div>
          <div style={{ marginBottom: 6 }}>
            <strong>Google URL:</strong>{" "}
            <a href={resp.request.googleUrl} target="_blank" rel="noopener noreferrer" style={{ color: BRAND, wordBreak: "break-all" }}>
              {resp.request.googleUrl}
            </a>
          </div>
          <div>
            <strong>Body sent to /request:</strong>
            <pre style={preStyle}>{JSON.stringify(resp.request.sentBody, null, 2)}</pre>
          </div>
        </div>
      </details>

      {/* JSON brut complet */}
      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, color: "#6b7280", fontWeight: 500 }}>Raw response (full JSON)</summary>
        <pre style={preStyle}>
          {typeof resp.raw === "string" ? resp.raw : JSON.stringify(resp.raw, null, 2)}
        </pre>
      </details>
    </div>
  );
}

// ── Renderers dédiés par moteur (fallback générique sinon) ─────────────────
function ParsedView({ engine, parsed }: { engine: Engine; parsed: Record<string, unknown> | null }) {
  if (!parsed || Object.keys(parsed).length === 0) {
    return <div style={{ color: "#6b7280", fontSize: 14 }}>No structured field recognized - see the raw response below.</div>;
  }

  const asArr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));

  if (engine === "web") {
    const organic = asArr(parsed.organic);
    const knowledge = parsed.knowledge as Record<string, unknown> | undefined;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {knowledge && (
          <div style={{ ...cardStyle, background: "#fff9fb", borderColor: "#fde8ef" }}>
            <div style={{ fontSize: 11, color: BRAND, fontWeight: 600, marginBottom: 4 }}>KNOWLEDGE GRAPH</div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{str(knowledge.name) || str(knowledge.title)}</div>
            {!!str(knowledge.description) && <div style={{ fontSize: 13, color: "#374151", marginTop: 4 }}>{str(knowledge.description)}</div>}
            <details style={{ marginTop: 6 }}>
              <summary style={{ cursor: "pointer", fontSize: 12, color: "#6b7280" }}>all fields</summary>
              <pre style={preStyle}>{JSON.stringify(knowledge, null, 2)}</pre>
            </details>
          </div>
        )}
        {organic.map((o, i) => (
          <ResultCard
            key={i}
            title={str(o.title)}
            link={str(o.link) || str(o.url)}
            subtitle={str(o.display_link) || str(o.link)}
            snippet={str(o.description) || str(o.snippet)}
          />
        ))}
        <CountNote n={organic.length} label="organic results" />
      </div>
    );
  }

  if (engine === "news") {
    const news = asArr(parsed.news).length ? asArr(parsed.news) : asArr(parsed.organic);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {news.map((n, i) => (
          <ResultCard
            key={i}
            title={str(n.title)}
            link={str(n.link) || str(n.url)}
            subtitle={[str(n.source), str(n.date) || str(n.time)].filter(Boolean).join(" · ")}
            snippet={str(n.description) || str(n.snippet)}
          />
        ))}
        <CountNote n={news.length} label="articles" />
      </div>
    );
  }

  if (engine === "maps") {
    const local = asArr(parsed.local_results).length
      ? asArr(parsed.local_results)
      : asArr(parsed.local).length
        ? asArr(parsed.local)
        : asArr(parsed.places);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {local.map((p, i) => (
          <div key={i} style={cardStyle}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{str(p.name) || str(p.title)}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, display: "flex", gap: 14, flexWrap: "wrap" }}>
              {!!str(p.rating) && <span>⭐ {str(p.rating)} {str(p.reviews) && `(${str(p.reviews)})`}</span>}
              {!!str(p.address) && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={12} /> {str(p.address)}</span>}
              {!!str(p.phone) && <span>{str(p.phone)}</span>}
            </div>
          </div>
        ))}
        <CountNote n={local.length} label="places" />
      </div>
    );
  }

  if (engine === "shopping") {
    const items = asArr(parsed.shopping).length ? asArr(parsed.shopping) : asArr(parsed.shopping_results).length ? asArr(parsed.shopping_results) : asArr(parsed.pla);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((p, i) => (
          <div key={i} style={cardStyle}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{str(p.title) || str(p.name)}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, display: "flex", gap: 14, flexWrap: "wrap" }}>
              {!!str(p.price) && <span style={{ color: "#059669", fontWeight: 600 }}>{str(p.price)}</span>}
              {!!str(p.source) && <span>{str(p.source)}</span>}
              {!!str(p.rating) && <span>⭐ {str(p.rating)}</span>}
            </div>
          </div>
        ))}
        <CountNote n={items.length} label="products" />
      </div>
    );
  }

  if (engine === "images") {
    const imgs = asArr(parsed.images).length ? asArr(parsed.images) : asArr(parsed.image);
    return (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
          {imgs.slice(0, 24).map((im, i) => {
            const src = str(im.image) || str(im.thumbnail) || str(im.src) || str(im.link);
            if (!src) return null;
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt="" style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 8, border: "1px solid #eee" }} />
            );
          })}
        </div>
        <CountNote n={imgs.length} label="images" />
      </div>
    );
  }

  // Trends + fallback : afficher le JSON parsé
  return <pre style={preStyle}>{JSON.stringify(parsed, null, 2)}</pre>;
}

function ResultCard({ title, link, subtitle, snippet }: { title: string; link: string; subtitle?: string; snippet?: string }) {
  return (
    <div style={cardStyle}>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, fontSize: 14, color: BRAND, textDecoration: "none" }}>
          {title || link}
        </a>
      ) : (
        <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
      )}
      {subtitle && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{subtitle}</div>}
      {snippet && <div style={{ fontSize: 13, color: "#374151", marginTop: 6 }}>{snippet}</div>}
    </div>
  );
}

function CountNote({ n, label }: { n: number; label: string }) {
  return <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{n} {label}</div>;
}

// ════════════════════════════════════════════════════════════════════════
//  Onglet LinkedIn — flux existant (recherche + scrape async + polling)
// ════════════════════════════════════════════════════════════════════════
interface Profile {
  name?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  current_company?: { name?: string; title?: string } | string;
  current_company_name?: string;
  city?: string;
  location?: string;
  about?: string;
  url?: string;
  input_url?: string;
  avatar?: string;
  [key: string]: unknown;
}

const POLL_INTERVAL = 4000; // 4s
const MAX_POLLS = 60; // ~4 min

function companyName(p: Profile): string {
  if (typeof p.current_company === "string") return p.current_company;
  if (p.current_company?.name) return p.current_company.name;
  return p.current_company_name ?? "";
}

function LinkedInTab() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");

  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [resolvedUrl, setResolvedUrl] = useState("");
  const [error, setError] = useState("");
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const cancelRef = useRef(false);

  function reset() {
    setError("");
    setProfiles(null);
    setStatusMsg("");
    setResolvedUrl("");
  }

  async function poll(snapshotId: string): Promise<Profile[]> {
    for (let i = 0; i < MAX_POLLS; i++) {
      if (cancelRef.current) throw new Error("Cancelled");
      setStatusMsg(`Scraping in progress… (${i * (POLL_INTERVAL / 1000)}s)`);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      const res = await fetch(`/api/brightdata/scrape?snapshot_id=${encodeURIComponent(snapshotId)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
      if (json.ready) return (json.profiles as Profile[]) ?? [];
    }
    throw new Error("Timed out: the scrape is taking too long");
  }

  const canSubmit = linkedinUrl.trim() ? true : !!(firstName.trim() && lastName.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || loading) return;
    reset();
    setLoading(true);
    cancelRef.current = false;
    try {
      setStatusMsg(linkedinUrl.trim() ? "Triggering the scrape…" : "Searching for the LinkedIn profile…");
      const res = await fetch("/api/brightdata/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          company: company.trim() || undefined,
          linkedinUrl: linkedinUrl.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);

      if (json.count) setResolvedUrl(`${json.count} profile(s) found, scraping in progress…`);
      const results = await poll(json.snapshotId);
      setProfiles(results);
      setStatusMsg("");
      setResolvedUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatusMsg("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>
        Enter a name (+ optional company): we find <strong>all</strong> matching LinkedIn profiles
        via the Bright Data SERP API (Google), then scrape them. You can also paste a{" "}
        <code>linkedin.com/in/…</code> URL directly.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name *" style={inputStyle} disabled={!!linkedinUrl.trim()} />
        <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name *" style={inputStyle} disabled={!!linkedinUrl.trim()} />
        <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company (optional)" style={inputStyle} disabled={!!linkedinUrl.trim()} />
        <button
          type="submit"
          disabled={loading || !canSubmit}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 20px",
            height: 42,
            borderRadius: 8,
            border: "none",
            background: loading || !canSubmit ? "#f3a8c4" : BRAND,
            color: "white",
            fontWeight: 600,
            fontSize: 14,
            cursor: loading || !canSubmit ? "not-allowed" : "pointer",
          }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          {loading ? "Searching…" : "Scrape"}
        </button>
      </form>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
        <Linkedin size={14} color="#9ca3af" />
        <input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="… or direct LinkedIn URL (https://www.linkedin.com/in/…)" style={{ ...inputStyle, flex: 1 }} />
      </div>

      {resolvedUrl && <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>{resolvedUrl}</div>}

      {loading && statusMsg && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#6b7280", fontSize: 14, marginBottom: 16 }}>
          <Loader2 size={14} className="animate-spin" />
          {statusMsg}
          <button onClick={() => { cancelRef.current = true; }} style={{ marginLeft: 8, color: BRAND, background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>
            <X size={13} style={{ display: "inline", verticalAlign: "middle" }} /> Cancel
          </button>
        </div>
      )}

      {error && (
        <div style={{ background: "#fef2f2", color: "#b91c1c", padding: "12px 16px", borderRadius: 8, fontSize: 14, marginBottom: 16 }}>{error}</div>
      )}

      {profiles && profiles.length === 0 && <div style={{ color: "#6b7280", fontSize: 14 }}>No profile found.</div>}

      {profiles && profiles.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {profiles.map((p, i) => {
            const name = p.name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Profile";
            const co = companyName(p);
            const loc = p.city || p.location || "";
            return (
              <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, display: "flex", gap: 14 }}>
                {p.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatar} alt={name} width={48} height={48} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 600, color: "#9ca3af" }}>
                    {name.charAt(0)}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{name}</div>
                  {p.position && <div style={{ fontSize: 13, color: "#374151", marginTop: 2 }}>{p.position}</div>}
                  <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 12, color: "#6b7280", flexWrap: "wrap" }}>
                    {co && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Building2 size={12} /> {co}</span>}
                    {loc && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={12} /> {loc}</span>}
                  </div>
                  {(p.url || p.input_url) && (
                    <a href={p.url || p.input_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 13, color: BRAND, textDecoration: "none" }}>
                      <Linkedin size={13} /> View profile
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {profiles && profiles.length > 0 && (
        <details style={{ marginTop: 20 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "#6b7280" }}>Raw data (JSON)</summary>
          <pre style={preStyle}>{JSON.stringify(profiles, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}

// ── Styles partagés ────────────────────────────────────────────────────────
function tabBtn(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 14px",
    fontSize: 13,
    borderRadius: 6,
    border: "none",
    cursor: "pointer",
    background: active ? BRAND : "transparent",
    color: active ? "white" : "#666",
    fontWeight: 500,
  };
}

const inputStyle: React.CSSProperties = {
  flex: "1 1 180px",
  minWidth: 140,
  height: 42,
  padding: "0 14px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  fontSize: 14,
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  height: 42,
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  fontSize: 14,
  background: "white",
  cursor: "pointer",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 14,
};

const preStyle: React.CSSProperties = {
  background: "#f9fafb",
  padding: 12,
  borderRadius: 8,
  fontSize: 11,
  overflow: "auto",
  marginTop: 8,
  maxHeight: 480,
};
