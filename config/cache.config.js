"use strict";

// ─── Cache policy ─────────────────────────────────────────────────────────────
// Caching is enabled ONLY for public, non-user-specific catalogue reads, using
// Moleculer's Memory cacher.
//
// Why Memory and not Redis:
//   This service runs as a single process (no transporter unless MULTI_NODE is
//   set), and MongoDB Atlas / any managed Redis both sit outside the hosting
//   platform, so their traffic is billed egress. A Redis cacher would simply
//   swap Atlas egress for Redis egress. An in-process cache uses no network at
//   all, which is the entire point of this change. It also sidesteps the
//   cross-node invalidation problem that makes distributed caching risky.
//
//   If MULTI_NODE is ever enabled, this must be revisited: an in-process cache
//   across several instances means each instance holds its own copy, and a write
//   on instance A does not invalidate instance B. See assertions in
//   tests/unit/services/cachePolicy.test.js.
//
// ── The two rules that matter ────────────────────────────────────────────────
//
// 1. TENANT + ROLE MUST BE IN EVERY CACHE KEY.
//    Moleculer builds cache keys from action *params* only — `ctx.meta` is NOT
//    included unless you ask for it with the "#" prefix. Meanwhile
//    middlewares/tenantScope.middleware.js silently scopes model queries by
//    ctx.meta.organizationId, and super_admins bypass that scoping entirely.
//    So two callers can send byte-identical params and be entitled to different
//    rows. Caching on params alone would serve one organization's catalogue to
//    another — a data leak, not just staleness. TENANT_KEYS below is therefore
//    prepended to every cached action's key.
//
// 2. NEVER CACHE USER-SPECIFIC OR CAPACITY DATA.
//    Anything reading ctx.meta.user (wishlist, bookings, profile), live
//    availability (remainingCapacity — a stale seat count means overselling),
//    payment/booking status, or admin reads (an admin must see their own edit
//    immediately). NEVER_CACHE documents these so the policy test can enforce
//    it rather than relying on reviewer memory.

// Prepended to every cached action's `keys`. See rule 1.
//
// Both organizationId paths are included deliberately. Moleculer's cacher is an
// internal middleware, so it computes the cache key BEFORE user middlewares run
// — including tenantScope.middleware, which is what normalizes the tenant onto
// ctx.meta.organizationId. api.service's authenticate() now sets that at the
// edge so the key is correct, but `#user.organizationId` is kept as a second,
// independent source of truth: if either path is populated the key is
// tenant-correct, and a regression in one does not silently reopen a
// cross-tenant leak. Verified by the "does NOT share a cache entry across
// organizations" tests in tests/unit/services/cachePolicy.test.js.
const TENANT_KEYS = ["#organizationId", "#user.organizationId", "#user.role"];

// TTLs in seconds. Short by design — the goal is collapsing bursts of identical
// reads (page loads, uptime pings, duplicated frontend fetches), not long-term
// storage. A 60s window is indistinguishable from live when browsing a
// catalogue that changes a few times a day.
const TTL = {
	// Catalogue listings — the hot path, and the reads that were hitting Atlas
	// on every single page view.
	CATALOGUE: 60,
	// A single tour/destination detail page.
	DETAIL: 120,
	// Static vocabularies (e.g. attraction categories) — these come from a
	// hardcoded constant, so they can be held far longer.
	STATIC: 3600,
	// Third-party CMS content. cms.listTestimonials was observed taking 6s, so
	// this is a latency win as much as a bandwidth one.
	CMS: 300,
};

/**
 * Build a cache config for a public catalogue action.
 *
 * Always tenant- and role-scoped (rule 1). Pass the action's own param names
 * that affect the result — anything omitted is NOT part of the key, so a
 * forgotten filter param would serve the wrong rows.
 *
 * @param {string[]} paramKeys param names that change the response
 * @param {number} ttl seconds
 */
function publicCache(paramKeys = [], ttl = TTL.CATALOGUE) {
	return {
		ttl,
		keys: [...TENANT_KEYS, ...paramKeys],
	};
}

// Actions that must never be cached, with the reason. The policy test asserts
// none of these carry a `cache` config, so enabling one is a loud failure.
const NEVER_CACHE = {
	"tourPackage.validatePackage": "resolves live price + remainingCapacity; stale = overselling",
	"tourPackage.checkAvailability": "live seat availability",
	"tourPackage.getWaitlist": "admin/user-specific",
	"booking.getBooking": "per-user booking data",
	"booking.listBookings": "per-user booking data",
	"booking.getTransitions": "reflects live booking state machine",
	"payment.getTransactions": "financial data, admin-scoped",
	"user.getProfile": "per-user",
	"wishlist.list": "per-user",
};

module.exports = { TENANT_KEYS, TTL, publicCache, NEVER_CACHE };
