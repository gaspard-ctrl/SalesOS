"use client";

import { useState } from "react";

export function AlertSettings({ initialDmEnabled }: { initialDmEnabled: boolean }) {
  const [dmEnabled, setDmEnabled] = useState(initialDmEnabled);
  const [saved, setSaved] = useState(false);

  async function toggle() {
    const newVal = !dmEnabled;
    setDmEnabled(newVal);
    await fetch("/api/user/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alert_config: { dm_enabled: newVal } }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-medium" style={{ color: "#555" }}>Recevoir les alertes en DM Slack</p>
        <p className="text-[10px]" style={{ color: "#aaa" }}>
          En plus du canal partagé (configuré par l&apos;admin), recevoir les signaux prioritaires en message privé
        </p>
      </div>
      <div className="flex items-center gap-2">
        {saved && <span className="text-[10px]" style={{ color: "#16a34a" }}>OK</span>}
        <button
          onClick={toggle}
          className="relative w-10 h-5 rounded-full transition-colors"
          style={{ background: dmEnabled ? "#16a34a" : "#e5e5e5" }}
        >
          <span
            className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm"
            style={{ left: dmEnabled ? "22px" : "2px" }}
          />
        </button>
      </div>
    </div>
  );
}
