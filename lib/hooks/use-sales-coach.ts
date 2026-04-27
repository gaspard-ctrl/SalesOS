import useSWR from "swr";
import type { SalesCoachAnalysis, MeetingKind } from "@/lib/guides/sales-coach";
import type { DealSnapshot } from "@/lib/hubspot";

const SWR_OPTS = { revalidateOnFocus: false, dedupingInterval: 15_000 } as const;

export type SalesCoachStatus = "pending" | "analyzing" | "done" | "error" | "skipped";

export type MeetingParticipant = {
  name: string | null;
  email: string;
  attended: boolean | null;
};

export interface SalesCoachListItem {
  id: string;
  claap_recording_id: string;
  user_id: string | null;
  recorder_email: string;
  hubspot_deal_id: string | null;
  meeting_title: string | null;
  meeting_started_at: string | null;
  meeting_type: string | null;
  meeting_kind: MeetingKind | null;
  status: SalesCoachStatus;
  score_global: number | null;
  slack_sent_at: string | null;
  created_at: string;
  error_message: string | null;
  participants: MeetingParticipant[] | null;
  primary_contact: { name: string; email: string } | null;
}

export interface SalesCoachDetail extends SalesCoachListItem {
  transcript_text: string | null;
  analysis: SalesCoachAnalysis | null;
  deal_snapshot: DealSnapshot | null;
  claap_event_id: string | null;
  updated_at: string;
}

interface ListResponse {
  analyses: SalesCoachListItem[];
  isAdmin: boolean;
}

export function useSalesCoachList(
  ownerFilter: "mine" | "all" = "mine",
  dateRange?: { from?: string; to?: string },
) {
  const params = new URLSearchParams();
  if (ownerFilter === "all") params.set("owner", "all");
  if (dateRange?.from) params.set("from", dateRange.from);
  if (dateRange?.to) params.set("to", dateRange.to);
  const qs = params.toString();
  const key = `/api/sales-coach/list${qs ? `?${qs}` : ""}`;
  const { data, error, isLoading, mutate } = useSWR<ListResponse>(key, {
    ...SWR_OPTS,
    // Poll every 5s while any row is still pending/analyzing — stops polling
    // once all rows reach a terminal state (done/error/skipped).
    refreshInterval: (latest) => {
      const hasInFlight = (latest?.analyses ?? []).some(
        (a) => a.status === "pending" || a.status === "analyzing",
      );
      return hasInFlight ? 5000 : 0;
    },
  });
  return {
    analyses: data?.analyses ?? [],
    isAdmin: data?.isAdmin ?? false,
    isLoading,
    error: error ? (error instanceof Error ? error.message : "Erreur de chargement") : "",
    reload: () => mutate(),
  };
}

interface DetailResponse {
  analysis: SalesCoachDetail;
}

export function useSalesCoachDetail(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<DetailResponse>(
    id ? `/api/sales-coach/${id}` : null,
    {
      ...SWR_OPTS,
      refreshInterval: (latest) => {
        const s = latest?.analysis?.status;
        return s === "pending" || s === "analyzing" ? 5000 : 0;
      },
    },
  );
  return {
    detail: data?.analysis ?? null,
    isLoading,
    error: error ? (error instanceof Error ? error.message : "Erreur de chargement") : "",
    reload: () => mutate(),
  };
}

export function useSalesCoachDealHistory(dealId: string | null, excludeId?: string | null) {
  const key = dealId ? `/api/sales-coach/list?deal=${encodeURIComponent(dealId)}&owner=all` : null;
  const { data, error, isLoading } = useSWR<ListResponse>(key, SWR_OPTS);
  const analyses = (data?.analyses ?? []).filter((a) => !excludeId || a.id !== excludeId);
  return {
    history: analyses,
    isLoading,
    error: error ? (error instanceof Error ? error.message : "Erreur de chargement") : "",
  };
}
