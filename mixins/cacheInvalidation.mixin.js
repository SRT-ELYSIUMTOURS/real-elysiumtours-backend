"use strict";

// ─── cacheInvalidation mixin ──────────────────────────────────────────────────
// The classic caching failure is a write path nobody remembered to invalidate:
// the data changes, the cache doesn't, and stale rows are served until the TTL
// happens to expire. That is precisely the "cache poisoning" risk this project's
// rules warned about.
//
// Rather than scattering broker.cacher.clean() calls through handlers (easy to
// forget when a new write action is added), this mixin installs `after` hooks on
// a service's write actions declaratively. Adding a write action to the list is
// the only step required, and cachePolicy.test.js asserts that every service
// with cached reads also carries this mixin.
//
// Usage:
//   mixins: [CacheInvalidation({
//       actions: ["create", "update", "toggleActive", "publish"],
//       patterns: ["tourPackage.**", "destination.**"],
//   })]
//
// Cross-resource note: patterns may name OTHER services. tourPackage.list
// embeds destination data in its enrichment, so a destination write must clear
// tourPackage caches too or tour cards keep showing an old destination name.

/**
 * @param {Object} opts
 * @param {string[]} opts.actions write action names to hook
 * @param {string[]} opts.patterns cacher key patterns to clean
 */
module.exports = function CacheInvalidation({ actions = [], patterns = [] } = {}) {
	if (patterns.length === 0) {
		throw new Error("CacheInvalidation: at least one cache pattern is required");
	}

	/**
	 * Clean the configured patterns. Deliberately fault-tolerant: a cache
	 * failure must never turn a successful write into a failed request. The
	 * worst case of a failed clean is stale reads until the (short) TTL lapses,
	 * which is far better than rejecting a write the DB already accepted.
	 */
	async function invalidate(ctx, res) {
		const cacher = ctx.broker.cacher;
		if (!cacher) return res; // caching disabled — nothing to do

		try {
			await Promise.all(patterns.map((p) => cacher.clean(p)));
			ctx.service.logger.debug(
				`Cache invalidated by ${ctx.action.name}: ${patterns.join(", ")}`
			);
		} catch (err) {
			ctx.service.logger.warn(
				`Cache invalidation failed for ${ctx.action.name} (serving may be stale until TTL): ${err.message}`
			);
		}

		return res;
	}

	const after = {};
	for (const actionName of actions) {
		after[actionName] = invalidate;
	}

	return {
		hooks: { after },

		methods: {
			/**
			 * Manual escape hatch for write paths that aren't plain actions
			 * (event handlers, batch jobs).
			 */
			async invalidateCache() {
				const cacher = this.broker.cacher;
				if (!cacher) return;
				try {
					await Promise.all(patterns.map((p) => cacher.clean(p)));
				} catch (err) {
					this.logger.warn(`Manual cache invalidation failed: ${err.message}`);
				}
			},
		},
	};
};

// Exposed for the policy test.
module.exports.INVALIDATION_MARKER = "cacheInvalidation";
