"use client";

import { useState, useEffect } from "react";

export function HubspotOwnerInput({ initialValue }: { initialValue: string | null }) {
  const [value, setValue] = useState(initialValue ?? "");
  const [saved, setSaved] = useState(false);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    if (!initialValue) {
      setDetecting(true);
      fetch("/api/hubspot/auto-link-owner")
        .then((r) => r.json())
        .then(({ hubspotOwnerId }) => {
          if (hubspotOwnerId) setValue(hubspotOwnerId);
        })
        .catch(() => {})
        .finally(() => setDetecting(false));
    }
  }, [initialValue]);

  async function save(val: string) {
    await fetch("/api/user/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hubspot_owner_id: val || null }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 mt-3">
      <input
        type="text"
        value={detecting ? "Détection…" : value}
        readOnly={detecting}
        placeholder="ex: 12345678"
        className="text-xs px-3 py-1.5 border rounded-lg outline-none"
        style={{ borderColor: "#e5e5e5", color: "#555", width: 200, background: detecting ? "#f9f9f9" : "#fff" }}
        onChange={(e) => setValue(e.target.value)}
        onBlur={(e) => save(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      />
      {saved && <span className="text-xs" style={{ color: "#16a34a" }}>Enregistré</span>}
    </div>
  );
}
