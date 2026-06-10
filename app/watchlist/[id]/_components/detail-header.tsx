"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Linkedin, Sparkles } from "lucide-react";
import { COLORS, SHADOWS, repAccent } from "@/lib/design/tokens";
import { CompanyAvatar } from "@/components/ui/company-avatar";
import { slugifyCompany } from "@/lib/slugify-company";
import type { WatchCompanyDetail } from "@/app/api/watchlist/companies/[id]/route";

export function DetailHeader({
  company,
  onEnrich,
}: {
  company: WatchCompanyDetail;
  onEnrich?: () => void;
}) {
  const linkedinSlug = slugifyCompany(company.name);
  const linkedinUrl = `https://www.linkedin.com/company/${linkedinSlug}/`;
  const owner = company.owner?.trim() || null;
  const accent = owner ? repAccent(owner) : null;
  const meta = [company.sector, company.current_coaching_platform].filter(Boolean).join(" · ");

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        height: 60,
        background: COLORS.bgCard,
        borderBottom: `1px solid ${COLORS.line}`,
        padding: "0 20px",
        display: "flex",
        alignItems: "center",
        gap: 13,
      }}
    >
      <Link
        href="/watchlist"
        aria-label="Back to Watch List"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: 8,
          border: `1px solid ${COLORS.line}`,
          color: COLORS.ink2,
          textDecoration: "none",
          background: COLORS.bgCard,
          flexShrink: 0,
        }}
      >
        <ArrowLeft size={16} />
      </Link>

      <CompanyAvatar name={company.name} size={36} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em", color: COLORS.ink0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {company.name}
        </h1>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 2,
            fontSize: 12.5,
            color: COLORS.ink3,
            whiteSpace: "nowrap",
          }}
        >
          {meta && (
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: 360 }}>{meta}</span>
          )}
          {meta && <span>·</span>}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: accent ?? "transparent",
                border: accent ? "none" : `1px dashed ${COLORS.ink4}`,
                boxShadow: accent ? `0 0 0 3px ${accent}22` : "none",
              }}
            />
            {owner ?? "No owner"}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        <a href={linkedinUrl} target="_blank" rel="noreferrer" title="View on LinkedIn" style={iconBtnStyle()}>
          <Linkedin size={14} />
        </a>
        {company.hubspot_company_id && (
          <a
            href={`https://app.hubspot.com/contacts/_/company/${company.hubspot_company_id}`}
            target="_blank"
            rel="noreferrer"
            style={ghostBtnSm()}
          >
            <ExternalLink size={14} /> Open in HubSpot
          </a>
        )}
        {onEnrich && (
          <button type="button" onClick={onEnrich} style={primaryBtnSm()}>
            <Sparkles size={14} /> Enrich
          </button>
        )}
      </div>
    </header>
  );
}

function iconBtnStyle(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 30,
    height: 30,
    borderRadius: 8,
    border: `1px solid ${COLORS.line}`,
    color: COLORS.ink2,
    background: COLORS.bgCard,
    textDecoration: "none",
  };
}

function ghostBtnSm(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 30,
    padding: "0 11px",
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 8,
    border: `1px solid ${COLORS.lineStrong}`,
    background: COLORS.bgCard,
    color: COLORS.ink0,
    textDecoration: "none",
    cursor: "pointer",
  };
}

function primaryBtnSm(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 30,
    padding: "0 11px",
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 8,
    border: "none",
    background: COLORS.brand,
    color: "#fff",
    boxShadow: SHADOWS.pink,
    cursor: "pointer",
  };
}
