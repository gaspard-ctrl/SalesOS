"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crosshair, Target, type LucideIcon } from "lucide-react";

type Mode = { href: string; label: string; icon: LucideIcon };

const MODES: Mode[] = [
  { href: "/prospecting", label: "Single", icon: Crosshair },
  { href: "/mass-prospection", label: "Mass", icon: Target },
];

/** Segmented toggle to switch between single (1-to-1) and mass prospecting. */
export function ProspectingModeToggle() {
  const pathname = usePathname();
  return (
    <div
      className="inline-flex items-center gap-0.5 p-0.5 rounded-lg shrink-0"
      style={{ background: "#f5f5f5" }}
      role="tablist"
      aria-label="Prospecting mode"
    >
      {MODES.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            role="tab"
            aria-selected={active}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
            style={
              active
                ? { background: "#fff", color: "#f01563", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }
                : { background: "transparent", color: "#666" }
            }
          >
            <Icon size={14} />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
