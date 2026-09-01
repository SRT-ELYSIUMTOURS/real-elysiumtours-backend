"use strict";

require("dotenv").config();
const dns = require("dns");
// Optional DNS override — do NOT force public resolvers in production by default.
// On Render this adds external DNS egress and can fight the platform resolver.
if (process.env.DNS_SERVERS) {
	dns.setServers(
		process.env.DNS_SERVERS.split(",")
			.map((s) => s.trim())
			.filter(Boolean)
	);
}
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

// Redis transporter is ONLY needed when services run in separate Node processes
// (docker-compose multi-worker / multiple Render services). On a single Render
// web service that loads all services via `npm start`, in-process calls work
// without a transporter. Leaving REDIS_URL wired as the transporter burns
// egress on heartbeats + large INFO packets even with zero user traffic.
const multiNode = process.env.MULTI_NODE === "true";
const transporter =
	multiNode && process.env.REDIS_URL ? process.env.REDIS_URL : null;

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

  transporter,

  // ─── Caching ────────────────────────────────────────────────────────────────
  // Enabled for public catalogue reads only. MongoDB Atlas is off-platform, so
  // every uncached read is billed egress; with caching off entirely this service
  // re-queried the full catalogue on every page load and every uptime ping.
  //
  // Memory (in-process) rather than Redis on purpose: a managed Redis is ALSO
  // off-platform, so a Redis cacher would trade Atlas egress for Redis egress
  // and save nothing. An in-process cache uses no network at all.
  //
  // Which actions are cached, the mandatory tenant/role scoping of cache keys,
  // and the never-cache list all live in config/cache.config.js. Invalidation is
  // handled declaratively by mixins/cacheInvalidation.mixin.js. Both are
  // enforced by tests/unit/services/cachePolicy.test.js.
  //
  // IMPORTANT: an in-process cache is only coherent because this runs as a
  // single process. If MULTI_NODE is enabled, each instance would hold its own
  // copy and a write on one would not invalidate the others — switch to a shared
  // cacher (accepting its egress cost) before scaling out.
  cacher: process.env.DISABLE_CACHE === "true" ? null : {
    type: "Memory",
    options: {
      // Fallback TTL. Every cached action sets its own; this only applies if one
      // forgets, so it is deliberately short.
      ttl: 60,
      // Bound the entry count so a wide param space (search terms, pagination)
      // can't grow the heap without limit on a small instance.
      max: 1000,
      // Hand callers a copy. Enrichment code spreads and mutates result objects,
      // and without this a caller could mutate the cached entry in place and
      // corrupt it for everyone else.
      clone: true,
    },
  },

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
  // Heartbeats only matter with a transporter. Keep them slower in multi-node
  // to cut Redis egress (INFO packets include full service schemas).
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL, 10) || (multiNode ? 30 : 10),
  heartbeatTimeout: parseInt(process.env.HEARTBEAT_TIMEOUT, 10) || (multiNode ? 90 : 30),

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
    broker.logger.info(
      multiNode
        ? `Transporter enabled (MULTI_NODE): ${process.env.REDIS_URL ? "Redis" : "none"}`
        : "Transporter disabled (single-node / in-process). Set MULTI_NODE=true for multi-worker deploys."
    );
  },

  started(broker) {
    broker.logger.info("Elysium Tours broker started");
  },

  stopped(broker) {
    broker.logger.info("Elysium Tours broker stopped");
  },
};
