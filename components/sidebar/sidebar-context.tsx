"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

type SetCollapsed = (value: boolean, opts?: { user?: boolean }) => void;

type Ctx = {
  collapsed: boolean;
  setCollapsed: SetCollapsed;
  toggle: () => void;
  autoCollapsed: boolean;
};

const SidebarCtx = React.createContext<Ctx | null>(null);

const KEY_PREF = "salesos.sidebar.collapsed";
const KEY_OVERRIDE = "salesos.sidebar.userOverride";
// Pages where the sidebar stays expanded by default. Everywhere else, it
// auto-collapses (CoachelloGPT homepage is the only "expand-by-default" page).
const EXPANDED_PAGES = ["/"];

function isExpandedPath(p: string | null): boolean {
  if (!p) return false;
  return EXPANDED_PAGES.includes(p);
}

type Override = { path: string; collapsed: boolean } | null;

function readOverride(): Override {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY_OVERRIDE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.path === "string") {
      return { path: parsed.path, collapsed: !!parsed.collapsed };
    }
  } catch {}
  return null;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Always start expanded so SSR and client first render match.
  // The effect below resolves the real value (override / EXPANDED_PAGES / pref) at mount.
  const [collapsed, setCollapsedRaw] = React.useState<boolean>(false);

  const [autoCollapsed, setAutoCollapsed] = React.useState(false);

  // Persist global pref on every change, when not driven by auto.
  const setCollapsed: SetCollapsed = React.useCallback(
    (value, opts) => {
      setCollapsedRaw(value);
      if (typeof window === "undefined") return;
      if (opts?.user) {
        try {
          window.localStorage.setItem(KEY_PREF, value ? "1" : "0");
          if (pathname) {
            window.localStorage.setItem(
              KEY_OVERRIDE,
              JSON.stringify({ path: pathname, collapsed: value })
            );
          }
        } catch {}
        setAutoCollapsed(false);
      }
    },
    [pathname]
  );

  // Default behavior: sidebar is collapsed everywhere except on EXPANDED_PAGES
  // (CoachelloGPT homepage). User overrides via the toggle are remembered per path.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const override = readOverride();
    const overrideMatchesPath =
      override && pathname && (override.path === pathname || pathname.startsWith(override.path + "/"));

    if (overrideMatchesPath) {
      setCollapsedRaw(override!.collapsed);
      setAutoCollapsed(false);
      return;
    }

    if (isExpandedPath(pathname)) {
      setCollapsedRaw(false);
      setAutoCollapsed(false);
    } else {
      setCollapsedRaw(true);
      setAutoCollapsed(true);
    }
  }, [pathname]);

  const toggle = React.useCallback(() => {
    setCollapsed(!collapsed, { user: true });
  }, [collapsed, setCollapsed]);

  const value = React.useMemo<Ctx>(
    () => ({ collapsed, setCollapsed, toggle, autoCollapsed }),
    [collapsed, setCollapsed, toggle, autoCollapsed]
  );

  return <SidebarCtx.Provider value={value}>{children}</SidebarCtx.Provider>;
}

export function useSidebar(): Ctx {
  const ctx = React.useContext(SidebarCtx);
  if (!ctx) {
    // Safe fallback for components that render outside the provider (tests/storybook)
    return {
      collapsed: false,
      setCollapsed: () => {},
      toggle: () => {},
      autoCollapsed: false,
    };
  }
  return ctx;
}
