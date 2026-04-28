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
const WIDE_PAGES = [
  "/deals",
  "/sales-coach",
  "/briefing",
  "/prospecting",
  "/mass-prospection",
];

function isWidePath(p: string | null): boolean {
  if (!p) return false;
  return WIDE_PAGES.some((w) => p === w || p.startsWith(w + "/"));
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

  // Initial state: prefer global pref; fallback false (expanded).
  const [collapsed, setCollapsedRaw] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const v = window.localStorage.getItem(KEY_PREF);
      if (v === "1") return true;
      if (v === "0") return false;
    } catch {}
    return false;
  });

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

  // Auto-collapse on wide pages, unless the user overrode this exact path.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const override = readOverride();
    const overrideMatchesPath =
      override && pathname && (override.path === pathname || pathname.startsWith(override.path + "/"));

    if (isWidePath(pathname)) {
      if (overrideMatchesPath) {
        // Respect user choice for this path
        setCollapsedRaw(override!.collapsed);
        setAutoCollapsed(false);
      } else {
        setCollapsedRaw(true);
        setAutoCollapsed(true);
      }
    } else {
      // Outside wide pages: restore global pref
      try {
        const v = window.localStorage.getItem(KEY_PREF);
        setCollapsedRaw(v === "1");
      } catch {
        setCollapsedRaw(false);
      }
      setAutoCollapsed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
