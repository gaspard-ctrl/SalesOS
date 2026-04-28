import * as React from "react";

export function ListItem({
  active = false,
  onClick,
  left,
  right,
  className = "",
  style,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  left?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={`ds-list-row ${active ? "ds-list-row-active" : ""} ${className}`.trim()}
      style={style}
    >
      {left && <div style={{ flexShrink: 0 }}>{left}</div>}
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {right && <div style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>{right}</div>}
    </div>
  );
}
