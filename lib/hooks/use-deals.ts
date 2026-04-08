import useSWR from "swr";
import type { DealScore } from "@/lib/deal-scoring";

interface Deal {
  id: string;
  dealname: string;
  dealstage: string;
  amount: string;
  closedate: string;
  probability: string;
  ownerId: string;
  ownerName: string;
  lastContacted: string;
  lastModified: string;
  numContacts: number;
  dealType: string;
  score: DealScore | null;
  reasoning: string | null;
  next_action: string | null;
  scoredAt: string | null;
  qualification: Record<string, string | null> | null;
}

interface Stage {
  id: string;
  label: string;
  order: number;
  probability: number | null;
}

interface DealsResponse {
  stages: Stage[];
  deals: Deal[];
  pipelineTotal: number;
  weightedTotal: number;
  myOwnerId: string | null;
}

export function useDeals(searchQuery: string, ownerFilter: "mine" | "all") {
  const params = new URLSearchParams();
  if (searchQuery) params.set("q", searchQuery);
  if (ownerFilter === "all") params.set("owner", "all");
  const key = `/api/deals/list?${params.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<DealsResponse>(key, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  return {
    stages: data?.stages ?? [] as Stage[],
    deals: data?.deals ?? [] as Deal[],
    pipelineTotal: data?.pipelineTotal ?? 0,
    weightedTotal: data?.weightedTotal ?? 0,
    myOwnerId: data?.myOwnerId ?? null,
    isLoading,
    error: error ? (error instanceof Error ? error.message : "Erreur de chargement") : "",
    reload: () => mutate(),
  };
}
