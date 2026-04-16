"use client";

import { useState } from "react";
import { BarChart3, Search, FileText, Sparkles, Lightbulb, BookOpen } from "lucide-react";
import OverviewTab from "./_components/overview-tab";
import SeoTab from "./_components/seo-tab";
import ArticlesTab from "./_components/articles-tab";
import ContentTab from "./_components/content-tab";
import RecommendationsTab from "./_components/recommendations-tab";
import BlogTab from "./_components/blog-tab";
const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "blog", label: "Blog", icon: BookOpen },
  { id: "seo", label: "SEO", icon: Search },
  { id: "articles", label: "Articles", icon: FileText },
  { id: "content", label: "Content Factory", icon: Sparkles },
  { id: "recommendations", label: "Recommendations", icon: Lightbulb },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function MarketingPage() {
  const [tab, setTab] = useState<TabId>("overview");
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  const handleArticleClick = (articleId: string) => {
    setSelectedArticleId(articleId);
    setTab("articles");
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "#f8f8f8" }}>
      {/* Header */}
      <div className="px-6 pt-5 pb-3" style={{ background: "#fff", borderBottom: "1px solid #eeeeee" }}>
        <h1 className="text-xl font-bold" style={{ color: "#111" }}>Marketing</h1>
        <p className="text-sm mt-0.5" style={{ color: "#888" }}>Blog Coachello — Performance & Content</p>
      </div>

      {/* Tabs */}
      <div className="px-6" style={{ background: "#fff", borderBottom: "1px solid #eeeeee" }}>
        <div className="flex gap-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 text-sm px-4 py-2.5 font-medium transition-colors whitespace-nowrap"
                style={{
                  color: active ? "#f01563" : "#888",
                  borderBottom: active ? "2px solid #f01563" : "2px solid transparent",
                  marginBottom: -1,
                }}
              >
                <Icon size={15} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {tab === "overview" && <OverviewTab onArticleClick={handleArticleClick} />}
        {tab === "blog" && <BlogTab />}
        {tab === "seo" && <SeoTab />}
        {tab === "articles" && (
          <ArticlesTab
            initialSelectedId={selectedArticleId}
            onClearSelection={() => setSelectedArticleId(null)}
          />
        )}
        {tab === "content" && <ContentTab />}
        {tab === "recommendations" && <RecommendationsTab />}
      </div>
    </div>
  );
}
