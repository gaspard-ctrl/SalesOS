import * as React from "react";
import { COLORS } from "@/lib/design/tokens";

type IconType = React.ComponentType<{ size?: number | string; className?: string; strokeWidth?: number }>;

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
  style,
}: {
  icon?: IconType;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "48px 24px",
        textAlign: "center",
        color: COLORS.ink2,
        ...style,
      }}
    >
      {Icon ? (
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: COLORS.bgSoft,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: COLORS.ink3,
          }}
        >
          <Icon size={24} />
        </div>
      ) : null}
      <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink0 }}>{title}</div>
      {description ? (
        <div style={{ fontSize: 13, color: COLORS.ink2, maxWidth: 360 }}>{description}</div>
      ) : null}
      {action ? <div style={{ marginTop: 4 }}>{action}</div> : null}
    </div>
  );
}
