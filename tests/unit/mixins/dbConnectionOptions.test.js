"use strict";

const { buildConnectionOptions } = require("../../../mixins/db.mixin");

// ─── MongoDB connection options ───────────────────────────────────────────────
// MongoDB Atlas is off-platform, so every byte to and from it is billed egress.
// With driver defaults this service burned ~5 GB/month, the bulk of it while
// completely idle (the driver pings every replica-set node every 10s, forever).
//
// These options are the fix. They are cheap to regress silently — someone
// "cleaning up" the connect call would restore the defaults and the bill with
// them — so they're pinned here with the reasoning attached.

describe("mongo connection options", () => {
	const ORIGINAL_ENV = { ...process.env };

	afterEach(() => {
		process.env = { ...ORIGINAL_ENV };
	});

	describe("defaults", () => {
		let opts;

		beforeEach(() => {
			delete process.env.MONGO_COMPRESSORS;
			delete process.env.MONGO_ZLIB_LEVEL;
			delete process.env.MONGO_HEARTBEAT_MS;
			delete process.env.MONGO_MAX_POOL;
			delete process.env.MONGO_MIN_POOL;
			delete process.env.MONGO_AUTO_INDEX;
			opts = buildConnectionOptions();
		});

		it("enables wire compression (largest single bandwidth saving)", () => {
			// zlib ships with Node, so this needs no extra dependency.
			expect(opts.compressors).toBe("zlib");
			expect(opts.zlibCompressionLevel).toBe(6);
		});

		it("slows the idle heartbeat well below the 10s driver default", () => {
			// 10s x 3 nodes is ~780k pings/month with zero users. 60s cuts it ~6x.
			expect(opts.heartbeatFrequencyMS).toBe(60000);
			expect(opts.heartbeatFrequencyMS).toBeGreaterThanOrEqual(30000);
		});

		it("caps the pool far below the driver default of 100", () => {
			// Each pooled connection adds monitoring traffic and a TLS handshake.
			expect(opts.maxPoolSize).toBe(10);
			expect(opts.maxPoolSize).toBeLessThanOrEqual(20);
			expect(opts.minPoolSize).toBe(0);
		});
	});

	describe("autoIndex", () => {
		it("is disabled in production (indexes belong in a migration)", () => {
			process.env.NODE_ENV = "production";
			delete process.env.MONGO_AUTO_INDEX;

			// Re-issuing createIndexes for ~35 models on every cold start is pure
			// waste on a platform that spins down.
			expect(buildConnectionOptions().autoIndex).toBe(false);
		});

		it("stays enabled outside production so local and test self-heal", () => {
			process.env.NODE_ENV = "development";
			delete process.env.MONGO_AUTO_INDEX;

			expect(buildConnectionOptions().autoIndex).toBe(true);
		});

		it("can be forced on in production via env for a one-off index build", () => {
			process.env.NODE_ENV = "production";
			process.env.MONGO_AUTO_INDEX = "true";

			expect(buildConnectionOptions().autoIndex).toBe(true);
		});
	});

	describe("env overrides", () => {
		it("honours numeric overrides", () => {
			process.env.MONGO_HEARTBEAT_MS = "45000";
			process.env.MONGO_MAX_POOL = "5";
			process.env.MONGO_ZLIB_LEVEL = "9";

			const opts = buildConnectionOptions();
			expect(opts.heartbeatFrequencyMS).toBe(45000);
			expect(opts.maxPoolSize).toBe(5);
			expect(opts.zlibCompressionLevel).toBe(9);
		});

		it("falls back to the safe default when an override is not a number", () => {
			// A typo in a dashboard env var must not silently produce NaN, which
			// the driver would either reject or treat as a default.
			process.env.MONGO_HEARTBEAT_MS = "not-a-number";
			process.env.MONGO_MAX_POOL = "";

			const opts = buildConnectionOptions();
			expect(opts.heartbeatFrequencyMS).toBe(60000);
			expect(opts.maxPoolSize).toBe(10);
		});

		it("allows swapping the compressor (e.g. zstd once installed)", () => {
			process.env.MONGO_COMPRESSORS = "zstd";
			expect(buildConnectionOptions().compressors).toBe("zstd");
		});
	});
});
