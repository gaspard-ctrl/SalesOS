import * as React from "react";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({
  className = "",
  hoverable = false,
  padding = 16,
  style,
  children,
  ...rest
}: DivProps & { hoverable?: boolean; padding?: number | string }) {
  return (
    <div
      className={`ds-card ${hoverable ? "ds-card-hover" : ""} ${className}`.trim()}
      style={{ padding, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className = "",
  style,
  children,
  ...rest
}: DivProps) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        marginBottom: 12,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardBody({
  className = "",
  style,
  children,
  ...rest
}: DivProps) {
  return (
    <div className={className} style={style} {...rest}>
      {children}
    </div>
  );
}
