import * as React from "react";
import { COLORS } from "@/lib/design/tokens";

type IconType = React.ComponentType<{ size?: number | string; className?: string; strokeWidth?: number }>;

export const IconButton = React.forwardRef<
  HTMLButtonElement,
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
    icon: IconType;
    label?: React.ReactNode;
    size?: "sm" | "md" | "lg";
    variant?: "outline" | "ghost" | "brand" | "danger";
    iconSize?: number;
  }
>(function IconButton(
  { icon: Icon, label, size = "md", variant = "outline", iconSize, className = "", style, ...rest },
  ref
) {
  const dim = size === "sm" ? 28 : size === "lg" ? 40 : 32;
  const isq = label ? "auto" : dim;
  const padX = label ? 12 : 0;
  const isz = iconSize ?? (size === "sm" ? 14 : size === "lg" ? 18 : 16);

  let bg: string = COLORS.bgCard;
  let fg: string = COLORS.ink2;
  let border: string = COLORS.lineStrong;
  let hoverBg: string = COLORS.brandTintSoft;
  let hoverFg: string = COLORS.brand;
  let hoverBorder: string = COLORS.brand;

  if (variant === "ghost") {
    bg = "transparent";
    border = "transparent";
  } else if (variant === "brand") {
    bg = COLORS.brand;
    fg = "#fff";
    border = COLORS.brand;
    hoverBg = COLORS.brandDark;
    hoverFg = "#fff";
    hoverBorder = COLORS.brandDark;
  } else if (variant === "danger") {
    fg = COLORS.err;
    hoverBg = COLORS.errBg;
    hoverFg = COLORS.err;
    hoverBorder = COLORS.err;
  }

  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: label ? 6 : 0,
    width: isq as number | "auto",
    height: dim,
    padding: label ? `0 ${padX}px` : 0,
    borderRadius: 6,
    background: bg,
    color: fg,
    border: `1px solid ${border}`,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    transition: "all 0.15s",
    flexShrink: 0,
    ...style,
  };

  return (
    <button
      ref={ref}
      type="button"
      className={className}
      style={baseStyle}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.background = hoverBg;
        el.style.color = hoverFg;
        el.style.borderColor = hoverBorder;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.background = bg;
        el.style.color = fg;
        el.style.borderColor = border;
      }}
      {...rest}
    >
      <Icon size={isz} />
      {label ? <span>{label}</span> : null}
    </button>
  );
});
