"use client";

import { useMemo, useState } from "react";
import { ExternalLink, RefreshCw, Plus } from "lucide-react";
import { useMarketingPosts } from "@/lib/hooks/use-marketing";
import { COLORS } from "@/lib/design/tokens";
import type { MarketingLinkedInPost } from "@/lib/marketing-types";

const SOURCE_META: Record<MarketingLinkedInPost["source"], { label: string; color: string; background: string }> = {
  pro:   { label: "Company",  color: "#3b82f6", background: "#eff6ff" },
  perso: { label: "Personal", color: "#8b5cf6", background: "#f5f3ff" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "Date unknown";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function PostsTab() {
  const { posts, isLoading, error, refreshNow, collectByUrl, reload } = useMarketingPosts();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "pro" | "perso">("all");
  const [addUrl, setAddUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const proCount = useMemo(() => posts.filter((p) => p.source === "pro").length, [posts]);
  const persoCount = useMemo(() => posts.filter((p) => p.source === "perso").length, [posts]);
  const displayed = useMemo(
    () => (filter === "all" ? posts : posts.filter((p) => p.source === filter)),
    [posts, filter],
  );

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshNow();
    } catch {
      /* erreur silencieuse côté UI : le scrape est best-effort */
    } finally {
      setRefreshing(false);
    }
  }

  // Rattrapage d'un post raté par la discovery hebdo (collecte directe par URL).
  // Asynchrone (Background Function) → on prévient et on recharge la liste après ~90 s.
  async function handleAddPost() {
    const url = addUrl.trim();
    if (!url) return;
    setAdding(true);
    setMsg(null);
    try {
      await collectByUrl(url);
      setAddUrl("");
      setMsg("Post queued - it will appear in the list within ~1-2 minutes (auto-refreshing).");
      setTimeout(() => reload(), 90_000);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: COLORS.ink0 }}>
            LinkedIn Posts
          </h2>
          <p className="text-[12px]" style={{ color: COLORS.ink2 }}>
            Last 12 months, auto-collected weekly with their reactions and comments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={addUrl}
            onChange={(e) => setAddUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddPost(); }}
            placeholder="Paste a post URL to add a missing one"
            disabled={adding}
            className="text-xs px-3 py-1.5 rounded-lg outline-none w-64 disabled:opacity-50"
            style={{ border: `1px solid ${COLORS.lineStrong}`, background: COLORS.bgCard, color: COLORS.ink0 }}
          />
          <button
            onClick={handleAddPost}
            disabled={adding || !addUrl.trim()}
            className="text-xs font-medium px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50"
            style={{ background: COLORS.bgSoft, color: COLORS.ink1, border: `1px solid ${COLORS.lineStrong}` }}
            title="Fetch a specific post by URL (to recover one the weekly scrape missed)"
          >
            <Plus size={13} />
            {adding ? "Adding…" : "Add post"}
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-xs font-medium px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50"
            style={{ background: COLORS.bgSoft, color: COLORS.ink1, border: `1px solid ${COLORS.lineStrong}` }}
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {msg && (
        <div
          className="mb-4 px-3 py-2 rounded-lg text-[12px]"
          style={{ background: COLORS.bgSoft, border: `1px solid ${COLORS.lineStrong}`, color: COLORS.ink1 }}
        >
          {msg}
        </div>
      )}

      {/* Filter: All / Company (pro) / Personal (perso) */}
      {posts.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3">
          {([
            { key: "all", label: "All", n: posts.length },
            { key: "pro", label: "Company", n: proCount },
            { key: "perso", label: "Personal", n: persoCount },
          ] as const).map((t) => {
            const active = filter === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
                style={{
                  background: active ? COLORS.brandTint : COLORS.bgSoft,
                  color: active ? COLORS.brand : COLORS.ink2,
                  border: `1px solid ${active ? COLORS.brandTint : COLORS.lineStrong}`,
                }}
              >
                {t.label}
                <span style={{ opacity: 0.7 }}>{t.n}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.line}` }}>
        {isLoading ? (
          <div className="px-4 py-10 text-xs text-center" style={{ color: COLORS.ink4 }}>Loading…</div>
        ) : error ? (
          <div className="px-4 py-10 text-xs text-center" style={{ color: COLORS.err }}>{error}</div>
        ) : posts.length === 0 ? (
          <div className="px-4 py-10 text-xs text-center" style={{ color: COLORS.ink4 }}>
            No posts yet - the weekly scrape will populate this list (or click Refresh).
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.line}`, background: COLORS.bgSoft }}>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold" style={{ color: COLORS.ink2 }}>Date</th>
                <th className="px-2 py-2.5 text-left text-[11px] font-semibold" style={{ color: COLORS.ink2 }}>Source</th>
                <th className="px-2 py-2.5 text-left text-[11px] font-semibold" style={{ color: COLORS.ink2 }}>Post</th>
                <th className="px-2 py-2.5 text-right text-[11px] font-semibold" style={{ color: COLORS.ink2 }}>Reactions</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold" style={{ color: COLORS.ink2 }}>Comments</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((post) => (
                <PostRow key={post.id} post={post} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function PostRow({ post }: { post: MarketingLinkedInPost }) {
  const meta = SOURCE_META[post.source];

  return (
    <tr style={{ borderBottom: `1px solid ${COLORS.bgSoft}` }}>
      <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: COLORS.ink2, fontSize: 12, width: 130 }}>
        {formatDate(post.posted_at)}
      </td>
      <td className="px-2 py-2.5" style={{ width: 230 }}>
        <div className="flex items-center gap-1.5" title={`${post.author || "?"} · ${meta.label}`}>
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0"
            style={{ background: meta.background, color: meta.color }}
          >
            {meta.label}
          </span>
          <span className="text-[12px] truncate" style={{ color: COLORS.ink0, maxWidth: 150 }}>
            {post.author || ""}
          </span>
        </div>
      </td>
      <td className="px-2 py-2.5" style={{ color: COLORS.ink0, maxWidth: 360 }}>
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px]">
            {post.content ? post.content.slice(0, 90) : "(no text)"}
          </span>
          <a
            href={post.post_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: COLORS.ink4 }}
            aria-label="Open post"
          >
            <ExternalLink size={12} />
          </a>
        </div>
      </td>
      <td className="px-2 py-2.5 text-right" style={{ color: COLORS.ink1, fontSize: 12 }}>{post.likes}</td>
      <td className="px-4 py-2.5 text-right" style={{ color: COLORS.ink1, fontSize: 12 }}>{post.comments}</td>
    </tr>
  );
}
