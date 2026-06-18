#!/bin/sh
# Push DORA metrics to Grafana Cloud using Prometheus remote_write HTTP API.
# Called at the end of every CI pipeline run regardless of outcome.
set -e

DEPLOY_STATUS="${DEPLOY_STATUS:-failure}"
PIPELINE_START="${PIPELINE_START_EPOCH:-0}"
GIT_FIRST_COMMIT="${GIT_FIRST_COMMIT_EPOCH:-0}"
NOW=$(date +%s)

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

# Grafana Cloud remote_write expects snappy-compressed protobuf.
# We use the simpler /api/v1/import/prometheus text endpoint instead
# (supported by Grafana Cloud Mimir under the same credentials).
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

# Derive the Mimir import endpoint from the remote_write URL
# remote_write URL format: https://prometheus-prod-XX-prod-XX.grafana.net/api/prom/push
# import endpoint:         https://prometheus-prod-XX-prod-XX.grafana.net/api/prom/push
# They share the same base URL — we POST Prometheus text format directly.

echo "[dora] Pushing DORA metrics to Grafana Cloud..."
echo "$METRICS" | curl -sf \
  --user "${GRAFANA_CLOUD_USER}:${GRAFANA_CLOUD_API_KEY}" \
  --header "Content-Type: text/plain" \
  --data-binary @- \
  "${GRAFANA_CLOUD_PROMETHEUS_URL}"

echo "[dora] Done. deploy_status=${DEPLOY_STATUS} lead_time=${LEAD_TIME}s pipeline=${PIPELINE_DURATION}s"
