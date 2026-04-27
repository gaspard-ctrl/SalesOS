#!/usr/bin/env bash
# Simulate a Claap webhook POST for local testing.
# Prereqs: `npm run dev` is running + users table has a row matching RECORDER_EMAIL.

set -e

# ── Load .env.local to get CLAAP_WEBHOOK_SECRET ─────────────────────
if [ -f .env.local ]; then
  export $(grep -E '^(CLAAP_WEBHOOK_SECRET)=' .env.local | xargs)
fi

HOST="${HOST:-http://localhost:3000}"
RECORDER_EMAIL="${RECORDER_EMAIL:-gaspard@coachello.io}"
RECORDING_ID="rec_test_$(date +%s)"  # unique ID so the row is fresh each run
DEAL_ID="${DEAL_ID:-12345678}"

echo "→ Sending webhook to $HOST/api/webhooks/claap"
echo "  recorder: $RECORDER_EMAIL"
echo "  recording_id: $RECORDING_ID"
echo ""

curl -i -X POST "$HOST/api/webhooks/claap" \
  -H "Content-Type: application/json" \
  -H "x-claap-webhook-secret: $CLAAP_WEBHOOK_SECRET" \
  -d '{
    "eventId": "evt_'"$RECORDING_ID"'",
    "event": {
      "type": "recording_added",
      "recording": {
        "id": "'"$RECORDING_ID"'",
        "title": "Discovery Acme Corp — test local",
        "createdAt": "2026-04-21T10:00:00Z",
        "meeting": {
          "type": "external",
          "startingAt": "2026-04-21T10:00:00Z",
          "endingAt": "2026-04-21T10:45:00Z",
          "participants": [
            {"name": "Gaspard", "email": "'"$RECORDER_EMAIL"'", "attended": true},
            {"name": "Jean Dupont", "email": "jean@acme.com", "attended": true}
          ]
        },
        "deal": {"id": "'"$DEAL_ID"'", "name": "Acme Corp"},
        "transcripts": [
          {"isActive": true, "textUrl": "'"$HOST"'/test-transcript.txt", "langIso2": "fr"}
        ],
        "recorder": {"email": "'"$RECORDER_EMAIL"'", "name": "Gaspard", "attended": true}
      }
    }
  }'

echo ""
echo ""
echo "→ Webhook accepted. Analysis is running in background."
echo "  Watch dev server logs for [sales-coach/analyze/...]."
echo "  Then open: $HOST/sales-coach"
