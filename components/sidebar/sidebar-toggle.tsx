"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { useSidebar } from "./sidebar-context";

/**
 * Floating chevron button shown only when the sidebar is collapsed,
 * letting the user re-expand without going to the sidebar's own button.
 * Hidden on mobile (sidebar uses drawer there).
 */
export function SidebarFloatingToggle() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();

  if (pathname?.startsWith("/pokedex")) return null;
  if (!collapsed) return null;

  return (
    <button
      type="button"
      aria-label="Déplier la sidebar"
      onClick={toggle}
      className="hidden md:inline-flex"
      style={{
        position: "fixed",
        left: 8,
        bottom: 12,
        zIndex: 30,
        width: 28,
        height: 28,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        background: "#fff",
        border: "1px solid #e5e5e5",
        color: "#666",
        cursor: "pointer",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#f01563";
        e.currentTarget.style.color = "#f01563";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#e5e5e5";
        e.currentTarget.style.color = "#666";
      }}
    >
      <ChevronRight size={14} />
    </button>
  );
}
