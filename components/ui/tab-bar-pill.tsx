import * as React from "react";
import type { TabItem } from "./tab-bar";

export function TabBarPill({
  tabs,
  active,
  onChange,
  className = "",
  style,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`ds-tab-bar-pill ${className}`.trim()} style={style} role="tablist">
      {tabs
        .filter((t) => !t.hidden)
        .map((t) => {
          const Icon = t.icon;
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              disabled={t.disabled}
              onClick={() => onChange(t.key)}
              className={`ds-tab-pill ${isActive ? "ds-tab-pill-active" : ""}`.trim()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                ...(t.disabled ? { opacity: 0.4, cursor: "not-allowed" } : {}),
              }}
            >
              {Icon ? <Icon size={13} /> : null}
              <span>{t.label}</span>
              {t.badge ? <span style={{ marginLeft: 4 }}>{t.badge}</span> : null}
            </button>
          );
        })}
    </div>
  );
}
