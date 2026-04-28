import * as React from "react";
import { Check } from "lucide-react";
import { confidenceBadgeStyle } from "@/lib/design/tokens";

export function ConfidenceBadge({
  confidence,
  showIcon = true,
  className = "",
}: {
  confidence: string | null | undefined;
  showIcon?: boolean;
  className?: string;
}) {
  const { fg, bg, label } = confidenceBadgeStyle(confidence);
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1.4,
      }}
    >
      {showIcon ? <Check size={12} strokeWidth={3} /> : null}
      {label}
    </span>
  );
}
