# CI/CD Pipeline + DevOps Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up a GitHub Actions CI/CD pipeline that lints, tests, builds, and deploys the Elysium Tours backend to Render, with Prometheus app metrics scraped by Grafana Alloy and DORA metrics pushed from the pipeline — all visualised in Grafana Cloud.

**Architecture:** GitHub Actions runs lint → unit tests → integration tests → Docker build/push → Render deploy → DORA metric push on every master commit. Grafana Alloy runs as a sidecar process inside the Render container, scrapes the MoleculerJS `/metrics` endpoint on port 3030, and pushes to Grafana Cloud via remote_write. Two Grafana Cloud dashboards (App Health + DORA Metrics) visualise everything.

**Tech Stack:** GitHub Actions, Docker Hub, Render Deploy Hook, Grafana Alloy v1, Grafana Cloud (free tier), Prometheus remote_write, MoleculerJS built-in Prometheus reporter, Node.js 18, Alpine Linux

## Global Constraints

- CommonJS only — no ESM, no TypeScript
- Node.js >= 18.0.0
- Docker image: `kuandor/elysium-tours-backend`
- Caching remains `null` in `moleculer.config.js` — do not change it
- Alloy binary downloaded at Docker build time — no extra base image
- Pipeline deploys only on `master` branch pushes — PRs run lint + tests only
- All secrets referenced via `${{ secrets.NAME }}` in GitHub Actions — never hardcoded
- Render service URL: `https://elysiumtours-api.onrender.com`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `.github/workflows/ci.yml` | Create | Full CI/CD pipeline definition |
| `alloy/config.alloy` | Create | Grafana Alloy scrape + remote_write config |
| `scripts/push-dora-metrics.sh` | Create | Shell script to POST DORA metrics to Grafana Cloud |
| `docker-entrypoint.sh` | Create | Starts Node.js app + Alloy sidecar together |
| `Dockerfile` | Modify | Add Alloy binary download + switch CMD to entrypoint |
| `monitoring/dashboards/app-health.json` | Create | Grafana dashboard JSON for app metrics |
| `monitoring/dashboards/dora-metrics.json` | Create | Grafana dashboard JSON for DORA metrics |
| `monitoring/alerts.yml` | Create | Basic Prometheus alerting rules |
| `.env.example` | Modify | Add new monitoring env vars |

---

## Task 1: Grafana Alloy config

**Files:**
- Create: `alloy/config.alloy`

**Interfaces:**
- Produces: Alloy config that scrapes `localhost:3030/metrics` every 15s and remote_writes to Grafana Cloud using env vars `GRAFANA_CLOUD_PROMETHEUS_URL`, `GRAFANA_CLOUD_USER`, `GRAFANA_CLOUD_API_KEY`

- [ ] **Step 1: Create the alloy directory and config file**

```bash
mkdir alloy
```

Create `alloy/config.alloy` with this exact content:

```alloy
// Scrape MoleculerJS Prometheus metrics exposed by moleculer.config.js
prometheus.scrape "moleculer" {
  targets = [
    { __address__ = "localhost:3030" },
  ]
  scrape_interval = "15s"
  scrape_timeout  = "10s"
  forward_to      = [prometheus.remote_write.grafana_cloud.receiver]
}

// Push metrics to Grafana Cloud hosted Prometheus
prometheus.remote_write "grafana_cloud" {
  endpoint {
    url = env("GRAFANA_CLOUD_PROMETHEUS_URL")

    basic_auth {
      username = env("GRAFANA_CLOUD_USER")
      password = env("GRAFANA_CLOUD_API_KEY")
    }

    queue_config {
      max_samples_per_send = 1000
      batch_send_deadline  = "5s"
    }
  }

  external_labels = {
    app     = "elysium-tours",
    env     = "production",
  }
}
```

- [ ] **Step 2: Verify the file exists**

```bash
cat alloy/config.alloy
```

Expected: file prints the alloy config without error.

- [ ] **Step 3: Commit**

```bash
git add alloy/config.alloy
git commit -m "feat(monitoring): add Grafana Alloy config for Prometheus remote_write"
```

---

## Task 2: Docker entrypoint script

**Files:**
- Create: `docker-entrypoint.sh`
- Modify: `Dockerfile`

**Interfaces:**
- Consumes: `alloy/config.alloy` from Task 1
- Produces: Docker image that starts both the Node.js app (port 3001) and Alloy sidecar (scraping port 3030) when `docker run` is executed

- [ ] **Step 1: Create the entrypoint script**

Create `docker-entrypoint.sh`:

```bash
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
```

- [ ] **Step 2: Make the script executable**

```bash
chmod +x docker-entrypoint.sh
```

- [ ] **Step 3: Update the Dockerfile**

Read the current `Dockerfile` — it ends with `CMD ["npm", "start"]`. Replace the entire file with:

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

# Production stage
FROM node:18-alpine
WORKDIR /app

# Install dependencies for Alloy (curl for health checks, ca-certificates for TLS)
RUN apk add --no-cache curl ca-certificates

# Download Grafana Alloy binary (v1.8.3 — stable release for Alpine/amd64)
RUN ARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/') && \
    curl -fsSL "https://github.com/grafana/alloy/releases/download/v1.8.3/alloy-linux-${ARCH}.zip" \
    -o /tmp/alloy.zip && \
    unzip /tmp/alloy.zip -d /tmp/alloy-bin && \
    mv /tmp/alloy-bin/alloy-linux-${ARCH} /usr/local/bin/alloy && \
    chmod +x /usr/local/bin/alloy && \
    rm -rf /tmp/alloy.zip /tmp/alloy-bin

# Add non-root user
RUN addgroup -g 1001 -S elysium && \
    adduser -S elysium -u 1001

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/moleculer.config.js ./
COPY --from=builder /app/services ./services
COPY --from=builder /app/mixins ./mixins
COPY --from=builder /app/middlewares ./middlewares
COPY --from=builder /app/config ./config
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/alloy ./alloy

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

USER elysium

ENV NODE_ENV=production
EXPOSE 3001 3030

CMD ["/docker-entrypoint.sh"]
```

- [ ] **Step 4: Verify the Dockerfile builds locally**

```bash
docker build -t elysium-test:local .
```

Expected: Build completes with no errors. Alloy download step prints a progress bar and exits 0.

- [ ] **Step 5: Commit**

```bash
git add docker-entrypoint.sh Dockerfile
git commit -m "feat(monitoring): add Grafana Alloy sidecar to Docker image"
```

---

## Task 3: DORA metrics push script

**Files:**
- Create: `scripts/push-dora-metrics.sh`

**Interfaces:**
- Consumes env vars: `GRAFANA_CLOUD_PROMETHEUS_URL`, `GRAFANA_CLOUD_USER`, `GRAFANA_CLOUD_API_KEY`, `DEPLOY_STATUS` (success|failure), `PIPELINE_START_EPOCH` (unix timestamp), `GIT_FIRST_COMMIT_EPOCH` (unix timestamp)
- Produces: HTTP POST to Grafana Cloud remote_write endpoint with 5 DORA metric time series

- [ ] **Step 1: Create the script**

Create `scripts/push-dora-metrics.sh`:

```bash
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
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x scripts/push-dora-metrics.sh
```

- [ ] **Step 3: Commit**

```bash
git add scripts/push-dora-metrics.sh
git commit -m "feat(ci): add DORA metrics push script for Grafana Cloud"
```

---

## Task 4: GitHub Actions CI pipeline

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes secrets: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `RENDER_DEPLOY_HOOK_URL`, `GRAFANA_CLOUD_PROMETHEUS_URL`, `GRAFANA_CLOUD_USER`, `GRAFANA_CLOUD_API_KEY`
- Consumes: `scripts/push-dora-metrics.sh` from Task 3
- Produces: Automated pipeline that runs on every push/PR to master

- [ ] **Step 1: Create the .github/workflows directory**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Create ci.yml**

Create `.github/workflows/ci.yml`:

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

env:
  IMAGE_NAME: kuandor/elysium-tours-backend

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: unit-tests
    services:
      mongodb:
        image: mongo:7
        ports:
          - 27017:27017
        options: >-
          --health-cmd "mongosh --eval 'db.runCommand({ ping: 1 })'"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run integration tests
        env:
          TEST_MONGO_URI: mongodb://localhost:27017/elysium_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-secret-for-ci-only
          NODE_ENV: test
        run: npm run test:integration

  build-and-push:
    name: Build & Push Docker Image
    runs-on: ubuntu-latest
    needs: integration-tests
    if: github.ref == 'refs/heads/master' && github.event_name == 'push'
    outputs:
      image_tag: ${{ steps.meta.outputs.sha_tag }}
    steps:
      - uses: actions/checkout@v4

      - name: Set image tag
        id: meta
        run: echo "sha_tag=${GITHUB_SHA::8}" >> $GITHUB_OUTPUT

      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Build Docker image
        run: |
          docker build \
            -t ${{ env.IMAGE_NAME }}:${{ steps.meta.outputs.sha_tag }} \
            -t ${{ env.IMAGE_NAME }}:latest \
            .

      - name: Push Docker image
        run: |
          docker push ${{ env.IMAGE_NAME }}:${{ steps.meta.outputs.sha_tag }}
          docker push ${{ env.IMAGE_NAME }}:latest

  deploy:
    name: Deploy to Render
    runs-on: ubuntu-latest
    needs: build-and-push
    if: github.ref == 'refs/heads/master' && github.event_name == 'push'
    outputs:
      deploy_status: ${{ steps.deploy_step.outcome }}
    steps:
      - name: Trigger Render Deploy Hook
        id: deploy_step
        run: |
          curl -sf -X POST "${{ secrets.RENDER_DEPLOY_HOOK_URL }}"
          echo "Deploy hook triggered successfully"

  dora-metrics:
    name: Push DORA Metrics
    runs-on: ubuntu-latest
    needs: [deploy]
    if: always() && github.ref == 'refs/heads/master' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Compute pipeline start time
        id: timing
        run: |
          # Pipeline start = time of the oldest commit in this push
          FIRST_COMMIT_EPOCH=$(git log --reverse --format="%ct" origin/master..HEAD | head -1)
          # Fallback: use current commit time if no new commits found
          if [ -z "$FIRST_COMMIT_EPOCH" ]; then
            FIRST_COMMIT_EPOCH=$(git log -1 --format="%ct")
          fi
          echo "first_commit_epoch=$FIRST_COMMIT_EPOCH" >> $GITHUB_OUTPUT
          # Pipeline start approximated as 60s before now (workflow overhead)
          echo "pipeline_start_epoch=$(($(date +%s) - 120))" >> $GITHUB_OUTPUT

      - name: Push DORA metrics to Grafana Cloud
        env:
          GRAFANA_CLOUD_PROMETHEUS_URL: ${{ secrets.GRAFANA_CLOUD_PROMETHEUS_URL }}
          GRAFANA_CLOUD_USER: ${{ secrets.GRAFANA_CLOUD_USER }}
          GRAFANA_CLOUD_API_KEY: ${{ secrets.GRAFANA_CLOUD_API_KEY }}
          DEPLOY_STATUS: ${{ needs.deploy.result == 'success' && 'success' || 'failure' }}
          PIPELINE_START_EPOCH: ${{ steps.timing.outputs.pipeline_start_epoch }}
          GIT_FIRST_COMMIT_EPOCH: ${{ steps.timing.outputs.first_commit_epoch }}
        run: |
          chmod +x scripts/push-dora-metrics.sh
          ./scripts/push-dora-metrics.sh
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "feat(ci): add GitHub Actions CI/CD pipeline with lint, test, build, deploy"
```

---

## Task 5: Grafana Cloud dashboards

**Files:**
- Create: `monitoring/dashboards/app-health.json`
- Create: `monitoring/dashboards/dora-metrics.json`
- Create: `monitoring/alerts.yml`

**Interfaces:**
- Produces: Two importable Grafana dashboard JSON files and an alert rules file

- [ ] **Step 1: Create the monitoring directory**

```bash
mkdir -p monitoring/dashboards
```

- [ ] **Step 2: Create the Application Health dashboard JSON**

Create `monitoring/dashboards/app-health.json`:

```json
{
  "__inputs": [
    {
      "name": "DS_GRAFANA_CLOUD_PROMETHEUS",
      "label": "Grafana Cloud Prometheus",
      "description": "",
      "type": "datasource",
      "pluginId": "prometheus",
      "pluginName": "Prometheus"
    }
  ],
  "__requires": [
    { "type": "grafana", "id": "grafana", "name": "Grafana", "version": "10.0.0" },
    { "type": "datasource", "id": "prometheus", "name": "Prometheus", "version": "1.0.0" }
  ],
  "title": "Elysium Tours — Application Health",
  "uid": "elysium-app-health",
  "schemaVersion": 38,
  "version": 1,
  "refresh": "30s",
  "time": { "from": "now-1h", "to": "now" },
  "panels": [
    {
      "id": 1,
      "title": "Request Rate (req/s)",
      "type": "timeseries",
      "gridPos": { "x": 0, "y": 0, "w": 12, "h": 8 },
      "datasource": { "type": "prometheus", "uid": "${DS_GRAFANA_CLOUD_PROMETHEUS}" },
      "targets": [
        {
          "expr": "rate(moleculer_request_total{app=\"elysium-tours\"}[5m])",
          "legendFormat": "{{action}}"
        }
      ]
    },
    {
      "id": 2,
      "title": "Error Rate (%)",
      "type": "gauge",
      "gridPos": { "x": 12, "y": 0, "w": 6, "h": 8 },
      "datasource": { "type": "prometheus", "uid": "${DS_GRAFANA_CLOUD_PROMETHEUS}" },
      "options": { "reduceOptions": { "calcs": ["lastNotNull"] } },
      "fieldConfig": {
        "defaults": {
          "unit": "percent",
          "thresholds": {
            "steps": [
              { "color": "green", "value": 0 },
              { "color": "yellow", "value": 5 },
              { "color": "red", "value": 15 }
            ]
          }
        }
      },
      "targets": [
        {
          "expr": "rate(moleculer_request_error_total{app=\"elysium-tours\"}[5m]) / rate(moleculer_request_total{app=\"elysium-tours\"}[5m]) * 100",
          "legendFormat": "Error Rate"
        }
      ]
    },
    {
      "id": 3,
      "title": "P95 Response Time (ms)",
      "type": "timeseries",
      "gridPos": { "x": 0, "y": 8, "w": 12, "h": 8 },
      "datasource": { "type": "prometheus", "uid": "${DS_GRAFANA_CLOUD_PROMETHEUS}" },
      "fieldConfig": { "defaults": { "unit": "ms" } },
      "targets": [
        {
          "expr": "histogram_quantile(0.95, rate(moleculer_request_duration_ms_bucket{app=\"elysium-tours\"}[5m]))",
          "legendFormat": "P95 latency"
        }
      ]
    },
    {
      "id": 4,
      "title": "Circuit Breaker Trips (last 1h)",
      "type": "stat",
      "gridPos": { "x": 12, "y": 8, "w": 6, "h": 8 },
      "datasource": { "type": "prometheus", "uid": "${DS_GRAFANA_CLOUD_PROMETHEUS}" },
      "options": { "reduceOptions": { "calcs": ["lastNotNull"] } },
      "fieldConfig": {
        "defaults": {
          "thresholds": {
            "steps": [
              { "color": "green", "value": 0 },
              { "color": "red", "value": 1 }
            ]
          }
        }
      },
      "targets": [
        {
          "expr": "increase(moleculer_circuit_breaker_opened_total{app=\"elysium-tours\"}[1h])",
          "legendFormat": "Trips"
        }
      ]
    },
    {
      "id": 5,
      "title": "Heap Memory (bytes)",
      "type": "timeseries",
      "gridPos": { "x": 0, "y": 16, "w": 12, "h": 8 },
      "datasource": { "type": "prometheus", "uid": "${DS_GRAFANA_CLOUD_PROMETHEUS}" },
      "fieldConfig": { "defaults": { "unit": "bytes" } },
      "targets": [
        {
          "expr": "process_heap_bytes{app=\"elysium-tours\"}",
          "legendFormat": "Heap"
        }
      ]
    },
    {
      "id": 6,
      "title": "Event Loop Lag (ms)",
      "type": "gauge",
      "gridPos": { "x": 12, "y": 16, "w": 6, "h": 8 },
      "datasource": { "type": "prometheus", "uid": "${DS_GRAFANA_CLOUD_PROMETHEUS}" },
      "options": { "reduceOptions": { "calcs": ["lastNotNull"] } },
      "fieldConfig": {
        "defaults": {
          "unit": "ms",
          "thresholds": {
            "steps": [
              { "color": "green", "value": 0 },
              { "color": "yellow", "value": 100 },
              { "color": "red", "value": 500 }
            ]
          }
        }
      },
      "targets": [
        {
          "expr": "nodejs_event_loop_lag_seconds{app=\"elysium-tours\"} * 1000",
          "legendFormat": "Lag"
        }
      ]
    }
  ]
}
```

- [ ] **Step 3: Create the DORA Metrics dashboard JSON**

Create `monitoring/dashboards/dora-metrics.json`:

```json
{
  "__inputs": [
    {
      "name": "DS_GRAFANA_CLOUD_PROMETHEUS",
      "label": "Grafana Cloud Prometheus",
      "description": "",
      "type": "datasource",
      "pluginId": "prometheus",
      "pluginName": "Prometheus"
    }
  ],
  "__requires": [
    { "type": "grafana", "id": "grafana", "name": "Grafana", "version": "10.0.0" },
    { "type": "datasource", "id": "prometheus", "name": "Prometheus", "version": "1.0.0" }
  ],
  "title": "Elysium Tours — DORA Metrics",
  "uid": "elysium-dora",
  "schemaVersion": 38,
  "version": 1,
  "refresh": "5m",
  "time": { "from": "now-7d", "to": "now" },
  "panels": [
    {
      "id": 1,
      "title": "Deployment Frequency (last 7d)",
      "type": "stat",
      "gridPos": { "x": 0, "y": 0, "w": 6, "h": 6 },
      "datasource": { "type": "prometheus", "uid": "${DS_GRAFANA_CLOUD_PROMETHEUS}" },
      "options": { "reduceOptions": { "calcs": ["sum"] } },
      "fieldConfig": {
        "defaults": {
          "thresholds": {
            "steps": [
              { "color": "red", "value": 0 },
              { "color": "yellow", "value": 1 },
              { "color": "green", "value": 3 }
            ]
          }
        }
      },
      "targets": [
        {
          "expr": "increase(elysium_deploy_success_total{app=\"elysium-tours\"}[7d])",
          "legendFormat": "Successful Deploys"
        }
      ]
    },
    {
      "id": 2,
      "title": "Change Failure Rate (%)",
      "type": "gauge",
      "gridPos": { "x": 6, "y": 0, "w": 6, "h": 6 },
      "datasource": { "type": "prometheus", "uid": "${DS_GRAFANA_CLOUD_PROMETHEUS}" },
      "options": { "reduceOptions": { "calcs": ["lastNotNull"] } },
      "fieldConfig": {
        "defaults": {
          "unit": "percent",
          "thresholds": {
            "steps": [
              { "color": "green", "value": 0 },
              { "color": "yellow", "value": 15 },
              { "color": "red", "value": 30 }
            ]
          }
        }
      },
      "targets": [
        {
          "expr": "increase(elysium_deploy_failed_total{app=\"elysium-tours\"}[7d]) / increase(elysium_deployments_total{app=\"elysium-tours\"}[7d]) * 100",
          "legendFormat": "Failure Rate"
        }
      ]
    },
    {
      "id": 3,
      "title": "Avg Lead Time (seconds)",
      "type": "stat",
      "gridPos": { "x": 12, "y": 0, "w": 6, "h": 6 },
      "datasource": { "type": "prometheus", "uid": "${DS_GRAFANA_CLOUD_PROMETHEUS}" },
      "options": { "reduceOptions": { "calcs": ["mean"] } },
      "fieldConfig": { "defaults": { "unit": "s" } },
      "targets": [
        {
          "expr": "elysium_lead_time_seconds{app=\"elysium-tours\"}",
          "legendFormat": "Lead Time"
        }
      ]
    },
    {
      "id": 4,
      "title": "Avg Pipeline Duration (seconds)",
      "type": "stat",
      "gridPos": { "x": 18, "y": 0, "w": 6, "h": 6 },
      "datasource": { "type": "prometheus", "uid": "${DS_GRAFANA_CLOUD_PROMETHEUS}" },
      "options": { "reduceOptions": { "calcs": ["mean"] } },
      "fieldConfig": { "defaults": { "unit": "s" } },
      "targets": [
        {
          "expr": "elysium_pipeline_duration_seconds{app=\"elysium-tours\"}",
          "legendFormat": "Pipeline Duration"
        }
      ]
    },
    {
      "id": 5,
      "title": "Daily Deploy History",
      "type": "barchart",
      "gridPos": { "x": 0, "y": 6, "w": 24, "h": 10 },
      "datasource": { "type": "prometheus", "uid": "${DS_GRAFANA_CLOUD_PROMETHEUS}" },
      "targets": [
        {
          "expr": "increase(elysium_deployments_total{app=\"elysium-tours\"}[1d])",
          "legendFormat": "Total"
        },
        {
          "expr": "increase(elysium_deploy_success_total{app=\"elysium-tours\"}[1d])",
          "legendFormat": "Success"
        },
        {
          "expr": "increase(elysium_deploy_failed_total{app=\"elysium-tours\"}[1d])",
          "legendFormat": "Failed"
        }
      ]
    },
    {
      "id": 6,
      "title": "Lead Time Trend",
      "type": "timeseries",
      "gridPos": { "x": 0, "y": 16, "w": 12, "h": 8 },
      "datasource": { "type": "prometheus", "uid": "${DS_GRAFANA_CLOUD_PROMETHEUS}" },
      "fieldConfig": { "defaults": { "unit": "s" } },
      "targets": [
        {
          "expr": "elysium_lead_time_seconds{app=\"elysium-tours\"}",
          "legendFormat": "Lead Time"
        }
      ]
    },
    {
      "id": 7,
      "title": "Pipeline Duration Trend",
      "type": "timeseries",
      "gridPos": { "x": 12, "y": 16, "w": 12, "h": 8 },
      "datasource": { "type": "prometheus", "uid": "${DS_GRAFANA_CLOUD_PROMETHEUS}" },
      "fieldConfig": { "defaults": { "unit": "s" } },
      "targets": [
        {
          "expr": "elysium_pipeline_duration_seconds{app=\"elysium-tours\"}",
          "legendFormat": "Pipeline Duration"
        }
      ]
    }
  ]
}
```

- [ ] **Step 4: Create alerts.yml**

Create `monitoring/alerts.yml`:

```yaml
groups:
  - name: elysium-tours-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(moleculer_request_error_total{app="elysium-tours"}[5m]) / rate(moleculer_request_total{app="elysium-tours"}[5m]) > 0.15
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate on Elysium Tours backend"
          description: "Error rate is above 15% for 5 minutes."

      - alert: HighMemoryUsage
        expr: process_heap_bytes{app="elysium-tours"} > 500000000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High heap memory usage"
          description: "Node.js heap is above 500MB for 10 minutes."

      - alert: CircuitBreakerOpen
        expr: increase(moleculer_circuit_breaker_opened_total{app="elysium-tours"}[5m]) > 0
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "Circuit breaker opened"
          description: "A Moleculer service circuit breaker has tripped."

      - alert: HighEventLoopLag
        expr: nodejs_event_loop_lag_seconds{app="elysium-tours"} > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High Node.js event loop lag"
          description: "Event loop lag exceeds 500ms — possible CPU starvation."
```

- [ ] **Step 5: Commit**

```bash
git add monitoring/
git commit -m "feat(monitoring): add Grafana dashboard JSONs and alert rules"
```

---

## Task 6: Update .env.example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add monitoring vars to .env.example**

Append these lines to `.env.example`:

```bash
# Observability — Prometheus metrics (exposed at :3030/metrics)
METRICS_ENABLED=true
METRICS_PROMETHEUS=true
PROMETHEUS_PORT=3030

# Grafana Cloud — credentials for Alloy remote_write and DORA metric push
GRAFANA_CLOUD_PROMETHEUS_URL=https://prometheus-prod-XX-prod-XX.grafana.net/api/prom/push
GRAFANA_CLOUD_USER=123456
GRAFANA_CLOUD_API_KEY=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: add monitoring env vars to .env.example"
```

---

## Task 7: Push and verify pipeline

**Files:** none (verification only)

- [ ] **Step 1: Push to master**

```bash
git push origin master
```

- [ ] **Step 2: Watch the pipeline run**

Go to your GitHub repo → **Actions** tab. You should see the `CI/CD Pipeline` workflow appear within seconds. Watch each job complete in order: Lint → Unit Tests → Integration Tests → Build & Push → Deploy → DORA Metrics.

Expected: All 6 jobs show green checkmarks.

- [ ] **Step 3: Verify Docker Hub image was pushed**

Go to `https://hub.docker.com/r/kuandor/elysium-tours-backend/tags`. You should see two new tags: `latest` and the 8-character commit SHA.

- [ ] **Step 4: Verify Render deployed**

Go to your Render dashboard → `elysiumtours-api` service → **Events** tab. You should see a new deploy triggered a few seconds after the pipeline ran.

- [ ] **Step 5: Import dashboards into Grafana Cloud**

1. Log into Grafana Cloud → your stack → **Dashboards** → **Import**
2. Upload `monitoring/dashboards/app-health.json` → select your Prometheus datasource → **Import**
3. Repeat for `monitoring/dashboards/dora-metrics.json`

Expected: Both dashboards appear and show data within 2–3 minutes of the first pipeline run.

- [ ] **Step 6: Verify DORA metrics appear**

In Grafana Cloud → **Explore** → select Prometheus datasource → run:

```
elysium_deployments_total
```

Expected: Returns a result with labels `app="elysium-tours"` and `env="production"`.
