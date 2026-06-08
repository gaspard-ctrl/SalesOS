"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Search,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import { COLORS } from "@/lib/design/tokens";
import type { MeetingParticipant } from "@/lib/hooks/use-sales-coach";
import { useToast } from "@/components/ui/toast";

type DealSearchResult = {
  id: string;
  name: string;
  stage_label: string | null;
  pipeline_label: string | null;
  amount: number | null;
  close_date: string | null;
  owner_name: string | null;
  is_closed_won: boolean;
  is_closed: boolean;
};

interface Props {
  analysisId: string;
  meetingTitle: string | null;
  meetingStartedAt: string | null;
  recorderEmail: string | null;
  participants: MeetingParticipant[] | null;
  onResolved: () => void;
  onDeleted: () => void;
}

function formatAmount(amount: number | null): string | null {
  if (amount == null) return null;
  return `${amount.toLocaleString("en-GB")}€`;
}

function formatCloseDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB");
}

export function ManualDealResolution({
  analysisId,
  meetingTitle,
  meetingStartedAt,
  recorderEmail,
  participants,
  onResolved,
  onDeleted,
}: Props) {
  const [choice, setChoice] = useState<"unset" | "yes" | "no">("unset");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DealSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<DealSearchResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  // Autocomplete debouncé : déclenche la recherche 250ms après la dernière
  // frappe pour éviter de spammer HubSpot. Annule la requête en cours quand
  // l'utilisateur tape plus, pour ne pas afficher de résultats périmés.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(
          `/api/hubspot/deals/search?q=${encodeURIComponent(q)}`,
          { signal: ctrl.signal },
        );
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data = (await res.json()) as { deals?: DealSearchResult[] };
        setResults(data.deals ?? []);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setResults([]);
        }
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  async function submitDeal() {
    if (!selectedDeal) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/sales-coach/${analysisId}/resolve-deal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId: selectedDeal.id }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Error while linking the deal");
      onResolved();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Error");
      setSubmitting(false);
    }
  }

  async function confirmNoDeal() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/sales-coach/${analysisId}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Error while deleting");
      toast("Meeting deleted.", "success");
      onDeleted();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error", "error");
      setDeleting(false);
    }
  }

  // Lance l'analyse sans deal HubSpot. La route passe la ligne en `pending` et
  // déclenche l'analyse ; onResolved() revalide le SWR → l'écran bascule sur
  // l'état analyzing/pending.
  async function analyzeWithoutDeal() {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/sales-coach/${analysisId}/analyze-without-deal`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Error while starting the analysis");
      toast("Analysis started without a deal.", "success");
      onResolved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error", "error");
      setAnalyzing(false);
    }
  }

  const dateStr = meetingStartedAt
    ? new Date(meetingStartedAt).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })
    : null;

  const participantList = (participants ?? [])
    .map((p) => p.name?.trim() || p.email)
    .filter((s): s is string => !!s);

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: COLORS.bgPage }}>
      <div style={{ padding: "32px 24px", maxWidth: 720, margin: "0 auto", width: "100%" }}>
        {/* Bandeau d'info sur le meeting */}
        <div
          style={{
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: 12,
            padding: "16px 18px",
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <HelpCircle size={16} style={{ color: "#c2410c" }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#9a3412" }}>
              No HubSpot deal found for this meeting
            </span>
          </div>
          <p style={{ fontSize: 13, color: "#7c2d12", margin: 0, lineHeight: 1.5 }}>
            The automatic resolver could not link this meeting to a deal (participant emails,
            domain, title, semantic search: all empty). Indicate whether this meeting is linked to a deal
            to start the analysis, or delete it.
          </p>

          {/* Récap meeting */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #fed7aa", fontSize: 12, color: "#7c2d12", lineHeight: 1.7 }}>
            <div style={{ fontWeight: 600 }}>{meetingTitle ?? "Untitled"}</div>
            {dateStr && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Calendar size={11} /> {dateStr}
              </div>
            )}
            {recorderEmail && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: dateStr ? 12 : 0 }}>
                <User size={11} /> Recorder: {recorderEmail}
              </div>
            )}
            {participantList.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <strong>External participants:</strong> {participantList.join(", ")}
              </div>
            )}
          </div>
        </div>

        {/* Question Oui/Non */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: COLORS.ink0, marginBottom: 12 }}>
            Is this meeting linked to a deal?
          </h3>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setChoice("yes")}
              disabled={submitting || deleting}
              style={{
                flex: 1,
                padding: "10px 16px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: submitting || deleting ? "not-allowed" : "pointer",
                background: choice === "yes" ? COLORS.brand : "#fff",
                color: choice === "yes" ? "#fff" : COLORS.ink0,
                border: `1px solid ${choice === "yes" ? COLORS.brand : COLORS.lineStrong}`,
                transition: "all 0.15s",
              }}
            >
              Yes - link a deal
            </button>
            <button
              onClick={() => { setChoice("no"); confirmNoDeal(); }}
              disabled={submitting || deleting}
              style={{
                flex: 1,
                padding: "10px 16px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: submitting || deleting ? "not-allowed" : "pointer",
                background: "#fff",
                color: "#dc2626",
                border: "1px solid #fecaca",
                transition: "all 0.15s",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Trash2 size={14} />
              {deleting ? "Deleting…" : "No - delete"}
            </button>
          </div>

          {/* Alternative : analyser sans deal */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: 14 }}>
            <span style={{ fontSize: 12, color: COLORS.ink1 }}>or</span>
            <button
              onClick={analyzeWithoutDeal}
              disabled={submitting || deleting || analyzing}
              style={{
                width: "100%",
                padding: "10px 16px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: submitting || deleting || analyzing ? "not-allowed" : "pointer",
                background: "#fff",
                color: COLORS.ink0,
                border: `1px solid ${COLORS.lineStrong}`,
                transition: "all 0.15s",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {analyzing ? "Starting…" : "Analyze anyway (no deal)"}
            </button>
          </div>
        </div>

        {/* Autocomplete (choice = yes) */}
        {choice === "yes" && (
          <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.ink1, display: "block", marginBottom: 8 }}>
              HubSpot deal name
            </label>
            <div style={{ position: "relative", marginBottom: 12 }}>
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: COLORS.ink3,
                  pointerEvents: "none",
                }}
              />
              <input
                type="text"
                placeholder="Type the deal name…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedDeal(null);
                  setSubmitError(null);
                }}
                autoFocus
                style={{
                  width: "100%",
                  paddingLeft: 36,
                  paddingRight: 36,
                  paddingTop: 9,
                  paddingBottom: 9,
                  fontSize: 13,
                  borderRadius: 8,
                  border: `1px solid ${COLORS.line}`,
                  background: COLORS.bgSoft,
                  outline: "none",
                  color: COLORS.ink0,
                }}
              />
              {searching && (
                <Loader2
                  size={14}
                  className="animate-spin"
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: COLORS.ink3,
                  }}
                />
              )}
            </div>

            {/* Liste résultats */}
            {query.trim().length >= 2 && !selectedDeal && (
              <div
                style={{
                  maxHeight: 320,
                  overflowY: "auto",
                  border: `1px solid ${COLORS.line}`,
                  borderRadius: 8,
                  background: "#fff",
                }}
              >
                {!searching && results.length === 0 && (
                  <div style={{ padding: "12px 14px", fontSize: 12, color: COLORS.ink3, textAlign: "center" }}>
                    No deal found for &laquo; {query.trim()} &raquo;.
                  </div>
                )}
                {results.map((d) => {
                  const amount = formatAmount(d.amount);
                  const close = formatCloseDate(d.close_date);
                  const isCustomer = d.is_closed_won;
                  return (
                    <button
                      key={d.id}
                      onClick={() => setSelectedDeal(d)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 14px",
                        borderBottom: `1px solid ${COLORS.line}`,
                        background: "#fff",
                        cursor: "pointer",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.bgSoft)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <Building2 size={13} style={{ color: COLORS.brand, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink0, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {d.name || `Deal ${d.id}`}
                        </span>
                        {isCustomer && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "1px 6px",
                              borderRadius: 999,
                              background: "#dcfce7",
                              color: "#166534",
                              flexShrink: 0,
                            }}
                          >
                            CLIENT
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: COLORS.ink2, display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {d.stage_label && <span>{d.stage_label}</span>}
                        {d.pipeline_label && <span style={{ color: COLORS.ink3 }}>· {d.pipeline_label}</span>}
                        {amount && <span>· {amount}</span>}
                        {close && <span>· {close}</span>}
                        {d.owner_name && <span>· {d.owner_name}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Carte deal sélectionné + submit */}
            {selectedDeal && (
              <div
                style={{
                  marginTop: 4,
                  padding: 14,
                  borderRadius: 10,
                  background: "#f0fdf4",
                  border: "1px solid #86efac",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <CheckCircle2 size={14} style={{ color: "#166534" }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#166534" }}>Selected deal</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink0, marginBottom: 4 }}>
                  {selectedDeal.name || `Deal ${selectedDeal.id}`}
                </div>
                <div style={{ fontSize: 11, color: COLORS.ink2, display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  {selectedDeal.stage_label && <span>{selectedDeal.stage_label}</span>}
                  {formatAmount(selectedDeal.amount) && <span>· {formatAmount(selectedDeal.amount)}</span>}
                  {selectedDeal.owner_name && <span>· {selectedDeal.owner_name}</span>}
                  {selectedDeal.is_closed_won && (
                    <span style={{ color: "#166534", fontWeight: 600 }}>· client (closed-won)</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={submitDeal}
                    disabled={submitting}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      background: COLORS.brand,
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 600,
                      border: "none",
                      cursor: submitting ? "not-allowed" : "pointer",
                      opacity: submitting ? 0.6 : 1,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {submitting && <Loader2 size={13} className="animate-spin" />}
                    {submitting ? "Linking…" : "Link and start the analysis"}
                  </button>
                  <button
                    onClick={() => setSelectedDeal(null)}
                    disabled={submitting}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      background: "#fff",
                      color: COLORS.ink2,
                      fontSize: 13,
                      fontWeight: 500,
                      border: `1px solid ${COLORS.lineStrong}`,
                      cursor: submitting ? "not-allowed" : "pointer",
                    }}
                  >
                    Change
                  </button>
                </div>
                {submitError && (
                  <div style={{ marginTop: 10, fontSize: 12, color: COLORS.err, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <AlertCircle size={12} />
                    {submitError}
                  </div>
                )}
              </div>
            )}

            {query.trim().length > 0 && query.trim().length < 2 && (
              <div style={{ fontSize: 11, color: COLORS.ink3 }}>
                Type at least 2 characters to search.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
