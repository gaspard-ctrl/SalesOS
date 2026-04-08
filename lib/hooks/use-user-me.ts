import useSWR from "swr";

interface UserMe {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
  slack_display_name: string | null;
  hubspot_owner_id: string | null;
}

export function useUserMe() {
  const { data, error, isLoading } = useSWR<UserMe>("/api/user/me");
  return {
    user: data ?? null,
    isAdmin: data?.is_admin ?? false,
    slackName: data?.slack_display_name ?? null,
    isLoading,
    error,
  };
}
