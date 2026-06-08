"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { SuggestionChip } from "@/components/ui/suggestion-chip";
import { COLORS } from "@/lib/design/tokens";
import { ConnectorRow } from "./connector-row";

const SUGGESTIONS = [
  "Which deals are at risk this week?",
  "Overdue follow-ups in the retail sector?",
  "Find the last email from Doctolib",
  "Draft a cold email for a VP People in the energy sector",
  "Explain the MEDDIC method in 3 sentences",
  "Stand-up plan for my team on Monday",
];

export function ChatWelcome({ onPick }: { onPick: (text: string) => void }) {
  const { user } = useUser();
  const firstName = user?.firstName ?? user?.username ?? "";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        textAlign: "center",
        height: "100%",
        padding: "24px 16px",
      }}
    >
      <Image
        src="/logo.png"
        alt="Coachello"
        width={56}
        height={56}
        quality={100}
        className="rounded-2xl"
      />
      <h1
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: COLORS.ink0,
          margin: 0,
          letterSpacing: "-0.01em",
        }}
      >
        {firstName ? `Hi ${firstName}, how can I help?` : "How can I help?"}
      </h1>
      <p style={{ fontSize: 13, color: COLORS.ink3, maxWidth: 460, margin: 0 }}>
        Ask a question - I have access to HubSpot, Gmail, Slack, Drive, LinkedIn and the web.
      </p>

      {/* Suggestion chips */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "center",
          marginTop: 6,
          maxWidth: 720,
        }}
      >
        {SUGGESTIONS.map((q) => (
          <SuggestionChip key={q} onClick={() => onPick(q)}>
            {q}
          </SuggestionChip>
        ))}
      </div>

      {/* Connector row */}
      <div style={{ marginTop: 8 }}>
        <ConnectorRow />
      </div>

      {/* Advice card (preserved from original UI) */}
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          marginTop: 8,
          padding: "10px 16px",
          borderRadius: 12,
          background: "#fff8f0",
          border: "1px solid #ffe4c4",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#c2410c",
            margin: 0,
            marginBottom: 4,
          }}
        >
          Tip
        </p>
        <p style={{ fontSize: 11, lineHeight: 1.5, color: "#78350f", margin: 0 }}>
          For better results, indicate where to look (HubSpot, Drive, Gmail, Slack)
          and specify what you need (stage, deal, contact, time period).{" "}
          <Link href="/prompt" style={{ textDecoration: "underline" }}>
            Customize your guide.
          </Link>
        </p>
      </div>
    </div>
  );
}
