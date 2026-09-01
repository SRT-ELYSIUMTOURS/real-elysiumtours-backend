"use strict";

const { ServiceBroker } = require("moleculer");
const DiningService = require("../../../services/dining.service");
const { ERROR_CODES } = require("../../../utils/constants");

// Covers the dining CRUD surface. Field-contract / mass-assignment assertions
// live in adminFieldContract.test.js.

const mockDestination = {
	_id: "dest-1",
	name: "Accra",
	region: "Greater Accra",
	isActive: true,
};

const mockDining = {
	_id: "dine-1",
	name: "Buka Restaurant",
	destinationId: "dest-1",
	cuisineType: "Ghanaian",
	tier: "standard",
	commissionRate: 0.1,
	isActive: true,
};

const mockDining2 = {
	_id: "dine-2",
	name: "Santoku",
	destinationId: "dest-1",
	cuisineType: "Japanese",
	tier: "premium",
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
		name: "diningPartner.model",
		actions: {
			find: {
				handler(ctx) {
					const r = modelCallResults["diningPartner.model.find"];
					return typeof r === "function" ? r(ctx.params) : r || [];
				},
			},
			findByLocation: {
				handler(ctx) {
					const r = modelCallResults["diningPartner.model.findByLocation"];
					return typeof r === "function" ? r(ctx.params) : r || [];
				},
			},
			get: {
				handler(ctx) {
					const r = modelCallResults["diningPartner.model.get"];
					return typeof r === "function" ? r(ctx.params) : r || null;
				},
			},
			create: {
				handler(ctx) {
					const r = modelCallResults["diningPartner.model.create"];
					return typeof r === "function" ? r(ctx.params) : r || {};
				},
			},
			update: {
				handler(ctx) {
					const r = modelCallResults["diningPartner.model.update"];
					return typeof r === "function" ? r(ctx.params) : r || {};
				},
			},
		},
	});

	broker.createService(DiningService);
	return broker;
}

describe("Dining Service", () => {
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

	describe("list", () => {
		it("returns dining partners", async () => {
			modelCallResults["diningPartner.model.find"] = () => [mockDining, mockDining2];

			const result = await broker.call("dining.list");
			expect(result).toHaveLength(2);
		});

		it("filters by destinationId, cuisineType and isActive", async () => {
			let received = null;
			modelCallResults["diningPartner.model.find"] = (params) => {
				received = params;
				return [mockDining];
			};

			await broker.call("dining.list", {
				destinationId: "dest-1",
				cuisineType: "Ghanaian",
				isActive: true,
			});

			expect(received.query).toEqual({
				destinationId: "dest-1",
				cuisineType: "Ghanaian",
				isActive: true,
			});
		});

		it("maps a known sort key to a mongo sort expression", async () => {
			let received = null;
			modelCallResults["diningPartner.model.find"] = (params) => {
				received = params;
				return [];
			};

			await broker.call("dining.list", { sort: "rating_desc" });
			expect(received.sort).toBe("-rating");
		});

		it("ignores an unknown sort key", async () => {
			let received = null;
			modelCallResults["diningPartner.model.find"] = (params) => {
				received = params;
				return [];
			};

			await broker.call("dining.list", { sort: "bogus" });
			expect(received.sort).toBeUndefined();
		});

		it("passes pagination through", async () => {
			let received = null;
			modelCallResults["diningPartner.model.find"] = (params) => {
				received = params;
				return [];
			};

			await broker.call("dining.list", { page: 3, pageSize: 5 });
			expect(received.page).toBe(3);
			expect(received.pageSize).toBe(5);
		});
	});

	describe("get", () => {
		it("returns the partner on happy path", async () => {
			modelCallResults["diningPartner.model.get"] = () => mockDining;

			const result = await broker.call("dining.get", { id: "dine-1" });
			expect(result._id).toBe("dine-1");
		});

		it("throws PARTNER_NOT_FOUND for an unknown id", async () => {
			modelCallResults["diningPartner.model.get"] = () => null;

			await expect(
				broker.call("dining.get", { id: "nope" })
			).rejects.toMatchObject({ code: 404, type: ERROR_CODES.PARTNER_NOT_FOUND });
		});
	});

	describe("getByDestination", () => {
		it("queries only active partners for the destination", async () => {
			let received = null;
			modelCallResults["diningPartner.model.find"] = (params) => {
				received = params;
				return [mockDining];
			};

			await broker.call("dining.getByDestination", { destinationId: "dest-1" });
			expect(received.query).toEqual({ destinationId: "dest-1", isActive: true });
		});
	});

	describe("findNearby", () => {
		it("converts km to metres and annotates distanceKm", async () => {
			let received = null;
			modelCallResults["diningPartner.model.findByLocation"] = (params) => {
				received = params;
				return [{ ...mockDining, distance: 1500 }];
			};

			const result = await broker.call("dining.findNearby", {
				lat: 5.6,
				lng: -0.2,
				maxDistanceKm: 3,
			});

			expect(received.maxDistanceMeters).toBe(3000);
			expect(result[0].distanceKm).toBe("1.50");
		});

		it("returns null distanceKm when the model omits distance", async () => {
			modelCallResults["diningPartner.model.findByLocation"] = () => [mockDining];

			const result = await broker.call("dining.findNearby", { lat: 5.6, lng: -0.2 });
			expect(result[0].distanceKm).toBeNull();
		});
	});

	describe("create", () => {
		it("creates a partner when the destination exists", async () => {
			modelCallResults["destination.model.get"] = () => mockDestination;
			modelCallResults["diningPartner.model.create"] = (params) => ({ _id: "new", ...params });

			const result = await broker.call("dining.create", {
				name: "Chez Afrique",
				destinationId: "dest-1",
				cuisineType: "Ghanaian",
				tier: "standard",
			});

			expect(result._id).toBe("new");
			expect(result.name).toBe("Chez Afrique");
		});

		it("persists tier and priceRange as distinct fields", async () => {
			modelCallResults["destination.model.get"] = () => mockDestination;
			let received = null;
			modelCallResults["diningPartner.model.create"] = (params) => {
				received = params;
				return { _id: "new", ...params };
			};

			await broker.call("dining.create", {
				name: "Two Field Test",
				destinationId: "dest-1",
				tier: "premium",
				priceRange: "moderate",
			});

			// These are separate schema fields with different vocabularies —
			// priceRange used to be dropped entirely.
			expect(received.tier).toBe("premium");
			expect(received.priceRange).toBe("moderate");
		});

		it("persists menu prices under pricePerPerson", async () => {
			modelCallResults["destination.model.get"] = () => mockDestination;
			let received = null;
			modelCallResults["diningPartner.model.create"] = (params) => {
				received = params;
				return { _id: "new", ...params };
			};

			await broker.call("dining.create", {
				name: "Menu Test",
				destinationId: "dest-1",
				menuOptions: [
					{ name: "Jollof", description: "Rice", pricePerPerson: 75 },
				],
			});

			expect(received.menuOptions[0].pricePerPerson).toBe(75);
		});

		it("throws DESTINATION_NOT_FOUND when the destination is missing", async () => {
			modelCallResults["destination.model.get"] = () => null;

			await expect(
				broker.call("dining.create", { name: "Ghost", destinationId: "bad" })
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.DESTINATION_NOT_FOUND,
			});
		});
	});

	describe("update", () => {
		it("updates an existing partner", async () => {
			modelCallResults["diningPartner.model.get"] = () => mockDining;
			modelCallResults["diningPartner.model.update"] = (params) => ({
				...mockDining,
				...params,
			});

			const result = await broker.call("dining.update", {
				id: "dine-1",
				cuisineType: "Fusion",
			});

			expect(result.cuisineType).toBe("Fusion");
		});

		it("throws PARTNER_NOT_FOUND for an unknown id", async () => {
			modelCallResults["diningPartner.model.get"] = () => null;

			await expect(
				broker.call("dining.update", { id: "nope", name: "X" })
			).rejects.toMatchObject({ code: 404, type: ERROR_CODES.PARTNER_NOT_FOUND });
		});
	});

	describe("setCommission", () => {
		it("updates only the commission rate", async () => {
			modelCallResults["diningPartner.model.get"] = () => mockDining;
			let received = null;
			modelCallResults["diningPartner.model.update"] = (params) => {
				received = params;
				return { ...mockDining, ...params };
			};

			await broker.call("dining.setCommission", { id: "dine-1", commissionRate: 0.2 });

			expect(received).toEqual({ id: "dine-1", commissionRate: 0.2 });
		});

		it("throws PARTNER_NOT_FOUND for an unknown id", async () => {
			modelCallResults["diningPartner.model.get"] = () => null;

			await expect(
				broker.call("dining.setCommission", { id: "nope", commissionRate: 0.1 })
			).rejects.toMatchObject({ code: 404, type: ERROR_CODES.PARTNER_NOT_FOUND });
		});
	});

	describe("toggleActive", () => {
		it("flips isActive true -> false", async () => {
			modelCallResults["diningPartner.model.get"] = () => mockDining;
			let received = null;
			modelCallResults["diningPartner.model.update"] = (params) => {
				received = params;
				return params;
			};

			await broker.call("dining.toggleActive", { id: "dine-1" });
			expect(received.isActive).toBe(false);
		});

		it("flips isActive false -> true", async () => {
			modelCallResults["diningPartner.model.get"] = () => ({
				...mockDining,
				isActive: false,
			});
			let received = null;
			modelCallResults["diningPartner.model.update"] = (params) => {
				received = params;
				return params;
			};

			await broker.call("dining.toggleActive", { id: "dine-1" });
			expect(received.isActive).toBe(true);
		});

		it("throws PARTNER_NOT_FOUND for an unknown id", async () => {
			modelCallResults["diningPartner.model.get"] = () => null;

			await expect(
				broker.call("dining.toggleActive", { id: "nope" })
			).rejects.toMatchObject({ code: 404, type: ERROR_CODES.PARTNER_NOT_FOUND });
		});
	});
});
