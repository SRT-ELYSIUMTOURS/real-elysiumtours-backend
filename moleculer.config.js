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

module.exports = {
  nodeID: `${os.hostname()}-${process.pid}`,

  logger: {
    type: "Console",
    options: {
      level: process.env.LOG_LEVEL || "info",
      colors: true,
      moduleColors: true,
      formatter: "full",
      objectPrinter: null,
      autoPadding: false,
    },
  },

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
