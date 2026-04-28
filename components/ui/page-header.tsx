import * as React from "react";
import { COLORS } from "@/lib/design/tokens";

export function PageHeader({
  title,
  subtitle,
  actions,
  tabs,
  sticky = false,
  className = "",
  style,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
  sticky?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <header
      className={className}
      style={{
        position: sticky ? "sticky" : "static",
        top: sticky ? 0 : undefined,
        zIndex: sticky ? 20 : undefined,
        background: COLORS.bgCard,
        borderBottom: `1px solid ${COLORS.line}`,
        padding: "12px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        ...style,
      }}
    >
      {(title || actions) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            {title ? (
              <h1
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: COLORS.ink0,
                  margin: 0,
                  letterSpacing: "-0.01em",
                }}
              >
                {title}
              </h1>
            ) : null}
            {subtitle ? (
              <span style={{ fontSize: 12, color: COLORS.ink2 }}>{subtitle}</span>
            ) : null}
          </div>
          {actions ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              {actions}
            </div>
          ) : null}
        </div>
      )}
      {tabs ? <div>{tabs}</div> : null}
    </header>
  );
}
