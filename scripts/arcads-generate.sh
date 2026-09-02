#!/usr/bin/env bash
# Fire one Arcads generation from a payload JSON, log it, poll until done.
#
#   ./scripts/arcads-generate.sh docs/examples/soc-ugc-seedance.json [productId]
#
# Loads .env. Never prints credentials. Appends a config-only entry to
# logs/arcads-api.jsonl (no prompt text, no keys) so credit estimates improve
# over time.
set -euo pipefail

PAYLOAD="${1:?usage: $0 <payload.json> [productId]}"
PRODUCT_ID="${2:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[[ -f "$ROOT/.env" ]] && { set -a; . "$ROOT/.env"; set +a; }
BASE="${ARCADS_BASE_URL:-https://external-api.arcads.ai}"

if [[ -n "${ARCADS_BASIC_AUTH:-}" && "$ARCADS_BASIC_AUTH" != *"your_base64"* ]]; then
  AUTH="Authorization: $ARCADS_BASIC_AUTH"
elif [[ -n "${ARCADS_API_KEY:-}" && "$ARCADS_API_KEY" != "your_key_here" ]]; then
  AUTH="Authorization: Basic $(printf '%s:' "$ARCADS_API_KEY" | base64)"
else
  echo "No credentials. Fill .env (see .env.example), then rerun." >&2; exit 1
fi

BODY="$(cat "$PAYLOAD")"
if [[ -n "$PRODUCT_ID" ]]; then
  BODY="$(jq --arg p "$PRODUCT_ID" '.productId = $p' <<<"$BODY")"
fi
if [[ "$(jq -r '.productId' <<<"$BODY")" == REPLACE_* ]]; then
  echo "productId is still a placeholder. Pick one:" >&2
  curl -sS -H "$AUTH" "$BASE/v1/products" | jq -r '.[] | "  \(.id)  \(.name)"' >&2
  echo "Then: $0 $PAYLOAD <productId>" >&2; exit 1
fi

echo "→ POST $BASE/v2/videos/generate"
RESP="$(curl -sS -X POST "$BASE/v2/videos/generate" -H "$AUTH" \
  -H 'Content-Type: application/json' --data-binary "$BODY")"
ID="$(jq -r '.id // .assetId // empty' <<<"$RESP")"
TYPE="$(jq -r '.type // empty' <<<"$RESP")"
if [[ -z "$ID" ]]; then echo "No asset id in response:" >&2; jq . <<<"$RESP" >&2; exit 1; fi
echo "  asset $ID (type: ${TYPE:-unknown})"

mkdir -p "$ROOT/logs"
jq -cn --arg ts "$(date -u +%FT%TZ)" --arg id "$ID" --arg type "$TYPE" \
   --argjson req "$(jq '{model, duration, resolution, aspectRatio, audioEnabled,
                         referenceImagesCount: (.referenceImages|length // 0),
                         promptWordCount: (.prompt|split(" ")|length)}' <<<"$BODY")" \
   '{ts:$ts, assetId:$id, type:$type, request:$req}' >> "$ROOT/logs/arcads-api.jsonl"

# Seedance 2.0 lives in the assets family; other video models in /v1/videos.
POLL="$BASE/v1/assets/$ID"
[[ "$TYPE" =~ ^(sora2|sora2-pro|veo31|kling-2.6|kling-3.0|grok-video)$ ]] && POLL="$BASE/v1/videos/$ID"

echo "→ polling $POLL"
for i in $(seq 1 120); do
  A="$(curl -sS -H "$AUTH" "$POLL")"
  ST="$(jq -r '.status // .videoStatus // "unknown"' <<<"$A")"
  case "$ST" in
    generated)
      URL="$(jq -r '.url // .videoUrl // empty' <<<"$A")"
      mkdir -p "$ROOT/outputs/$(basename "$PAYLOAD" .json)"
      OUT="$ROOT/outputs/$(basename "$PAYLOAD" .json)/$ID.mp4"
      [[ -n "$URL" ]] && curl -sS -o "$OUT" "$URL" && echo "✓ saved $OUT"
      echo "  credits charged: $(jq -r '.creditsCharged // "n/a"' <<<"$A")"
      jq -c --arg id "$ID" --argjson a "$(jq '{status, creditsCharged, url}' <<<"$A")" \
        'if .assetId == $id then .response = $a else . end' \
        "$ROOT/logs/arcads-api.jsonl" > "$ROOT/logs/.tmp" && mv "$ROOT/logs/.tmp" "$ROOT/logs/arcads-api.jsonl"
      (open "$(dirname "$OUT")" || xdg-open "$(dirname "$OUT")") 2>/dev/null || true
      exit 0 ;;
    failed)
      echo "✗ generation failed:" >&2; jq '{status, error}' <<<"$A" >&2; exit 1 ;;
    *) printf '\r  %s (%ds)' "$ST" $((i*5)); sleep 5 ;;
  esac
done
echo; echo "Timed out after 10 min. Check: $POLL" >&2; exit 1
