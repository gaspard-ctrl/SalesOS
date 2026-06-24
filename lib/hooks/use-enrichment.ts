import useSWR from "swr";
import type { EnrichmentList, EnrichmentProfile, HubspotCriteria } from "@/lib/intel-types";

interface ListsResponse {
  lists: EnrichmentList[];
  error?: string;
}

export function useEnrichmentLists() {
  const { data, error, isLoading, mutate } = useSWR<ListsResponse>("/api/intel/enrich/lists", {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });
  // Le fetcher global ne throw pas : une erreur arrive dans `data.error`, pas
  // dans `error`. On lit les deux pour ne pas masquer un 500 derrière un faux vide.
  return {
    lists: data?.lists ?? [],
    isLoading,
    error: data?.error ?? (error instanceof Error ? error.message : ""),
    reload: () => mutate(),
  };
}

export async function searchHubspot(
  criteria: HubspotCriteria,
): Promise<{ profiles: EnrichmentProfile[]; hasMore?: boolean }> {
  const r = await fetch("/api/intel/enrich/hubspot-search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(criteria),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "HubSpot error");
  return data;
}

export async function saveList(input: {
  id?: string;
  name: string;
  source: "hubspot" | "mixed";
  criteria?: unknown;
  results: EnrichmentProfile[];
}): Promise<EnrichmentList> {
  const r = await fetch("/api/intel/enrich/lists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "Error");
  return data.list as EnrichmentList;
}

export async function deleteList(id: string) {
  const r = await fetch(`/api/intel/enrich/lists/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Delete failed");
}
