"use client";

import { useState, useEffect } from "react";

export function EditableList({
  initialItems,
  endpoint,
  title,
  description,
  placeholder,
  saveFormat = "guide",
}: {
  initialItems: string[];
  endpoint: string;
  title: string;
  description: string;
  placeholder: string;
  saveFormat?: "guide" | "items";
}) {
  const [items, setItems] = useState<string[]>(initialItems);
  useEffect(() => { setItems(initialItems); }, [initialItems]);
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function saveList(updated: string[]) {
    setSaving(true);
    setItems(updated);
    const body = saveFormat === "items"
      ? { items: updated }
      : { content: JSON.stringify(updated) };
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function addItem() {
    const val = newItem.trim();
    if (!val || items.includes(val)) return;
    saveList([...items, val]);
    setNewItem("");
  }

  function removeItem(item: string) {
    saveList(items.filter((i) => i !== item));
  }

  const displayed = expanded ? items : items.slice(0, 10);

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: "#eee", background: "#fff" }}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold" style={{ color: "#111" }}>{title}</p>
        <div className="flex items-center gap-2">
          {saved && <span className="text-[10px]" style={{ color: "#16a34a" }}>Enregistré</span>}
          {saving && <span className="text-[10px]" style={{ color: "#aaa" }}>…</span>}
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#f5f5f5", color: "#888" }}>
            {items.length}
          </span>
        </div>
      </div>
      <p className="text-xs mb-3" style={{ color: "#888" }}>{description}</p>

      <div className="flex gap-2 mb-3">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
          placeholder={placeholder}
          className="flex-1 text-xs px-3 py-1.5 border rounded-lg outline-none"
          style={{ borderColor: "#e5e5e5", color: "#555" }}
        />
        <button
          onClick={addItem}
          disabled={!newItem.trim()}
          className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-30"
          style={{ background: "#f01563", color: "#fff" }}
        >
          Ajouter
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {displayed.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg"
            style={{ background: "#f5f5f5", color: "#555" }}
          >
            {item}
            <button
              onClick={() => removeItem(item)}
              className="ml-0.5 text-[10px] hover:text-red-500"
              style={{ color: "#bbb" }}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {items.length > 10 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] mt-2 font-medium"
          style={{ color: "#f01563" }}
        >
          {expanded ? "Réduire" : `Voir tout (${items.length})`}
        </button>
      )}
    </div>
  );
}
