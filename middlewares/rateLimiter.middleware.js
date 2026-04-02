"use strict";

module.exports = {
	name: "RateLimiter",

	created() {
		// In-memory rate limit store: Map<key, { count, resetAt }>
		this.rateLimitStore = new Map();

		// Clean up expired entries every 5 minutes
		this.cleanupInterval = setInterval(() => {
			const now = Date.now();
			for (const [key, entry] of this.rateLimitStore) {
				if (entry.resetAt < now) {
					this.rateLimitStore.delete(key);
				}
			}
		}, 5 * 60 * 1000);
	},

	stopped() {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
		}
	},

	localAction(handler, action) {
		if (action.rateLimit) {
			const { limit = 100, window = 15 * 60 * 1000 } = action.rateLimit;
			const self = this;

			return async function rateLimitHandler(ctx) {
				// Build rate limit key from user ID or IP
				const userId = ctx.meta.user ? ctx.meta.user.id : "anonymous";
				const key = `${action.name}:${userId}`;
				const now = Date.now();

				let entry = self.rateLimitStore.get(key);

				if (!entry || entry.resetAt < now) {
					entry = { count: 0, resetAt: now + window };
					self.rateLimitStore.set(key, entry);
				}

				entry.count++;

				if (entry.count > limit) {
					const { MoleculerClientError } = require("moleculer").Errors;
					throw new MoleculerClientError(
						"Too many requests. Please try again later.",
						429,
						"RATE_LIMIT_EXCEEDED",
						{
							limit,
							remaining: 0,
							resetAt: new Date(entry.resetAt).toISOString(),
						}
					);
				}

				// Set rate limit headers in response meta
				ctx.meta.$responseHeaders = {
					...ctx.meta.$responseHeaders,
					"X-RateLimit-Limit": String(limit),
					"X-RateLimit-Remaining": String(Math.max(0, limit - entry.count)),
					"X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
				};

				return handler(ctx);
			};
		}
		return handler;
	},
};
