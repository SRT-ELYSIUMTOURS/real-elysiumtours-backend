#!/bin/sh
# Push DORA metrics to Grafana Cloud Loki as structured log events.
# Called at the end of every CI pipeline run regardless of outcome.
set -e

DEPLOY_STATUS="${DEPLOY_STATUS:-failure}"
PIPELINE_START="${PIPELINE_START_EPOCH:-0}"
GIT_FIRST_COMMIT="${GIT_FIRST_COMMIT_EPOCH:-0}"
NOW=$(date +%s)

# Skip gracefully if Grafana Cloud credentials are not configured
if [ -z "$GRAFANA_CLOUD_LOKI_URL" ] || [ -z "$GRAFANA_CLOUD_LOKI_USER" ] || [ -z "$GRAFANA_CLOUD_API_KEY" ]; then
  echo "[dora] Grafana Cloud credentials not configured — skipping DORA metric push."
  exit 0
fi

# Compute durations
PIPELINE_DURATION=$((NOW - PIPELINE_START))
LEAD_TIME=$((NOW - GIT_FIRST_COMMIT))

# Loki requires nanosecond timestamps
NOW_NS="${NOW}000000000"

# Build JSON payload — one log line with all DORA fields as structured JSON
PAYLOAD=$(cat <<EOF
{
  "streams": [
    {
      "stream": {
        "app": "elysium-tours",
        "env": "production",
        "job": "ci-pipeline",
        "deploy_status": "${DEPLOY_STATUS}"
      },
      "values": [
        [
          "${NOW_NS}",
          "{\"deploy_status\":\"${DEPLOY_STATUS}\",\"lead_time_seconds\":${LEAD_TIME},\"pipeline_duration_seconds\":${PIPELINE_DURATION},\"deployment\":1}"
        ]
      ]
    }
  ]
}
EOF
)

LOKI_PUSH_URL="${GRAFANA_CLOUD_LOKI_URL}/loki/api/v1/push"

echo "[dora] Pushing DORA event to Grafana Cloud Loki (${LOKI_PUSH_URL})..."
HTTP_STATUS=$(echo "$PAYLOAD" | curl -s -o /dev/null -w "%{http_code}" \
  --user "${GRAFANA_CLOUD_LOKI_USER}:${GRAFANA_CLOUD_API_KEY}" \
  --header "Content-Type: application/json" \
  --data-binary @- \
  "${LOKI_PUSH_URL}")

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "204" ] || [ "$HTTP_STATUS" = "204" ]; then
  echo "[dora] Done. deploy_status=${DEPLOY_STATUS} lead_time=${LEAD_TIME}s pipeline=${PIPELINE_DURATION}s (HTTP ${HTTP_STATUS})"
else
  echo "[dora] Warning: Grafana Cloud Loki returned HTTP ${HTTP_STATUS}. Event may not have been recorded."
  echo "[dora] Check that GRAFANA_CLOUD_LOKI_URL, GRAFANA_CLOUD_USER, and GRAFANA_CLOUD_API_KEY are correct."
fi
