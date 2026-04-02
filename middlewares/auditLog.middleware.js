"use strict";

module.exports = {
  name: "AuditLog",

  localAction(handler, action) {
    // Only audit write actions (not get/list)
    const writePatterns = ["create", "update", "delete", "remove", "toggle", "assign", "cancel", "refund", "accept", "reject"];
    const actionName = action.name || "";
    const isWriteAction = writePatterns.some(pattern => actionName.toLowerCase().includes(pattern));

    if (isWriteAction) {
      return async function auditHandler(ctx) {
        const startTime = Date.now();
        try {
          const result = await handler(ctx);
          const duration = Date.now() - startTime;

          // Log successful write operation
          ctx.broker.logger.info("[AUDIT]", {
            action: action.name,
            userId: ctx.meta.user ? ctx.meta.user.id : "anonymous",
            params: Object.keys(ctx.params || {}),
            duration: `${duration}ms`,
            success: true,
          });

          return result;
        } catch (err) {
          const duration = Date.now() - startTime;

          // Log failed write operation
          ctx.broker.logger.warn("[AUDIT]", {
            action: action.name,
            userId: ctx.meta.user ? ctx.meta.user.id : "anonymous",
            params: Object.keys(ctx.params || {}),
            duration: `${duration}ms`,
            success: false,
            error: err.message,
          });

          throw err;
        }
      };
    }

    return handler;
  },
};
