"use strict";

const { ServiceBroker } = require("moleculer");
const fs = require("fs");
const path = require("path");
const { TENANT_KEYS, NEVER_CACHE } = require("../../../config/cache.config");

// ─── Cache policy guard ───────────────────────────────────────────────────────
// Caching is the classic source of two production incidents:
//   1. serving one tenant's / role's data to another (a leak, not staleness)
//   2. a write path nobody invalidated, so stale rows persist
//
// These tests enforce the policy structurally rather than relying on review.

const SERVICES = {
	tourPackage: require("../../../services/tourPackage.service"),
	destination: require("../../../services/destination.service"),
	hotelPartner: require("../../../services/hotelPartner.service"),
	attraction: require("../../../services/attraction.service"),
	dining: require("../../../services/dining.service"),
};

const cachedActions = (svc) =>
	Object.entries(svc.actions || {}).filter(([, def]) => def && def.cache);

describe("cache policy", () => {
	describe("every cached action is tenant- and role-scoped", () => {
		// The whole reason this suite exists: Moleculer builds cache keys from
		// action params only. tenantScope.middleware silently scopes queries by
		// ctx.meta.organizationId, and super_admins bypass that scoping, so
		// identical params can legitimately return different rows per caller.
		it.each(Object.keys(SERVICES))("%s", (name) => {
			const offenders = [];

			for (const [action, def] of cachedActions(SERVICES[name])) {
				const keys = def.cache.keys;

				if (!Array.isArray(keys)) {
					offenders.push(`${action}: cache.keys must be an explicit array`);
					continue;
				}
				// Params-only keys would leak across orgs/roles.
				for (const required of TENANT_KEYS) {
					if (!keys.includes(required)) {
						offenders.push(`${action}: cache.keys missing ${required}`);
					}
				}
				if (typeof def.cache.ttl !== "number" || def.cache.ttl <= 0) {
					offenders.push(`${action}: cache.ttl must be a positive number`);
				}
			}

			expect(offenders).toEqual([]);
		});
	});

	describe("cache keys cover every param that changes the response", () => {
		// A filter param missing from the key means two different requests share
		// a cache entry — e.g. ?region=Volta served from the ?region=Ashanti entry.
		it.each(Object.keys(SERVICES))("%s", (name) => {
			const offenders = [];

			for (const [action, def] of cachedActions(SERVICES[name])) {
				const declaredParams = Object.keys(def.params || {}).filter(
					(k) => !k.startsWith("$$")
				);
				const keyParams = (def.cache.keys || []).filter((k) => !k.startsWith("#"));

				for (const param of declaredParams) {
					if (!keyParams.includes(param)) {
						offenders.push(`${action}: param '${param}' is not part of cache.keys`);
					}
				}
			}

			expect(offenders).toEqual([]);
		});
	});

	describe("dangerous actions are never cached", () => {
		it("no action on the never-cache list carries a cache config", () => {
			const offenders = [];

			for (const [fullName, reason] of Object.entries(NEVER_CACHE)) {
				const [svcName, actionName] = fullName.split(".");
				const svc = SERVICES[svcName];
				if (!svc) continue; // service not in this suite's scope
				const def = svc.actions && svc.actions[actionName];
				if (def && def.cache) {
					offenders.push(`${fullName} must not be cached — ${reason}`);
				}
			}

			expect(offenders).toEqual([]);
		});

		it("no admin-role action is cached", () => {
			// Admins must always see the effect of their own edit immediately.
			const offenders = [];

			for (const [name, svc] of Object.entries(SERVICES)) {
				for (const [action, def] of cachedActions(svc)) {
					if (def.role === "admin" || def.role === "super_admin" || def.role === "staff") {
						offenders.push(`${name}.${action} is role-gated (${def.role}) and cached`);
					}
					if (def.auth === "required") {
						offenders.push(`${name}.${action} requires auth and is cached`);
					}
				}
			}

			expect(offenders).toEqual([]);
		});
	});

	describe("every service with cached reads can invalidate them", () => {
		it.each(Object.keys(SERVICES))("%s installs the invalidation mixin", (name) => {
			const svc = SERVICES[name];
			if (cachedActions(svc).length === 0) return;

			const hasAfterHooks = (svc.mixins || []).some(
				(m) => m && m.hooks && m.hooks.after && Object.keys(m.hooks.after).length > 0
			);
			expect(hasAfterHooks).toBe(true);
		});

		it.each(Object.keys(SERVICES))(
			"%s hooks invalidation onto all of its write actions",
			(name) => {
				const svc = SERVICES[name];
				if (cachedActions(svc).length === 0) return;

				// Any action that mutates state must be hooked, or its writes leave
				// stale cache entries behind until the TTL lapses.
				const WRITE_PREFIXES = [
					"create",
					"update",
					"toggle",
					"publish",
					"archive",
					"remove",
					"delete",
					"set",
					"add",
				];
				const writeActions = Object.keys(svc.actions || {}).filter((a) =>
					WRITE_PREFIXES.some((p) => a.toLowerCase().startsWith(p))
				);

				const hooked = new Set();
				for (const m of svc.mixins || []) {
					if (m && m.hooks && m.hooks.after) {
						Object.keys(m.hooks.after).forEach((a) => hooked.add(a));
					}
				}

				const missing = writeActions.filter((a) => !hooked.has(a));
				expect(missing).toEqual([]);
			}
		);
	});
});

// ─── Behavioural: does caching + invalidation actually work end to end? ───────

describe("cache behaviour", () => {
	let broker;
	let dbHits;

	beforeEach(async () => {
		dbHits = 0;

		broker = new ServiceBroker({
			logger: false,
			validator: true,
			// Mirrors moleculer.config.js — Memory cacher, cloned entries.
			cacher: { type: "Memory", options: { ttl: 60, max: 100, clone: true } },
		});

		broker.createService({
			name: "destination.model",
			actions: {
				find: {
					handler() {
						dbHits++;
						return [{ _id: "d1", name: "Volta", region: "Volta" }];
					},
				},
				get: { handler: () => ({ _id: "d1", name: "Volta", region: "Volta" }) },
				create: { handler: (ctx) => ({ _id: "new", ...ctx.params }) },
				update: { handler: (ctx) => ({ _id: ctx.params.id, ...ctx.params }) },
			},
		});
		for (const m of ["hotelPartner.model", "attraction.model", "diningPartner.model"]) {
			broker.createService({
				name: m,
				actions: { find: { handler: () => [] }, findByLocation: { handler: () => [] } },
			});
		}

		broker.createService(SERVICES.destination);
		await broker.start();
	});

	afterEach(async () => {
		await broker.stop();
	});

	it("serves a repeated identical read from cache (one DB hit, not two)", async () => {
		await broker.call("destination.list", {});
		await broker.call("destination.list", {});

		// This is the bandwidth saving: the second call never reaches Mongo.
		expect(dbHits).toBe(1);
	});

	it("treats different filters as different cache entries", async () => {
		await broker.call("destination.list", { region: "Volta" });
		await broker.call("destination.list", { region: "Ashanti" });

		expect(dbHits).toBe(2);
	});

	it("does NOT share a cache entry across organizations", async () => {
		await broker.call("destination.list", {}, { meta: { organizationId: "org-a" } });
		await broker.call("destination.list", {}, { meta: { organizationId: "org-b" } });

		// If this ever returns 1, org-b is being served org-a's data.
		expect(dbHits).toBe(2);
	});

	// ── Regression: the cacher runs before tenantScope ────────────────────────
	// This exact scenario leaked in development. api.service's authenticate()
	// sets meta.user.organizationId; the top-level meta.organizationId used to be
	// populated only by tenantScope.middleware — a USER middleware. Moleculer's
	// cacher is an INTERNAL middleware and wraps calls outside those, so it built
	// the key before the tenant was normalized. Both orgs produced the key
	// "…:undefined|customer" and the second org was served the first org's rows.
	//
	// Fixed in two independent places (authenticate() normalizes at the edge, and
	// TENANT_KEYS also reads #user.organizationId). This test fails if either the
	// middleware ordering assumption or the key composition regresses.
	it("does NOT leak across orgs when only meta.user.organizationId is set", async () => {
		await broker.call(
			"destination.list",
			{},
			{ meta: { user: { id: "u1", role: "customer", organizationId: "ORG-A" } } }
		);
		await broker.call(
			"destination.list",
			{},
			{ meta: { user: { id: "u2", role: "customer", organizationId: "ORG-B" } } }
		);

		expect(dbHits).toBe(2);
	});

	it("does NOT share a cache entry across roles", async () => {
		// tourPackage.list shows drafts to admins; the same key for both roles
		// would expose unpublished records to the public.
		await broker.call("destination.list", {}, { meta: { user: { role: "customer" } } });
		await broker.call("destination.list", {}, { meta: { user: { role: "admin" } } });

		expect(dbHits).toBe(2);
	});

	it("invalidates the cache after a write", async () => {
		await broker.call("destination.list", {});
		expect(dbHits).toBe(1);

		await broker.call(
			"destination.update",
			{ id: "d1", name: "Volta Renamed" },
			{ meta: { user: { _id: "admin-1", role: "admin" } } }
		);

		// The next read must go back to the DB, not serve the pre-write name.
		await broker.call("destination.list", {});
		expect(dbHits).toBe(2);
	});

	it("returns a clone, so a caller mutating the result cannot poison the cache", async () => {
		const first = await broker.call("destination.list", {});
		first[0].name = "MUTATED";

		const second = await broker.call("destination.list", {});
		expect(second[0].name).toBe("Volta");
	});
});
