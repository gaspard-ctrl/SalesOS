import * as React from "react";
import { companyAvatarGradient } from "@/lib/design/tokens";

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const cleaned = name
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-zA-ZÀ-ÿ0-9 ]/g, " ")
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function CompanyAvatar({
  name,
  size = 40,
  rounded = "md",
  override,
}: {
  name: string | null | undefined;
  size?: number;
  rounded?: "sm" | "md" | "lg" | "full";
  override?: { background?: string; color?: string; initials?: string };
}) {
  const grad = companyAvatarGradient(name ?? "?");
  const radius =
    rounded === "full" ? "50%" : rounded === "lg" ? 12 : rounded === "md" ? 10 : 6;
  const ini = override?.initials ?? initials(name);
  const fontSize = size <= 28 ? 11 : size <= 40 ? 13 : size <= 56 ? 16 : 20;
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: override?.background ?? grad.background,
        color: override?.color ?? grad.color,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize,
        letterSpacing: "0.02em",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {ini}
    </div>
  );
}
