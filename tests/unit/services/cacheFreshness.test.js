"use strict";

const { ServiceBroker } = require("moleculer");
const { TTL } = require("../../../config/cache.config");
const moleculerConfig = require("../../../moleculer.config");

// ─── Cache freshness: does an admin edit reach the next visitor? ──────────────
// cachePolicy.test.js proves the cache is scoped correctly and that every write
// action is hooked. This suite proves the behaviour those hooks are meant to
// produce, end to end through a real broker + real Memory cacher:
//
//   admin saves a change  ->  the very next public read returns the NEW value
//
// It also pins the two honest limits of invalidation-on-write, so nobody
// discovers them in production:
//   * a change written straight to MongoDB (seed script, Compass, mongosh)
//     bypasses the API, so nothing invalidates — stale until the TTL lapses
//   * the TTL is the backstop that eventually heals that case

// Mutable "database" the stub model services read from, so a test can change
// the underlying data either through an action (invalidating) or behind the
// cache's back (not invalidating).
let db;

// Counts trips to the "database", incremented inside the stub handlers.
// (Reassigning service.actions.* does NOT intercept ctx.call — Moleculer
// resolves actions through the registry, not that property.)
let reads;

function resetDb() {
	db = {
		tours: [{ _id: "pkg-1", title: "Original Tour", isActive: true, status: "published" }],
		destinations: [{ _id: "dest-1", name: "Original Destination", region: "Volta", isActive: true }],
	};
	reads = { destinations: 0, tours: 0 };
}

const publicMeta = {};                                   // anonymous visitor
const adminMeta = { user: { _id: "admin-1", role: "admin" } };

function createBroker() {
	const broker = new ServiceBroker({
		logger: false,
		validator: true,
		// The REAL production cacher config — including clone: true, which is
		// what stops a caller mutating a cached entry in place.
		cacher: moleculerConfig.cacher,
	});

	broker.createService({
		name: "destination.model",
		actions: {
			find: {
				handler() {
					reads.destinations++;
					return db.destinations;
				},
			},
			get: { handler: (ctx) => db.destinations.find((d) => d._id === ctx.params.id) || null },
			count: { handler: () => db.destinations.length },
			create: {
				handler(ctx) {
					const doc = { _id: "dest-new", ...ctx.params };
					db.destinations.push(doc);
					return doc;
				},
			},
			update: {
				handler(ctx) {
					const doc = db.destinations.find((d) => d._id === ctx.params.id);
					Object.assign(doc, ctx.params);
					return doc;
				},
			},
		},
	});

	broker.createService({
		name: "tourPackage.model",
		actions: {
			find: {
				handler() {
					reads.tours++;
					return db.tours;
				},
			},
			get: { handler: (ctx) => db.tours.find((t) => t._id === ctx.params.id) || null },
			count: { handler: () => db.tours.length },
			create: { handler: (ctx) => ({ _id: "pkg-new", ...ctx.params }) },
			update: {
				handler(ctx) {
					const doc = db.tours.find((t) => t._id === ctx.params.id);
					Object.assign(doc, ctx.params);
					return doc;
				},
			},
			incrementField: { handler: () => null },
		},
	});

	for (const name of [
		"hotelPartner.model",
		"attraction.model",
		"diningPartner.model",
		"packagePricing.model",
		"review.model",
		"waitlistEntry.model",
	]) {
		broker.createService({
			name,
			actions: {
				find: { handler: () => [] },
				get: { handler: () => null },
				count: { handler: () => 0 },
				create: { handler: (ctx) => ctx.params },
				update: { handler: (ctx) => ctx.params },
				remove: { handler: () => ({}) },
			},
		});
	}

	broker.createService(require("../../../services/destination.service"));
	broker.createService(require("../../../services/tourPackage.service"));
	return broker;
}

describe("cache freshness — admin edits reach the next visitor", () => {
	let broker;

	beforeAll(async () => {
		broker = createBroker();
		await broker.start();
	});

	afterAll(async () => {
		await broker.stop();
	});

	beforeEach(async () => {
		resetDb();
		await broker.cacher.clean("**");
	});

	it("serves a repeated identical read from cache (the bandwidth win)", async () => {
		await broker.call("destination.list", {}, { meta: publicMeta });
		await broker.call("destination.list", {}, { meta: publicMeta });
		await broker.call("destination.list", {}, { meta: publicMeta });

		// Three identical page loads, one trip to the database.
		expect(reads.destinations).toBe(1);
	});

	it("returns the NEW value on the next read after an admin update", async () => {
		// A visitor warms the cache.
		const before = await broker.call("destination.list", {}, { meta: publicMeta });
		expect(before[0].name).toBe("Original Destination");

		// Admin renames it through the API.
		await broker.call(
			"destination.update",
			{ id: "dest-1", name: "Renamed Destination" },
			{ meta: adminMeta }
		);

		// The very next visitor read is fresh — no waiting for the TTL.
		const after = await broker.call("destination.list", {}, { meta: publicMeta });
		expect(after[0].name).toBe("Renamed Destination");
	});

	it("returns the NEW value after an admin toggles visibility", async () => {
		await broker.call("destination.list", {}, { meta: publicMeta });

		await broker.call("destination.toggleActive", { id: "dest-1" }, { meta: adminMeta });

		const after = await broker.call("destination.list", {}, { meta: publicMeta });
		expect(after[0].isActive).toBe(false);
	});

	it("clears tour caches too when a destination changes (cross-resource)", async () => {
		// Tour listings embed destination data, so a destination edit must not
		// leave tour cards showing the old destination name.
		await broker.call("tourPackage.list", {}, { meta: publicMeta });
		// Confirm it really is cached before we test eviction.
		await broker.call("tourPackage.list", {}, { meta: publicMeta });
		const readsBeforeWrite = reads.tours;
		expect(readsBeforeWrite).toBe(1);

		await broker.call(
			"destination.update",
			{ id: "dest-1", name: "Cross Invalidated" },
			{ meta: adminMeta }
		);

		// The destination write must have evicted the tourPackage entry, so this
		// read goes back to the database.
		await broker.call("tourPackage.list", {}, { meta: publicMeta });
		expect(reads.tours).toBeGreaterThan(readsBeforeWrite);
	});

	it("returns the NEW value on the next read after a tour package update", async () => {
		const before = await broker.call("tourPackage.list", {}, { meta: publicMeta });
		const originalTitle = (before.rows || before)[0]?.title ?? before[0]?.title;
		expect(originalTitle).toBe("Original Tour");

		await broker.call(
			"tourPackage.update",
			{ id: "pkg-1", title: "Updated Tour" },
			{ meta: adminMeta }
		);

		const after = await broker.call("tourPackage.list", {}, { meta: publicMeta });
		const newTitle = (after.rows || after)[0]?.title ?? after[0]?.title;
		expect(newTitle).toBe("Updated Tour");
	});

	// ── Poisoning: can a caller corrupt what everyone else gets? ─────────────
	describe("cache poisoning", () => {
		it("a caller mutating its result does not corrupt the cached entry", async () => {
			// This is the poisoning vector that clone:true exists to close.
			// Enrichment code across these services spreads and mutates result
			// objects; without cloning, that mutation would land in the shared
			// cache and every later visitor would see the corrupted value.
			const first = await broker.call("destination.list", {}, { meta: publicMeta });
			first[0].name = "POISONED";
			first[0].injectedField = "should not persist";

			const second = await broker.call("destination.list", {}, { meta: publicMeta });
			expect(second[0].name).toBe("Original Destination");
			expect(second[0].injectedField).toBeUndefined();
		});

		it("keeps the cached copy isolated from later mutations of the source row", async () => {
			// The cached entry must be a snapshot, not a live window onto the
			// object the model layer returned.
			await broker.call("destination.list", {}, { meta: publicMeta });
			db.destinations[0].name = "Mutated After Caching";

			const cached = await broker.call("destination.list", {}, { meta: publicMeta });
			expect(cached[0].name).toBe("Original Destination");
			expect(reads.destinations).toBe(1); // served from cache, never re-read
		});
	});

	// ── The honest limits ────────────────────────────────────────────────────
	describe("known limits of invalidation-on-write", () => {
		it("does NOT pick up a change written directly to the database", async () => {
			await broker.call("destination.list", {}, { meta: publicMeta });

			// Simulates a seed script / Compass / mongosh edit: the API never runs,
			// so no hook fires and nothing is invalidated.
			db.destinations[0].name = "Changed Behind The Cache";

			const after = await broker.call("destination.list", {}, { meta: publicMeta });
			expect(after[0].name).toBe("Original Destination"); // still stale, by design
		});

		it("heals a direct-DB change once the TTL lapses", async () => {
			jest.useFakeTimers();
			try {
				await broker.call("destination.list", {}, { meta: publicMeta });
				db.destinations[0].name = "Changed Behind The Cache";

				// Advance past the catalogue TTL — the entry expires and the next
				// read goes back to the database.
				jest.advanceTimersByTime((TTL.CATALOGUE + 5) * 1000);

				const after = await broker.call("destination.list", {}, { meta: publicMeta });
				expect(after[0].name).toBe("Changed Behind The Cache");
			} finally {
				jest.useRealTimers();
			}
		});

		it("caps worst-case staleness at the configured TTLs", () => {
			// Documents the actual exposure window in one assertion.
			expect(TTL.CATALOGUE).toBeLessThanOrEqual(60);
			expect(TTL.DETAIL).toBeLessThanOrEqual(120);
		});
	});
});
