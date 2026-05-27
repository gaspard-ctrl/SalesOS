import crypto from "crypto";

/**
 * Vérifie la signature HMAC-SHA256 d'une requête Slack.
 * Slack signe chaque event avec SLACK_SIGNING_SECRET et envoie :
 *  - x-slack-request-timestamp
 *  - x-slack-signature (format: v0=hex_hmac)
 *
 * On signe localement `v0:<timestamp>:<raw_body>` avec le signing secret,
 * puis on compare en temps constant. On rejette aussi les requêtes >5min
 * pour bloquer les replays.
 *
 * IMPORTANT : il faut le body brut (text), pas le JSON parsé, sinon le HMAC
 * ne matche pas (espaces, ordre des clés…).
 */
export function verifySlackSignature(args: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
}): boolean {
  const { rawBody, timestamp, signature } = args;
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret || !timestamp || !signature) return false;

  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 60 * 5) return false;

  const base = `v0:${timestamp}:${rawBody}`;
  const expected = `v0=${crypto.createHmac("sha256", secret).update(base).digest("hex")}`;

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
