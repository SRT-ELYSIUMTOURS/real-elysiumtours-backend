#!/bin/sh
set -e

# Start Grafana Alloy in the background if monitoring is enabled
if [ "$METRICS_PROMETHEUS" = "true" ]; then
  echo "[entrypoint] Starting Grafana Alloy sidecar..."
  /usr/local/bin/alloy run /app/alloy/config.alloy \
    --storage.path=/tmp/alloy-data \
    --server.http.listen-addr=0.0.0.0:12345 &
  ALLOY_PID=$!
  echo "[entrypoint] Alloy started with PID $ALLOY_PID"
fi

# Start the Node.js application
echo "[entrypoint] Starting Elysium Tours backend..."
exec npm start
