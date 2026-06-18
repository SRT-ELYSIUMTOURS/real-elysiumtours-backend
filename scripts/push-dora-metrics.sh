#!/bin/sh
# Push DORA metrics to Grafana Cloud using Mimir plain-text import endpoint.
# Called at the end of every CI pipeline run regardless of outcome.
set -e

DEPLOY_STATUS="${DEPLOY_STATUS:-failure}"
PIPELINE_START="${PIPELINE_START_EPOCH:-0}"
GIT_FIRST_COMMIT="${GIT_FIRST_COMMIT_EPOCH:-0}"
NOW=$(date +%s)

# Skip gracefully if Grafana Cloud credentials are not configured
if [ -z "$GRAFANA_CLOUD_PROMETHEUS_URL" ] || [ -z "$GRAFANA_CLOUD_USER" ] || [ -z "$GRAFANA_CLOUD_API_KEY" ]; then
  echo "[dora] Grafana Cloud credentials not configured — skipping DORA metric push."
  exit 0
fi

# Compute durations
PIPELINE_DURATION=$((NOW - PIPELINE_START))
LEAD_TIME=$((NOW - GIT_FIRST_COMMIT))

# Build counters
DEPLOYMENTS_TOTAL=1
DEPLOY_SUCCESS=0
DEPLOY_FAILED=0

if [ "$DEPLOY_STATUS" = "success" ]; then
  DEPLOY_SUCCESS=1
else
  DEPLOY_FAILED=1
fi

METRICS=$(cat <<EOF
# HELP elysium_deployments_total Total pipeline runs
# TYPE elysium_deployments_total counter
elysium_deployments_total{app="elysium-tours",env="production"} ${DEPLOYMENTS_TOTAL}
# HELP elysium_deploy_success_total Successful deploys
# TYPE elysium_deploy_success_total counter
elysium_deploy_success_total{app="elysium-tours",env="production"} ${DEPLOY_SUCCESS}
# HELP elysium_deploy_failed_total Failed deploys
# TYPE elysium_deploy_failed_total counter
elysium_deploy_failed_total{app="elysium-tours",env="production"} ${DEPLOY_FAILED}
# HELP elysium_lead_time_seconds Seconds from first commit to deploy completion
# TYPE elysium_lead_time_seconds gauge
elysium_lead_time_seconds{app="elysium-tours",env="production"} ${LEAD_TIME}
# HELP elysium_pipeline_duration_seconds Total pipeline wall-clock time
# TYPE elysium_pipeline_duration_seconds gauge
elysium_pipeline_duration_seconds{app="elysium-tours",env="production"} ${PIPELINE_DURATION}
EOF
)

# Derive Mimir plain-text import endpoint from the remote_write push URL
# Example: https://prometheus-prod-XX.grafana.net/api/prom/push
#      ->  https://prometheus-prod-XX.grafana.net/api/v1/import/prometheus
IMPORT_URL=$(echo "$GRAFANA_CLOUD_PROMETHEUS_URL" | sed 's|/api/prom/push.*|/api/v1/import/prometheus|')

echo "[dora] Pushing DORA metrics to Grafana Cloud (${IMPORT_URL})..."
HTTP_STATUS=$(echo "$METRICS" | curl -s -o /dev/null -w "%{http_code}" \
  --user "${GRAFANA_CLOUD_USER}:${GRAFANA_CLOUD_API_KEY}" \
  --header "Content-Type: text/plain" \
  --data-binary @- \
  "${IMPORT_URL}")

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "204" ] || [ "$HTTP_STATUS" = "202" ]; then
  echo "[dora] Done. deploy_status=${DEPLOY_STATUS} lead_time=${LEAD_TIME}s pipeline=${PIPELINE_DURATION}s (HTTP ${HTTP_STATUS})"
else
  echo "[dora] Warning: Grafana Cloud returned HTTP ${HTTP_STATUS}. Metrics may not have been recorded."
  echo "[dora] Check that GRAFANA_CLOUD_PROMETHEUS_URL, GRAFANA_CLOUD_USER, and GRAFANA_CLOUD_API_KEY are correct."
fi
