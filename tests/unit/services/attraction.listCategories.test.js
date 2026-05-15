"use strict";

const { ServiceBroker } = require("moleculer");
const AttractionService = require("../../../services/attraction.service");
const { ATTRACTION_CATEGORIES } = require("../../../utils/constants");

function createBroker() {
	const broker = new ServiceBroker({ logger: false, validator: true });

	// Minimal model + destination mocks — listCategories doesn't touch the DB,
	// but the service declares them as dependencies.
	broker.createService({
		name: "attraction.model",
		actions: {
			find: { handler() { return []; } },
			get: { handler() { return null; } },
			create: { handler() { return {}; } },
			update: { handler() { return {}; } },
			findByLocation: { handler() { return []; } },
		},
	});
	broker.createService({
		name: "destination.model",
		actions: { get: { handler() { return null; } } },
	});

	broker.createService(AttractionService);
	return broker;
}

describe("attraction.listCategories", () => {
	let broker;

	beforeAll(async () => {
		broker = createBroker();
		await broker.start();
	});

	afterAll(async () => {
		await broker.stop();
	});

	it("returns every canonical category as a { value, label } pair", async () => {
		const result = await broker.call("attraction.listCategories");
		const values = result.map((c) => c.value);

		expect(values).toEqual(expect.arrayContaining(Object.values(ATTRACTION_CATEGORIES)));
		expect(values).toHaveLength(Object.values(ATTRACTION_CATEGORIES).length);
	});

	it("formats labels in Title Case from the underscored value", async () => {
		const result = await broker.call("attraction.listCategories");
		const dinner = result.find((c) => c.value === ATTRACTION_CATEGORIES.DINNER_EVENT);
		expect(dinner).toEqual({ value: "dinner_event", label: "Dinner Event" });

		const slave = result.find((c) => c.value === ATTRACTION_CATEGORIES.SLAVE_TRADE_SITE);
		expect(slave).toEqual({ value: "slave_trade_site", label: "Slave Trade Site" });
	});

	it("includes the Achimota-relevant categories (ceremony, dinner_event, slave_trade_site, boat_ride)", async () => {
		const result = await broker.call("attraction.listCategories");
		const values = result.map((c) => c.value);

		expect(values).toContain("ceremony");
		expect(values).toContain("dinner_event");
		expect(values).toContain("slave_trade_site");
		expect(values).toContain("boat_ride");
		expect(values).toContain("fort");
		expect(values).toContain("palace");
		expect(values).toContain("cultural_village");
	});

	it("is accessible without authentication (auth: undefined)", async () => {
		// No meta.user passed — should not throw
		const result = await broker.call("attraction.listCategories");
		expect(Array.isArray(result)).toBe(true);
	});
});
