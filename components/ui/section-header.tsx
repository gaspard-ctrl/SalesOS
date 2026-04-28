import * as React from "react";

export function SectionHeader({
  title,
  right,
  className = "",
  style,
}: {
  title: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`ds-section-header ${className}`.trim()} style={style}>
      <span>{title}</span>
      {right ? <span style={{ display: "inline-flex", gap: 6 }}>{right}</span> : null}
    </div>
  );
}
