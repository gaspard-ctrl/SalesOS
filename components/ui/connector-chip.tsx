import * as React from "react";

type IconType = React.ComponentType<{ size?: number | string; className?: string; strokeWidth?: number }>;

export function ConnectorChip({
  icon: Icon,
  label,
  className = "",
  style,
}: {
  icon?: IconType;
  label: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span className={`ds-connector-chip ${className}`.trim()} style={style}>
      {Icon ? <Icon size={12} /> : null}
      <span>{label}</span>
    </span>
  );
}
