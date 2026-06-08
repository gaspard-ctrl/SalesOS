"use client";

import * as React from "react";
import { RefreshCw, Send, Check } from "lucide-react";
import { COLORS } from "@/lib/design/tokens";

export function BriefingActions({
  onRefresh,
  onSendSlack,
  sendingSlack,
  slackSent,
  slackName,
}: {
  onRefresh: () => void;
  onSendSlack: () => void;
  sendingSlack: boolean;
  slackSent: boolean;
  slackName: string | null | undefined;
}) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button
        type="button"
        onClick={onRefresh}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          padding: "7px 12px",
          borderRadius: 10,
          border: `1px solid ${COLORS.lineStrong}`,
          color: COLORS.ink2,
          background: COLORS.bgCard,
          cursor: "pointer",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = COLORS.brand;
          e.currentTarget.style.color = COLORS.brand;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = COLORS.lineStrong;
          e.currentTarget.style.color = COLORS.ink2;
        }}
      >
        <RefreshCw size={13} />
        Refresh
      </button>
      <button
        type="button"
        onClick={onSendSlack}
        disabled={sendingSlack || slackSent || !slackName}
        title={!slackName ? "Set your Slack name in Admin" : undefined}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          padding: "7px 14px",
          borderRadius: 10,
          border: "none",
          color: slackSent ? COLORS.ok : "#fff",
          background: slackSent ? COLORS.okBg : COLORS.brand,
          cursor: sendingSlack || slackSent || !slackName ? "not-allowed" : "pointer",
          opacity: !slackName ? 0.6 : 1,
          fontWeight: 500,
          transition: "background 0.15s",
        }}
      >
        {slackSent ? <Check size={13} /> : <Send size={13} />}
        {slackSent ? "Sent to Slack" : sendingSlack ? "Sending…" : "Send to Slack"}
      </button>
    </div>
  );
}
