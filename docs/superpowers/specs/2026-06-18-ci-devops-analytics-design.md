# CI/CD Pipeline + DevOps Analytics Design
**Date:** 2026-06-18
**Author:** Emmanuel Amokuandoh
**Status:** Approved

---

## Overview

Add a GitHub Actions CI/CD pipeline that:
1. Runs lint, unit tests, and integration tests on every push
2. Builds and pushes a Docker image to Docker Hub on `master`
3. Deploys to Render via Deploy Hook
4. Pushes DORA metrics to Grafana Cloud at end of each run

App-level Prometheus metrics (already wired in `moleculer.config.js`) are scraped by Grafana Alloy running as a sidecar on Render and pushed to Grafana Cloud for visualization.

---

## Architecture

```
GitHub Push
    │
    ▼
GitHub Actions CI Pipeline
    ├── lint
    ├── unit-tests
    ├── integration-tests (MongoDB + Redis services)
    ├── build-docker → push to Docker Hub
    ├── deploy → Render Deploy Hook (curl POST)
    └── push-dora-metrics → Grafana Cloud Metrics API

Render (production)
    ├── MoleculerJS app (single web service: https://elysiumtours-api.onrender.com)
    │     └── exposes /metrics on port 3030
    └── Grafana Alloy sidecar
          └── scrapes localhost:3030/metrics every 15s
          └── remote_write → Grafana Cloud Prometheus

Grafana Cloud
    ├── Prometheus (stores all metrics)
    ├── Dashboard: Application Health
    └── Dashboard: DORA Metrics
```

---

## Section 1 — GitHub Actions Pipeline

**File:** `.github/workflows/ci.yml`

**Triggers:** `push` to `master`, `pull_request` to `master`

### Pipeline Stages

| Stage | Condition | What it does |
|---|---|---|
| `lint` | always | `npm run lint` |
| `unit-tests` | after lint passes | `npm run test:unit` |
| `integration-tests` | after unit passes | Spins up MongoDB + Redis as Actions services, runs `npm run test:integration` |
| `build-docker` | after integration passes | `docker build`, tags `kuandor/elysium-tours-backend:<sha>` and `:latest` |
| `push-to-dockerhub` | master branch only | Pushes both tags to Docker Hub |
| `deploy-to-render` | after push succeeds | `curl -X POST $RENDER_DEPLOY_HOOK_URL` |
| `push-dora-metrics` | always (after deploy step) | Runs `scripts/push-dora-metrics.sh` to send metrics to Grafana Cloud |

### DORA Metrics Captured

| Metric name | How computed |
|---|---|
| `elysium_deployments_total` | Counter +1 on every pipeline run |
| `elysium_deploy_success_total` | Counter +1 when deploy step succeeds |
| `elysium_deploy_failed_total` | Counter +1 when integration tests or deploy step fails |
| `elysium_lead_time_seconds` | `git log` timestamp of earliest commit in push vs. deploy completion time |
| `elysium_pipeline_duration_seconds` | Total workflow wall-clock time (end minus start) |

### GitHub Actions Secrets Required

```
DOCKERHUB_USERNAME         = kuandor
DOCKERHUB_TOKEN            = <personal access token>
RENDER_DEPLOY_HOOK_URL     = <from Render service settings>
GRAFANA_CLOUD_PROMETHEUS_URL = <remote_write endpoint>
GRAFANA_CLOUD_USER         = <instance ID / username>
GRAFANA_CLOUD_API_KEY      = <generated API key>
```

---

## Section 2 — Prometheus App Metrics

**Already implemented** in `moleculer.config.js` — enabled via env vars.

### Render Env Vars to Set

```
METRICS_ENABLED=true
METRICS_PROMETHEUS=true
PROMETHEUS_PORT=3030
```

### Metrics Exposed at `localhost:3030/metrics`

| Metric | Description |
|---|---|
| `moleculer_request_total` | Total action calls, labeled by service + action + result |
| `moleculer_request_duration_ms` | Response time histogram per action |
| `moleculer_request_error_total` | Failed action calls per service |
| `moleculer_circuit_breaker_opened_total` | Circuit breaker trips |
| `moleculer_nodes_total` | Live broker nodes |
| `process_heap_bytes` | Node.js heap memory |
| `nodejs_event_loop_lag_seconds` | Event loop lag |

---

## Section 3 — Grafana Alloy (Sidecar on Render)

**File:** `alloy/config.alloy`

Grafana Alloy runs as a second process inside the Render deployment. It:
- Scrapes `localhost:3030/metrics` every 15 seconds
- Forwards all metrics to Grafana Cloud via `remote_write`

The `Dockerfile` is updated to start both the Node.js app and Alloy via a shell entrypoint script.

### Alloy Config Summary

```
prometheus.scrape "moleculer" {
  targets = [{ __address__ = "localhost:3030" }]
  scrape_interval = "15s"
  forward_to = [prometheus.remote_write.grafana_cloud.receiver]
}

prometheus.remote_write "grafana_cloud" {
  endpoint {
    url = env("GRAFANA_CLOUD_PROMETHEUS_URL")
    basic_auth {
      username = env("GRAFANA_CLOUD_USER")
      password = env("GRAFANA_CLOUD_API_KEY")
    }
  }
}
```

---

## Section 4 — Grafana Cloud Dashboards

Two dashboards exported as JSON (importable via Grafana UI).

### Dashboard 1: Application Health (`monitoring/dashboards/app-health.json`)

| Panel | Query | Type |
|---|---|---|
| Request rate | `rate(moleculer_request_total[5m])` | Time series |
| Error rate % | `rate(moleculer_request_error_total[5m]) / rate(moleculer_request_total[5m]) * 100` | Gauge |
| P95 response time | `histogram_quantile(0.95, rate(moleculer_request_duration_ms_bucket[5m]))` | Time series |
| Circuit breaker trips | `increase(moleculer_circuit_breaker_opened_total[1h])` | Stat |
| Heap memory | `process_heap_bytes` | Time series |
| Event loop lag | `nodejs_event_loop_lag_seconds` | Gauge |

### Dashboard 2: DORA Metrics (`monitoring/dashboards/dora-metrics.json`)

| Panel | Query | Type |
|---|---|---|
| Deployment frequency (7d) | `increase(elysium_deploy_success_total[7d])` | Stat |
| Change failure rate | `increase(elysium_deploy_failed_total[7d]) / increase(elysium_deployments_total[7d]) * 100` | Gauge |
| Avg lead time | `avg_over_time(elysium_lead_time_seconds[7d])` | Stat |
| Pipeline duration trend | `elysium_pipeline_duration_seconds` | Time series |
| Deploy history | `increase(elysium_deployments_total[1d])` | Bar chart |

---

## Section 5 — File Structure

```
.github/
  workflows/
    ci.yml

alloy/
  config.alloy

monitoring/
  dashboards/
    app-health.json
    dora-metrics.json
  alerts.yml

scripts/
  push-dora-metrics.sh

docker-entrypoint.sh          ← starts app + Alloy together
Dockerfile                    ← updated to include Alloy binary + entrypoint
.env.example                  ← updated with monitoring vars
```

---

## Constraints & Notes

- Caching remains `null` in `moleculer.config.js` per CLAUDE.md — Prometheus metrics are unaffected
- Alloy binary is downloaded at Docker build time from Grafana's GitHub releases (no extra base image)
- DORA metrics use Prometheus remote_write protobuf format via `curl` with snappy compression handled by a small shell helper
- The pipeline only pushes Docker images and deploys on the `master` branch — PRs run lint + tests only
- Render free tier spins down after inactivity — Alloy push model handles this correctly (no scrape gaps from external pull)
- Docker Hub image: `kuandor/elysium-tours-backend`
