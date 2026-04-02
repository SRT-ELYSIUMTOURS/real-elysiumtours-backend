"use strict";

const { ServiceBroker } = require("moleculer");
const DestinationService = require("../../../services/destination.service");
const { ERROR_CODES } = require("../../../utils/constants");

// ---- Test data ----

const mockDestination = {
	_id: "dest-1",
	name: "Bali Paradise",
	slug: "bali-paradise",
	region: "Asia",
	description: "A tropical paradise",
	isActive: true,
	images: [],
	highlights: [],
};

const mockDestination2 = {
	_id: "dest-2",
	name: "Santorini Dreams",
	slug: "santorini-dreams",
	region: "Europe",
	description: "Greek island getaway",
	isActive: true,
	images: [],
	highlights: [],
};

// Model call results — keyed by action name
let modelCallResults = {};

function createBroker() {
	const broker = new ServiceBroker({
		logger: false,
		validator: true,
	});

	// Mock destination.model service
	broker.createService({
		name: "destination.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["destination.model.find"] === "function"
						? modelCallResults["destination.model.find"](ctx.params)
						: modelCallResults["destination.model.find"] || [];
				},
			},
			get: {
				handler(ctx) {
					if (typeof modelCallResults["destination.model.get"] === "function") {
						return modelCallResults["destination.model.get"](ctx.params);
					}
					return modelCallResults["destination.model.get"] || null;
				},
			},
			create: {
				handler(ctx) {
					return typeof modelCallResults["destination.model.create"] === "function"
						? modelCallResults["destination.model.create"](ctx.params)
						: modelCallResults["destination.model.create"] || {};
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["destination.model.update"] === "function"
						? modelCallResults["destination.model.update"](ctx.params)
						: modelCallResults["destination.model.update"] || {};
				},
			},
		},
	});

	// Mock partner models (destination.service depends on them for findNearbyPartners)
	["hotelPartner.model", "attraction.model", "diningPartner.model"].forEach(name => {
		broker.createService({
			name,
			actions: {
				get: { handler() { return null; } },
				find: { handler() { return []; } },
				findByLocation: { handler() { return []; } },
			},
		});
	});

	// Load real destination service
	broker.createService(DestinationService);

	return broker;
}

// ---- Tests ----

describe("Destination Service", () => {
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

	// ========== list ==========

	describe("list", () => {
		it("should return an array of destinations", async () => {
			modelCallResults["destination.model.find"] = () => [mockDestination, mockDestination2];

			const result = await broker.call("destination.list", {});

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBe(2);
			expect(result[0].name).toBe("Bali Paradise");
		});
	});

	// ========== get ==========

	describe("get", () => {
		it("should return a destination on happy path", async () => {
			modelCallResults["destination.model.get"] = () => mockDestination;

			const result = await broker.call("destination.get", { id: "dest-1" });

			expect(result).toBeDefined();
			expect(result._id).toBe("dest-1");
			expect(result.name).toBe("Bali Paradise");
		});

		it("should throw DESTINATION_NOT_FOUND for invalid id", async () => {
			modelCallResults["destination.model.get"] = () => {
				throw new Error("not found");
			};

			await expect(
				broker.call("destination.get", { id: "invalid-id" })
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.DESTINATION_NOT_FOUND,
			});
		});
	});

	// ========== create ==========

	describe("create", () => {
		it("should create a destination with auto-generated slug", async () => {
			modelCallResults["destination.model.create"] = (params) => ({
				_id: "new-dest",
				...params,
			});

			const result = await broker.call("destination.create", {
				name: "Mount Fuji Escape",
				region: "Asia",
				description: "Beautiful mountain views",
			});

			expect(result._id).toBe("new-dest");
			expect(result.name).toBe("Mount Fuji Escape");
			expect(result.slug).toBe("mount-fuji-escape");
			expect(result.region).toBe("Asia");
		});

		it("should throw validation error when name is missing", async () => {
			await expect(
				broker.call("destination.create", {
					region: "Asia",
				})
			).rejects.toThrow();
		});

		it("should throw validation error when region is missing", async () => {
			await expect(
				broker.call("destination.create", {
					name: "Test Destination",
				})
			).rejects.toThrow();
		});
	});

	// ========== getBySlug ==========

	describe("getBySlug", () => {
		it("should return a destination by slug", async () => {
			modelCallResults["destination.model.find"] = (params) => {
				if (params.query && params.query.slug === "bali-paradise") {
					return [mockDestination];
				}
				return [];
			};

			const result = await broker.call("destination.getBySlug", { slug: "bali-paradise" });

			expect(result).toBeDefined();
			expect(result.slug).toBe("bali-paradise");
			expect(result.name).toBe("Bali Paradise");
		});

		it("should throw DESTINATION_NOT_FOUND for invalid slug", async () => {
			modelCallResults["destination.model.find"] = () => [];

			await expect(
				broker.call("destination.getBySlug", { slug: "non-existent" })
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.DESTINATION_NOT_FOUND,
			});
		});
	});

	// ========== listByRegion ==========

	describe("listByRegion", () => {
		it("should return destinations filtered by region", async () => {
			modelCallResults["destination.model.find"] = (params) => {
				if (params.query && params.query.region === "Asia") {
					return [mockDestination];
				}
				return [];
			};

			const result = await broker.call("destination.listByRegion", { region: "Asia" });

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBe(1);
			expect(result[0].region).toBe("Asia");
		});
	});

	// ========== toggleActive ==========

	describe("toggleActive", () => {
		it("should toggle isActive from true to false", async () => {
			modelCallResults["destination.model.get"] = () => ({ ...mockDestination, isActive: true });
			modelCallResults["destination.model.update"] = (params) => ({
				...mockDestination,
				isActive: params.isActive,
			});

			const result = await broker.call("destination.toggleActive", { id: "dest-1" });

			expect(result.isActive).toBe(false);
		});

		it("should toggle isActive from false to true", async () => {
			modelCallResults["destination.model.get"] = () => ({ ...mockDestination, isActive: false });
			modelCallResults["destination.model.update"] = (params) => ({
				...mockDestination,
				isActive: params.isActive,
			});

			const result = await broker.call("destination.toggleActive", { id: "dest-1" });

			expect(result.isActive).toBe(true);
		});

		it("should throw DESTINATION_NOT_FOUND for invalid id", async () => {
			modelCallResults["destination.model.get"] = () => {
				throw new Error("not found");
			};

			await expect(
				broker.call("destination.toggleActive", { id: "invalid-id" })
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.DESTINATION_NOT_FOUND,
			});
		});
	});
});
