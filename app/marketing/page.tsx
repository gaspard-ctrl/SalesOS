"use client";

import { useState } from "react";
import { BarChart3, Search, Sparkles, BookOpen, Inbox } from "lucide-react";
import OverviewTab from "./_components/overview-tab";
import SeoTab from "./_components/seo-tab";
import ContentTab from "./_components/content-tab";
import BlogTab from "./_components/blog-tab";
import LeadsTab from "./_components/leads-tab";
import { useLeads } from "@/lib/hooks/use-marketing";

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "articles", label: "Articles", icon: BookOpen },
  { id: "seo", label: "SEO", icon: Search },
  { id: "content", label: "Content Factory", icon: Sparkles },
  { id: "leads", label: "Leads", icon: Inbox },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function MarketingPage() {
  const [tab, setTab] = useState<TabId>("overview");
  const { counts } = useLeads("pending");
  const pendingCount = counts.pending;

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
            const showBadge = t.id === "leads" && pendingCount > 0;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 text-sm px-4 py-2.5 font-medium transition-colors whitespace-nowrap"
                style={{
                  position: "relative",
                  color: active ? "#f01563" : "#888",
                  borderBottom: active ? "2px solid #f01563" : "2px solid transparent",
                  marginBottom: -1,
                }}
              >
                <Icon size={15} />
                {t.label}
                {showBadge && (
                  <span
                    style={{
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      background: "#ef4444",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 5px",
                      marginLeft: 4,
                    }}
                  >
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {tab === "overview" && <OverviewTab />}
        {tab === "articles" && <BlogTab />}
        {tab === "seo" && <SeoTab />}
        {tab === "content" && <ContentTab />}
        {tab === "leads" && <LeadsTab />}
      </div>
    </div>
  );
}
