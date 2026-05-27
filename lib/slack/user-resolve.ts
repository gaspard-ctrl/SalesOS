import { db } from "@/lib/db";
import { getUserInfo } from "./api";

type ResolvedUser = { id: string; email: string; name: string | null };

/**
 * Résout un Slack user_id vers un DbUser SalesOS.
 *
 * Stratégie de matching (en cascade) :
 *  1. `slack_display_name` (champ explicite configuré par le user dans /settings,
 *     comparé au display_name renvoyé par Slack users.info)
 *  2. Email Slack ↔ `users.email` (fallback si display_name absent ou non matché)
 *
 * Les emails Slack peuvent diverger de l'email SalesOS (alias, +tags, domaine
 * personnel vs pro), donc slack_display_name est plus fiable quand il est rempli.
 */
export async function resolveSlackUser(slackUserId: string): Promise<ResolvedUser | null> {
  let info: Awaited<ReturnType<typeof getUserInfo>>;
  try {
    info = await getUserInfo(slackUserId);
  } catch (e) {
    console.error("[slack/user-resolve] users.info failed", { slackUserId, error: e });
    return null;
  }

  const displayName = info.profile?.display_name?.trim() || info.profile?.real_name?.trim() || null;
  const email = info.profile?.email?.toLowerCase() ?? null;

  if (displayName) {
    const { data, error } = await db
      .from("users")
      .select("id, email, name")
      .ilike("slack_display_name", displayName)
      .limit(2);
    if (error) {
      console.error("[slack/user-resolve] db query failed (display_name)", { displayName, error });
    } else if (data && data.length === 1) {
      return data[0] as ResolvedUser;
    } else if (data && data.length > 1) {
      console.error("[slack/user-resolve] multiple users match slack_display_name", { displayName });
    }
  }

  if (email) {
    const { data, error } = await db
      .from("users")
      .select("id, email, name")
      .ilike("email", email)
      .limit(2);
    if (error) {
      console.error("[slack/user-resolve] db query failed (email)", { email, error });
      return null;
    }
    if (data && data.length === 1) return data[0] as ResolvedUser;
    if (data && data.length > 1) {
      console.error("[slack/user-resolve] multiple users match email", { email });
      return null;
    }
  }

  console.error("[slack/user-resolve] no match", { slackUserId, displayName, email });
  return null;
}
