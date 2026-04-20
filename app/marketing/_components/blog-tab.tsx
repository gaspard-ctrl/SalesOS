"use client";

import { useState, useCallback } from "react";
import { Search, ExternalLink, Calendar, ChevronLeft, ChevronRight, ArrowLeft, Loader2 } from "lucide-react";
import useSWR from "swr";

interface BlogArticle {
  id: number;
  title: string;
  slug: string;
  date: string;
  link: string;
  excerpt: string;
  image: string | null;
  categories: string[];
  categoryIds: number[];
}

interface Category {
  id: number;
  name: string;
  count: number;
}

interface BlogResponse {
  articles: BlogArticle[];
  totalPosts: number;
  totalPages: number;
  currentPage: number;
  categories: Category[];
}

interface FullArticle {
  id: number;
  title: string;
  slug: string;
  date: string;
  link: string;
  excerpt: string;
  contentHtml: string;
  contentText: string;
  categoryIds: number[];
}

interface SingleArticleResponse {
  article: FullArticle;
}

export default function BlogTab() {
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [openArticleId, setOpenArticleId] = useState<number | null>(null);

  const params = new URLSearchParams({ page: String(page), per_page: "18" });
  if (categoryFilter) params.set("category", categoryFilter);
  if (searchQuery) params.set("search", searchQuery);

  const { data, isLoading } = useSWR<BlogResponse>(
    openArticleId ? null : `/api/marketing/blog?${params.toString()}`,
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );

  const { data: singleData, isLoading: isLoadingArticle } = useSWR<SingleArticleResponse>(
    openArticleId ? `/api/marketing/blog?id=${openArticleId}` : null,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  const articles = data?.articles ?? [];
  const categories = data?.categories ?? [];
  const totalPosts = data?.totalPosts ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const handleSearch = useCallback(() => {
    setSearchQuery(searchInput);
    setPage(1);
  }, [searchInput]);

  const handleCategoryChange = useCallback((catId: string) => {
    setCategoryFilter(catId);
    setPage(1);
  }, []);

  // Article detail view
  if (openArticleId) {
    const article = singleData?.article;
    return (
      <div className="space-y-5">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setOpenArticleId(null)}
            className="flex items-center gap-1.5 text-sm font-medium transition-colors"
            style={{ color: "#555" }}
          >
            <ArrowLeft size={16} />
            Back to articles
          </button>
          {article && (
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{ color: "#f01563", border: "1px solid #f01563" }}
            >
              <ExternalLink size={12} />
              Open on site
            </a>
          )}
        </div>

        {isLoadingArticle || !article ? (
          <div className="flex items-center justify-center py-20 rounded-xl" style={{ background: "#fff", border: "1px solid #eee" }}>
            <Loader2 size={20} className="animate-spin" style={{ color: "#f01563" }} />
          </div>
        ) : (
          <div className="rounded-xl" style={{ background: "#fff", border: "1px solid #eeeeee", padding: "32px 40px" }}>
            {/* Article meta */}
            <div className="flex items-center gap-2 mb-4 text-xs" style={{ color: "#888" }}>
              <Calendar size={12} />
              {new Date(article.date).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}
              <span style={{ color: "#ddd" }}>·</span>
              <code className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#f5f5f5", color: "#666" }}>/blog/{article.slug}/</code>
              <span style={{ color: "#ddd" }}>·</span>
              <span>{article.contentText.split(" ").length} words</span>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold mb-4" style={{ color: "#111" }}>{article.title}</h1>

            {/* Excerpt (if present) */}
            {article.excerpt && (
              <p className="text-base leading-relaxed mb-6 italic" style={{ color: "#555" }}>
                {article.excerpt}
              </p>
            )}

            {/* Article content */}
            {article.contentHtml ? (
              <div
                className="blog-content"
                style={{ color: "#333", lineHeight: 1.7, fontSize: 15 }}
                dangerouslySetInnerHTML={{ __html: article.contentHtml }}
              />
            ) : (
              <div className="text-sm py-8 text-center" style={{ color: "#aaa" }}>
                No content available for this article.
              </div>
            )}
          </div>
        )}

        <style jsx global>{`
          .blog-content h1, .blog-content h2, .blog-content h3, .blog-content h4 {
            color: #111;
            font-weight: 700;
            margin-top: 1.5em;
            margin-bottom: 0.6em;
            line-height: 1.3;
          }
          .blog-content h2 { font-size: 1.4em; }
          .blog-content h3 { font-size: 1.15em; }
          .blog-content p { margin-bottom: 1em; }
          .blog-content ul, .blog-content ol { margin: 1em 0; padding-left: 1.5em; }
          .blog-content li { margin-bottom: 0.4em; }
          .blog-content a { color: #f01563; text-decoration: underline; }
          .blog-content a:hover { opacity: 0.8; }
          .blog-content strong, .blog-content b { font-weight: 600; color: #111; }
          .blog-content em, .blog-content i { font-style: italic; }
          .blog-content table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 0.9em; }
          .blog-content th, .blog-content td { border: 1px solid #eee; padding: 8px 12px; text-align: left; }
          .blog-content th { background: #f9f9f9; font-weight: 600; }
          .blog-content img { max-width: 100%; height: auto; border-radius: 8px; margin: 1em 0; }
          .blog-content blockquote { border-left: 3px solid #f01563; padding-left: 1em; margin: 1em 0; font-style: italic; color: #555; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold" style={{ color: "#111" }}>
            Blog Articles
            <span className="ml-2 text-sm font-normal" style={{ color: "#888" }}>
              {totalPosts} articles
            </span>
          </h3>
        </div>
        <a
          href="https://coachello.ai/blog"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: "#f01563", border: "1px solid #f01563" }}
        >
          <ExternalLink size={12} />
          View Live Blog
        </a>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#aaa" }} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search articles..."
              className="w-full text-sm rounded-lg pl-9 pr-3 py-2 outline-none"
              style={{ border: "1px solid #ddd", color: "#555", background: "#fff" }}
            />
          </div>
          {searchQuery && (
            <button
              onClick={() => { setSearchInput(""); setSearchQuery(""); setPage(1); }}
              className="text-xs font-medium px-3 py-2 rounded-lg"
              style={{ color: "#888", border: "1px solid #ddd" }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="text-sm rounded-lg px-3 py-2 outline-none"
          style={{ border: "1px solid #ddd", color: "#555", background: "#fff", minWidth: 180 }}
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name} ({cat.count})</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl animate-pulse" style={{ background: "#fff", border: "1px solid #eee", height: 320 }} />
          ))}
        </div>
      )}

      {/* Articles Grid */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((article) => (
            <div
              key={article.id}
              onClick={() => setOpenArticleId(article.id)}
              className="rounded-xl overflow-hidden transition-all group cursor-pointer"
              style={{ background: "#fff", border: "1px solid #eeeeee" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#f01563"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#eeeeee"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
            >
              {/* Image */}
              {article.image ? (
                <div className="relative overflow-hidden" style={{ height: 160 }}>
                  <img
                    src={article.image}
                    alt={article.title}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center" style={{ height: 160, background: "#f5f5f5" }}>
                  <span className="text-3xl" style={{ color: "#ddd" }}>📝</span>
                </div>
              )}

              {/* Content */}
              <div className="p-4">
                {/* Categories */}
                {article.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {article.categories.map((cat) => (
                      <span
                        key={cat}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background: "#f0f0f0", color: "#666" }}
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                )}

                {/* Title */}
                <h4
                  className="font-semibold text-sm leading-snug mb-2 transition-colors"
                  style={{ color: "#111", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                >
                  {article.title}
                </h4>

                {/* Excerpt */}
                {article.excerpt && (
                  <p
                    className="text-xs leading-relaxed mb-3"
                    style={{ color: "#888", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                  >
                    {article.excerpt}
                  </p>
                )}

                {/* Date */}
                <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "#bbb" }}>
                  <Calendar size={10} />
                  {new Date(article.date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && articles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl" style={{ background: "#fff", border: "1px solid #eee" }}>
          <p className="text-sm font-medium" style={{ color: "#555" }}>No articles found</p>
          <p className="text-xs mt-1" style={{ color: "#aaa" }}>
            {searchQuery ? `No results for "${searchQuery}"` : "No articles in this category"}
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{
              border: "1px solid #ddd",
              color: page <= 1 ? "#ccc" : "#555",
              cursor: page <= 1 ? "not-allowed" : "pointer",
            }}
          >
            <ChevronLeft size={14} />
            Previous
          </button>
          <span className="text-xs font-medium px-3" style={{ color: "#888" }}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{
              border: "1px solid #ddd",
              color: page >= totalPages ? "#ccc" : "#555",
              cursor: page >= totalPages ? "not-allowed" : "pointer",
            }}
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
