"use strict";

const { ServiceBroker } = require("moleculer");
const AttractionService = require("../../../services/attraction.service");
const { ERROR_CODES } = require("../../../utils/constants");

// Covers the attraction CRUD surface. Field-contract / mass-assignment
// assertions live in adminFieldContract.test.js.

const mockDestination = {
	_id: "dest-1",
	name: "Cape Coast",
	region: "Central",
	isActive: true,
};

const mockAttraction = {
	_id: "attr-1",
	name: "Cape Coast Castle",
	destinationId: "dest-1",
	category: "fort",
	entryFee: 40,
	isActive: true,
};

const mockAttraction2 = {
	_id: "attr-2",
	name: "Kakum Canopy Walk",
	destinationId: "dest-1",
	category: "natural_site",
	entryFee: 60,
	isActive: true,
};

let modelCallResults = {};

function createBroker() {
	const broker = new ServiceBroker({ logger: false, validator: true });

	broker.createService({
		name: "destination.model",
		actions: {
			get: {
				handler(ctx) {
					const r = modelCallResults["destination.model.get"];
					return typeof r === "function" ? r(ctx.params) : r || null;
				},
			},
			find: { handler: () => [] },
		},
	});

	broker.createService({
		name: "attraction.model",
		actions: {
			find: {
				handler(ctx) {
					const r = modelCallResults["attraction.model.find"];
					return typeof r === "function" ? r(ctx.params) : r || [];
				},
			},
			findByLocation: {
				handler(ctx) {
					const r = modelCallResults["attraction.model.findByLocation"];
					return typeof r === "function" ? r(ctx.params) : r || [];
				},
			},
			get: {
				handler(ctx) {
					const r = modelCallResults["attraction.model.get"];
					return typeof r === "function" ? r(ctx.params) : r || null;
				},
			},
			create: {
				handler(ctx) {
					const r = modelCallResults["attraction.model.create"];
					return typeof r === "function" ? r(ctx.params) : r || {};
				},
			},
			update: {
				handler(ctx) {
					const r = modelCallResults["attraction.model.update"];
					return typeof r === "function" ? r(ctx.params) : r || {};
				},
			},
		},
	});

	broker.createService(AttractionService);
	return broker;
}

describe("Attraction Service", () => {
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

	describe("listCategories", () => {
		it("returns the canonical vocabulary with readable labels", async () => {
			const result = await broker.call("attraction.listCategories");

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBeGreaterThan(10);

			const museum = result.find((c) => c.value === "museum");
			expect(museum).toEqual({ value: "museum", label: "Museum" });

			// Multi-word values are title-cased across the underscore.
			const slaveSite = result.find((c) => c.value === "slave_trade_site");
			expect(slaveSite.label).toBe("Slave Trade Site");
		});
	});

	describe("list", () => {
		it("returns attractions", async () => {
			modelCallResults["attraction.model.find"] = () => [mockAttraction, mockAttraction2];

			const result = await broker.call("attraction.list");
			expect(result).toHaveLength(2);
		});

		it("filters by destinationId, category and isActive", async () => {
			let received = null;
			modelCallResults["attraction.model.find"] = (params) => {
				received = params;
				return [mockAttraction];
			};

			await broker.call("attraction.list", {
				destinationId: "dest-1",
				category: "fort",
				isActive: true,
			});

			expect(received.query).toEqual({
				destinationId: "dest-1",
				category: "fort",
				isActive: true,
			});
		});

		it("maps a known sort key to a mongo sort expression", async () => {
			let received = null;
			modelCallResults["attraction.model.find"] = (params) => {
				received = params;
				return [];
			};

			await broker.call("attraction.list", { sort: "price_desc" });
			expect(received.sort).toBe("-entryFee");
		});

		it("ignores an unknown sort key", async () => {
			let received = null;
			modelCallResults["attraction.model.find"] = (params) => {
				received = params;
				return [];
			};

			await broker.call("attraction.list", { sort: "not_a_sort" });
			expect(received.sort).toBeUndefined();
		});

		it("passes pagination through", async () => {
			let received = null;
			modelCallResults["attraction.model.find"] = (params) => {
				received = params;
				return [];
			};

			await broker.call("attraction.list", { page: 2, pageSize: 10 });
			expect(received.page).toBe(2);
			expect(received.pageSize).toBe(10);
		});
	});

	describe("get", () => {
		it("returns the attraction on happy path", async () => {
			modelCallResults["attraction.model.get"] = () => mockAttraction;

			const result = await broker.call("attraction.get", { id: "attr-1" });
			expect(result._id).toBe("attr-1");
		});

		it("throws NOT_FOUND for an unknown id", async () => {
			modelCallResults["attraction.model.get"] = () => null;

			await expect(
				broker.call("attraction.get", { id: "nope" })
			).rejects.toMatchObject({ code: 404, type: ERROR_CODES.NOT_FOUND });
		});
	});

	describe("getByDestination", () => {
		it("queries only active attractions for the destination", async () => {
			let received = null;
			modelCallResults["attraction.model.find"] = (params) => {
				received = params;
				return [mockAttraction];
			};

			await broker.call("attraction.getByDestination", { destinationId: "dest-1" });
			expect(received.query).toEqual({ destinationId: "dest-1", isActive: true });
		});
	});

	describe("findNearby", () => {
		it("converts km to metres and annotates distanceKm", async () => {
			let received = null;
			modelCallResults["attraction.model.findByLocation"] = (params) => {
				received = params;
				return [{ ...mockAttraction, distance: 2500 }];
			};

			const result = await broker.call("attraction.findNearby", {
				lat: 5.1,
				lng: -1.2,
				maxDistanceKm: 5,
			});

			expect(received.maxDistanceMeters).toBe(5000);
			expect(result[0].distanceKm).toBe("2.50");
		});

		it("returns null distanceKm when the model omits distance", async () => {
			modelCallResults["attraction.model.findByLocation"] = () => [mockAttraction];

			const result = await broker.call("attraction.findNearby", { lat: 5.1, lng: -1.2 });
			expect(result[0].distanceKm).toBeNull();
		});
	});

	describe("create", () => {
		it("creates an attraction when the destination exists", async () => {
			modelCallResults["destination.model.get"] = () => mockDestination;
			modelCallResults["attraction.model.create"] = (params) => ({ _id: "new", ...params });

			const result = await broker.call("attraction.create", {
				name: "Elmina Castle",
				destinationId: "dest-1",
				category: "fort",
			});

			expect(result._id).toBe("new");
			expect(result.name).toBe("Elmina Castle");
		});

		it("throws DESTINATION_NOT_FOUND when the destination is missing", async () => {
			modelCallResults["destination.model.get"] = () => null;

			await expect(
				broker.call("attraction.create", { name: "Ghost", destinationId: "bad" })
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.DESTINATION_NOT_FOUND,
			});
		});
	});

	describe("update", () => {
		it("updates an existing attraction", async () => {
			modelCallResults["attraction.model.get"] = () => mockAttraction;
			modelCallResults["attraction.model.update"] = (params) => ({
				...mockAttraction,
				...params,
			});

			const result = await broker.call("attraction.update", {
				id: "attr-1",
				entryFee: 55,
			});

			expect(result.entryFee).toBe(55);
		});

		it("throws NOT_FOUND for an unknown id", async () => {
			modelCallResults["attraction.model.get"] = () => null;

			await expect(
				broker.call("attraction.update", { id: "nope", name: "X" })
			).rejects.toMatchObject({ code: 404, type: ERROR_CODES.NOT_FOUND });
		});
	});

	describe("toggleActive", () => {
		it("flips isActive true -> false", async () => {
			modelCallResults["attraction.model.get"] = () => mockAttraction;
			let received = null;
			modelCallResults["attraction.model.update"] = (params) => {
				received = params;
				return { ...mockAttraction, ...params };
			};

			await broker.call("attraction.toggleActive", { id: "attr-1" });
			expect(received.isActive).toBe(false);
		});

		it("flips isActive false -> true", async () => {
			modelCallResults["attraction.model.get"] = () => ({
				...mockAttraction,
				isActive: false,
			});
			let received = null;
			modelCallResults["attraction.model.update"] = (params) => {
				received = params;
				return params;
			};

			await broker.call("attraction.toggleActive", { id: "attr-1" });
			expect(received.isActive).toBe(true);
		});

		it("throws NOT_FOUND for an unknown id", async () => {
			modelCallResults["attraction.model.get"] = () => null;

			await expect(
				broker.call("attraction.toggleActive", { id: "nope" })
			).rejects.toMatchObject({ code: 404 });
		});
	});
});
