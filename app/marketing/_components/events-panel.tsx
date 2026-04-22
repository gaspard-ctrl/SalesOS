"use client";

import { useEffect, useState } from "react";
import { Trash2, Plus, X, CalendarDays } from "lucide-react";
import { useMarketingEvents } from "@/lib/hooks/use-marketing";
import type { MarketingEvent, MarketingEventType } from "@/lib/marketing-types";

const TYPE_META: Record<MarketingEventType, { label: string; color: string; background: string }> = {
  salon:              { label: "Salon",         color: "#f59e0b", background: "#fff7ed" },
  linkedin_pro:       { label: "LinkedIn Pro",  color: "#3b82f6", background: "#eff6ff" },
  linkedin_perso:     { label: "LinkedIn Perso", color: "#8b5cf6", background: "#f5f3ff" },
  nurturing_campaign: { label: "Nurturing",     color: "#14b8a6", background: "#f0fdfa" },
};

function todayISO(): string {
  const d = new Date();
  return d.toLocaleDateString("fr-CA"); // YYYY-MM-DD
}

/**
 * Small trigger button — shows "Events (N)" and opens the modal on click.
 * Mount this wherever you want the entry point (e.g. chart header).
 */
export function EventsButton() {
  const { events } = useMarketingEvents();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 transition-colors"
        style={{ background: "#fafafa", color: "#444", border: "1px solid #e5e5e5" }}
      >
        <CalendarDays size={13} />
        Events
        {events.length > 0 && (
          <span
            className="text-[10px] font-semibold rounded-full px-1.5"
            style={{ background: "#f01563", color: "#fff", lineHeight: "16px", minWidth: 16, textAlign: "center" }}
          >
            {events.length}
          </span>
        )}
      </button>
      {open && <EventsModal onClose={() => setOpen(false)} />}
    </>
  );
}

function EventsModal({ onClose }: { onClose: () => void }) {
  const { events, addEvent, deleteEvent, isLoading } = useMarketingEvents();
  const [date, setDate] = useState<string>(todayISO());
  const [type, setType] = useState<MarketingEventType>("salon");
  const [label, setLabel] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) {
      setFormError("Label requis");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await addEvent({ event_date: date, event_type: type, label: label.trim() });
      setLabel("");
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteEvent(id);
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(17,17,17,0.4)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="rounded-xl overflow-hidden w-full max-w-xl shadow-xl"
        style={{ background: "#fff", border: "1px solid #eeeeee" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: "#f9f9f9", borderBottom: "1px solid #eeeeee" }}>
          <div>
            <h3 className="font-semibold text-sm" style={{ color: "#111" }}>Marketing events</h3>
            <p className="text-[11px]" style={{ color: "#888" }}>
              Salons & posts LinkedIn — apparaissent comme des points colorés sur le graph Traffic.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors"
            style={{ color: "#888" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#eeeeee"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid #f5f5f5" }}>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg outline-none"
            style={{ border: "1px solid #e5e5e5", background: "#fafafa", color: "#111" }}
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as MarketingEventType)}
            className="text-xs px-3 py-1.5 rounded-lg outline-none"
            style={{ border: "1px solid #e5e5e5", background: "#fafafa", color: "#111" }}
          >
            {(Object.keys(TYPE_META) as MarketingEventType[]).map((t) => (
              <option key={t} value={t}>{TYPE_META[t].label}</option>
            ))}
          </select>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex. Salon VivaTech, Post IA et coaching…"
            className="text-xs px-3 py-1.5 rounded-lg outline-none flex-1 min-w-[200px]"
            style={{ border: "1px solid #e5e5e5", background: "#fafafa", color: "#111" }}
          />
          <button
            type="submit"
            disabled={submitting}
            className="text-xs font-medium px-3 py-1.5 rounded-lg inline-flex items-center gap-1 disabled:opacity-50"
            style={{ background: "#f01563", color: "#fff" }}
          >
            <Plus size={13} />
            Ajouter
          </button>
        </form>

        {formError && (
          <div className="px-4 py-2 text-xs" style={{ background: "#fef2f2", color: "#dc2626" }}>
            {formError}
          </div>
        )}

        <div className="max-h-[420px] overflow-y-auto">
          {isLoading ? (
            <div className="px-4 py-6 text-xs text-center" style={{ color: "#aaa" }}>Chargement…</div>
          ) : events.length === 0 ? (
            <div className="px-4 py-6 text-xs text-center" style={{ color: "#aaa" }}>
              Aucun event — ajoute un salon ou un post LinkedIn pour commencer.
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {events.map((ev) => (
                  <EventRow key={ev.id} ev={ev} onDelete={handleDelete} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function EventRow({ ev, onDelete }: { ev: MarketingEvent; onDelete: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const meta = TYPE_META[ev.event_type];
  const formattedDate = new Date(ev.event_date + "T12:00:00").toLocaleDateString("fr-FR", {
    day: "numeric", month: "short", year: "numeric",
  });
  return (
    <tr style={{ borderBottom: "1px solid #f5f5f5" }}>
      <td className="px-4 py-2.5" style={{ color: "#555", width: 110, fontSize: 12 }}>{formattedDate}</td>
      <td className="px-2 py-2.5" style={{ width: 120 }}>
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{ background: meta.background, color: meta.color }}
        >
          {meta.label}
        </span>
      </td>
      <td className="px-2 py-2.5 text-[13px]" style={{ color: "#111" }}>{ev.label}</td>
      <td className="px-4 py-2.5 text-right" style={{ width: 60 }}>
        {confirming ? (
          <div className="flex items-center gap-1 justify-end">
            <button
              onClick={() => onDelete(ev.id)}
              className="text-[10px] font-medium px-2 py-0.5 rounded"
              style={{ background: "#fef2f2", color: "#dc2626" }}
            >
              Confirmer
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-[10px] font-medium px-2 py-0.5 rounded"
              style={{ background: "#f5f5f5", color: "#666" }}
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="inline-flex items-center justify-center p-1 rounded transition-colors"
            style={{ color: "#bbb" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#dc2626"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#bbb"; }}
            aria-label="Supprimer"
          >
            <Trash2 size={14} />
          </button>
        )}
      </td>
    </tr>
  );
}
