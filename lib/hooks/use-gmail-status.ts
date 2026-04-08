import useSWR from "swr";

export function useGmailStatus() {
  const { data, isLoading } = useSWR<{ connected: boolean }>("/api/gmail/status");
  return {
    gmailConnected: data?.connected ?? false,
    isLoading,
  };
}
