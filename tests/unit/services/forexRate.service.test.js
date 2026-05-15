"use strict";

const { ServiceBroker } = require("moleculer");
const ForexRateService = require("../../../services/forexRate.service");
const { ERROR_CODES, CURRENCIES } = require("../../../utils/constants");

const mockUsdGhsRate = {
	_id: "fx-1",
	fromCurrency: CURRENCIES.USD,
	toCurrency: CURRENCIES.GHS,
	rate: 12.5,
	markupPercent: 0,
	effectiveDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
	isActive: true,
};

const mockUsdGhsRateWithMarkup = {
	_id: "fx-2",
	fromCurrency: CURRENCIES.USD,
	toCurrency: CURRENCIES.GHS,
	rate: 12,
	markupPercent: 2.5,
	effectiveDate: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
	isActive: true,
};

let modelCallResults = {};

function createBroker() {
	const broker = new ServiceBroker({ logger: false, validator: true });

	function resolveMock(key, ctx) {
		const r = modelCallResults[key];
		if (typeof r === "function") return r(ctx ? ctx.params : undefined);
		return r;
	}

	broker.createService({
		name: "forexRate.model",
		actions: {
			find: { handler(ctx) { return resolveMock("forexRate.model.find", ctx) || []; } },
			get: { handler(ctx) { return resolveMock("forexRate.model.get", ctx) || null; } },
			create: {
				handler(ctx) {
					const r = modelCallResults["forexRate.model.create"];
					if (typeof r === "function") return r(ctx.params);
					return { _id: "new-fx", ...ctx.params };
				},
			},
			update: {
				handler(ctx) {
					return { _id: ctx.params.id, ...ctx.params };
				},
			},
		},
	});

	broker.createService(ForexRateService);
	return broker;
}

const adminMeta = { user: { id: "admin-1", role: "admin", email: "admin@test" } };

describe("forexRate.service", () => {
	let broker;

	beforeAll(async () => {
		broker = createBroker();
		await broker.start();
	});

	afterAll(async () => {
		await broker.stop();
	});

	beforeEach(() => {
		modelCallResults = {};
	});

	describe("getCurrent", () => {
		it("returns null when from == to (no conversion needed)", async () => {
			const result = await broker.call("forexRate.getCurrent", {
				fromCurrency: CURRENCIES.GHS,
				toCurrency: CURRENCIES.GHS,
			});
			expect(result).toBeNull();
		});

		it("returns the most recent active rate for a pair", async () => {
			modelCallResults["forexRate.model.find"] = () => [mockUsdGhsRate];

			const rate = await broker.call("forexRate.getCurrent", {
				fromCurrency: CURRENCIES.USD,
				toCurrency: CURRENCIES.GHS,
			});

			expect(rate).toBeTruthy();
			expect(rate.rate).toBe(12.5);
			expect(rate.fromCurrency).toBe(CURRENCIES.USD);
		});

		it("throws FOREX_RATE_NOT_FOUND when no active rate exists", async () => {
			modelCallResults["forexRate.model.find"] = () => [];

			await expect(
				broker.call("forexRate.getCurrent", {
					fromCurrency: CURRENCIES.USD,
					toCurrency: CURRENCIES.GHS,
				})
			).rejects.toMatchObject({ type: ERROR_CODES.FOREX_RATE_NOT_FOUND });
		});

		it("throws UNSUPPORTED_CURRENCY for unknown codes", async () => {
			await expect(
				broker.call("forexRate.getCurrent", {
					fromCurrency: "XYZ",
					toCurrency: CURRENCIES.GHS,
				})
			).rejects.toMatchObject({ type: ERROR_CODES.UNSUPPORTED_CURRENCY });
		});
	});

	describe("convert", () => {
		it("returns input amount unchanged when currencies match", async () => {
			const result = await broker.call("forexRate.convert", {
				amount: 1000,
				fromCurrency: CURRENCIES.GHS,
				toCurrency: CURRENCIES.GHS,
			});
			expect(result.amount).toBe(1000);
			expect(result.rate).toBe(1);
			expect(result.fxRate).toBeNull();
		});

		it("converts using the most recent rate (no markup)", async () => {
			modelCallResults["forexRate.model.find"] = () => [mockUsdGhsRate];

			const result = await broker.call("forexRate.convert", {
				amount: 1500,
				fromCurrency: CURRENCIES.USD,
				toCurrency: CURRENCIES.GHS,
			});

			expect(result.amount).toBe(18750); // 1500 * 12.5
			expect(result.effectiveRate).toBe(12.5);
			expect(result.rate).toBe(12.5);
			expect(result.fxRate).toMatchObject({ _id: "fx-1" });
		});

		it("applies markup when present on the rate", async () => {
			modelCallResults["forexRate.model.find"] = () => [mockUsdGhsRateWithMarkup];

			const result = await broker.call("forexRate.convert", {
				amount: 1500,
				fromCurrency: CURRENCIES.USD,
				toCurrency: CURRENCIES.GHS,
			});

			// 1500 * 12 * 1.025 = 18450
			expect(result.amount).toBe(18450);
			expect(result.effectiveRate).toBeCloseTo(12.3, 4);
		});
	});

	describe("create", () => {
		it("rejects unsupported currency codes", async () => {
			await expect(
				broker.call(
					"forexRate.create",
					{ fromCurrency: "ZZZ", toCurrency: CURRENCIES.GHS, rate: 1 },
					{ meta: adminMeta }
				)
			).rejects.toMatchObject({ type: ERROR_CODES.UNSUPPORTED_CURRENCY });
		});

		it("rejects when from and to currencies match", async () => {
			await expect(
				broker.call(
					"forexRate.create",
					{ fromCurrency: CURRENCIES.GHS, toCurrency: CURRENCIES.GHS, rate: 1 },
					{ meta: adminMeta }
				)
			).rejects.toMatchObject({ type: ERROR_CODES.VALIDATION_ERROR });
		});

		it("creates a rate document for a valid pair", async () => {
			const created = await broker.call(
				"forexRate.create",
				{
					fromCurrency: CURRENCIES.USD,
					toCurrency: CURRENCIES.GHS,
					rate: 12.75,
					markupPercent: 1,
					note: "Daily rate",
				},
				{ meta: adminMeta }
			);

			expect(created.fromCurrency).toBe(CURRENCIES.USD);
			expect(created.toCurrency).toBe(CURRENCIES.GHS);
			expect(created.rate).toBe(12.75);
			expect(created.isActive).toBe(true);
		});
	});
});
