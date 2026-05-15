"use strict";

require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const os = require("os");

const DbIdNormalizer = require("./middlewares/dbIdNormalizer.middleware");
const RbacPermissions = require("./middlewares/rbacPermissions.middleware");
const TenantScope = require("./middlewares/tenantScope.middleware");
const RateLimiter = require("./middlewares/rateLimiter.middleware");
const AuditLog = require("./middlewares/auditLog.middleware");

// ── Observability env flags ──
// Opt-in to keep test runs and quiet local boots free of trace noise.
//   TRACING_ENABLED=true              terminal traces for every action call
//   TRACING_SAMPLE_RATE=0.1           prod-side sampling (0..1)
//   METRICS_ENABLED=true              console reporter prints periodic counters
//   METRICS_INTERVAL=30               console reporter interval (seconds)
//   METRICS_PROMETHEUS=true           expose /metrics on PROMETHEUS_PORT
//   PROMETHEUS_PORT=3030
const isProd = process.env.NODE_ENV === "production";
const tracingEnabled = process.env.TRACING_ENABLED === "true";
const metricsEnabled = process.env.METRICS_ENABLED === "true";
const prometheusEnabled = process.env.METRICS_PROMETHEUS === "true";

const tracingConfig = tracingEnabled
  ? {
      enabled: true,
      exporter: [
        {
          type: "Console",
          options: {
            width: 120,
            gaugeWidth: 50,
            colors: true,
            logger: null,
          },
        },
      ],
      events: true,
      stackTrace: !isProd,
      actions: true,
      methods: false,
      sampling: {
        rate: isProd ? parseFloat(process.env.TRACING_SAMPLE_RATE || "0.1") : 1.0,
      },
    }
  : false;

const metricsReporters = [];
if (metricsEnabled) {
  metricsReporters.push({
    type: "Console",
    options: {
      interval: parseInt(process.env.METRICS_INTERVAL, 10) || 30,
      colors: true,
      onlyChanges: true,
    },
  });
}
if (prometheusEnabled) {
  metricsReporters.push({
    type: "Prometheus",
    options: {
      port: parseInt(process.env.PROMETHEUS_PORT, 10) || 3030,
      path: "/metrics",
      defaultLabels: (registry) => ({
        namespace: registry.broker.namespace,
        nodeID: registry.broker.nodeID,
      }),
    },
  });
}
const metricsConfig =
  metricsReporters.length > 0
    ? { enabled: true, reporter: metricsReporters }
    : false;

module.exports = {
  nodeID: `${os.hostname()}-${process.pid}`,

  // Console logger. Per-module level overrides via LOG_LEVEL_<MODULE>=level
  // (e.g. LOG_LEVEL_TRANSIT=warn) handled at process start; the broker reads
  // the merged levelObject below.
  logger: {
    type: "Console",
    options: {
      level: process.env.LOG_LEVEL || "info",
      colors: true,
      moduleColors: true,
      formatter: "full",
      objectPrinter: null,
      autoPadding: true,
    },
  },

  // Tracing — terminal-friendly when TRACING_ENABLED=true.
  // Spans cover every action call, including cross-service ctx.call() chains.
  tracing: tracingConfig,

  // Metrics — Console reporter for terminal, optional Prometheus for scraping.
  metrics: metricsConfig,

  transporter: process.env.REDIS_URL || null,

  // Caching explicitly disabled during development.
  // Cache poisoning risk: stale data in request/response cycles.
  // Enable only after development is complete, with dedicated testing.
  cacher: null,

  serializer: "JSON",

  requestTimeout: 30 * 1000,

  retryPolicy: {
    enabled: true,
    retries: 3,
    delay: 100,
    maxDelay: 2000,
    factor: 2,
    check: (err) => err && !!err.retryable,
  },

  maxCallLevel: 100,
  heartbeatInterval: 10,
  heartbeatTimeout: 30,

  contextParamsCloning: false,

  tracking: {
    enabled: true,
    shutdownTimeout: 5000,
  },

  disableBalancer: false,

  registry: {
    strategy: "RoundRobin",
    preferLocal: true,
  },

  circuitBreaker: {
    enabled: true,
    threshold: 0.5,
    minRequestCount: 20,
    windowTime: 60,
    halfOpenTime: 10 * 1000,
    check: (err) => err && err.code >= 500,
  },

  bulkhead: {
    enabled: false,
    concurrency: 10,
    maxQueueSize: 100,
  },

  validator: true,

  errorHandler: null,

  // Middleware order: NEVER reorder (see CLAUDE.md)
  middlewares: [
    DbIdNormalizer,
    RbacPermissions,
    TenantScope,
    RateLimiter,
    AuditLog,
  ],

  replCommands: null,

  metadata: {
    region: "ghana",
  },

  created(broker) {
    broker.logger.info("Elysium Tours broker created");
  },

  started(broker) {
    broker.logger.info("Elysium Tours broker started");
  },

  stopped(broker) {
    broker.logger.info("Elysium Tours broker stopped");
  },
};
