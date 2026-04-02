"use strict";

const { ServiceBroker } = require("moleculer");
const TransportService = require("../../../services/transport.service");
const { ERROR_CODES } = require("../../../utils/constants");

// ---- Test data ----

const mockProvider = {
	_id: "provider-1",
	companyName: "Island Transfers",
	contactPerson: "John Smith",
	phone: "+1234567890",
	email: "john@transfers.com",
	commissionRate: 10,
	isActive: true,
};

const mockProvider2 = {
	_id: "provider-2",
	companyName: "Mountain Movers",
	contactPerson: "Jane Doe",
	phone: "+0987654321",
	email: "jane@movers.com",
	commissionRate: 12,
	isActive: true,
};

const mockVehicle = {
	_id: "vehicle-1",
	providerId: "provider-1",
	type: "minibus",
	capacity: 15,
	basePricePerDay: 200,
	isAvailable: true,
};

const mockVehicle2 = {
	_id: "vehicle-2",
	providerId: "provider-1",
	type: "sedan",
	capacity: 4,
	basePricePerDay: 80,
	isAvailable: true,
};

// Model call results
let modelCallResults = {};

function createBroker() {
	const broker = new ServiceBroker({
		logger: false,
		validator: true,
	});

	// Mock transportProvider.model service
	broker.createService({
		name: "transportProvider.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["transportProvider.model.find"] === "function"
						? modelCallResults["transportProvider.model.find"](ctx.params)
						: modelCallResults["transportProvider.model.find"] || [];
				},
			},
			get: {
				handler(ctx) {
					if (typeof modelCallResults["transportProvider.model.get"] === "function") {
						return modelCallResults["transportProvider.model.get"](ctx.params);
					}
					return modelCallResults["transportProvider.model.get"] || null;
				},
			},
			create: {
				handler(ctx) {
					return typeof modelCallResults["transportProvider.model.create"] === "function"
						? modelCallResults["transportProvider.model.create"](ctx.params)
						: modelCallResults["transportProvider.model.create"] || {};
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["transportProvider.model.update"] === "function"
						? modelCallResults["transportProvider.model.update"](ctx.params)
						: modelCallResults["transportProvider.model.update"] || {};
				},
			},
		},
	});

	// Mock vehicle.model service
	broker.createService({
		name: "vehicle.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["vehicle.model.find"] === "function"
						? modelCallResults["vehicle.model.find"](ctx.params)
						: modelCallResults["vehicle.model.find"] || [];
				},
			},
			get: {
				handler(ctx) {
					if (typeof modelCallResults["vehicle.model.get"] === "function") {
						return modelCallResults["vehicle.model.get"](ctx.params);
					}
					return modelCallResults["vehicle.model.get"] || null;
				},
			},
			create: {
				handler(ctx) {
					return typeof modelCallResults["vehicle.model.create"] === "function"
						? modelCallResults["vehicle.model.create"](ctx.params)
						: modelCallResults["vehicle.model.create"] || {};
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["vehicle.model.update"] === "function"
						? modelCallResults["vehicle.model.update"](ctx.params)
						: modelCallResults["vehicle.model.update"] || {};
				},
			},
		},
	});

	// Load real transport service
	broker.createService(TransportService);

	return broker;
}

// ---- Tests ----

describe("Transport Service", () => {
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

	// ========== listProviders ==========

	describe("listProviders", () => {
		it("should return an array of providers", async () => {
			modelCallResults["transportProvider.model.find"] = () => [mockProvider, mockProvider2];

			const result = await broker.call("transport.listProviders", {});

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBe(2);
			expect(result[0].companyName).toBe("Island Transfers");
		});
	});

	// ========== registerProvider ==========

	describe("registerProvider", () => {
		it("should create a transport provider", async () => {
			modelCallResults["transportProvider.model.create"] = (params) => ({
				_id: "new-provider",
				...params,
				isActive: true,
			});

			const result = await broker.call("transport.registerProvider", {
				companyName: "Desert Rides",
				contactPerson: "Ali Khan",
				phone: "+1112223333",
				email: "ali@desertrides.com",
				commissionRate: 8,
			});

			expect(result._id).toBe("new-provider");
			expect(result.companyName).toBe("Desert Rides");
			expect(result.contactPerson).toBe("Ali Khan");
		});

		it("should throw validation error when companyName is missing", async () => {
			await expect(
				broker.call("transport.registerProvider", {
					contactPerson: "No Company",
				})
			).rejects.toThrow();
		});
	});

	// ========== listVehicles ==========

	describe("listVehicles", () => {
		it("should return an array of vehicles", async () => {
			modelCallResults["vehicle.model.find"] = () => [mockVehicle, mockVehicle2];

			const result = await broker.call("transport.listVehicles", {});

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBe(2);
			expect(result[0].type).toBe("minibus");
		});
	});

	// ========== addVehicle ==========

	describe("addVehicle", () => {
		it("should create a vehicle when provider exists", async () => {
			modelCallResults["transportProvider.model.get"] = () => mockProvider;
			modelCallResults["vehicle.model.create"] = (params) => ({
				_id: "new-vehicle",
				...params,
				isAvailable: true,
			});

			const result = await broker.call("transport.addVehicle", {
				providerId: "provider-1",
				type: "suv",
				capacity: 6,
				basePricePerDay: 150,
			});

			expect(result._id).toBe("new-vehicle");
			expect(result.type).toBe("suv");
			expect(result.providerId).toBe("provider-1");
			expect(result.capacity).toBe(6);
		});

		it("should throw PARTNER_NOT_FOUND if provider does not exist", async () => {
			modelCallResults["transportProvider.model.get"] = () => {
				throw new Error("not found");
			};

			await expect(
				broker.call("transport.addVehicle", {
					providerId: "nonexistent-provider",
					type: "bus",
					capacity: 40,
					basePricePerDay: 500,
				})
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.PARTNER_NOT_FOUND,
			});
		});
	});

	// ========== estimateTransportCost ==========

	describe("estimateTransportCost", () => {
		it("should calculate cost based on group size and days", async () => {
			modelCallResults["vehicle.model.find"] = () => [mockVehicle]; // capacity 15, basePricePerDay 200

			const result = await broker.call("transport.estimateTransportCost", {
				groupSize: 10,
				days: 3,
			});

			expect(result.totalCost).toBe(600); // 200 * 3
			expect(result.days).toBe(3);
			expect(result.groupSize).toBe(10);
			expect(result.vehicle).toBeDefined();
			expect(result.vehicle.type).toBe("minibus");
			expect(result.vehicle.basePricePerDay).toBe(200);
		});

		it("should throw INVENTORY_UNAVAILABLE when no suitable vehicle is found", async () => {
			modelCallResults["vehicle.model.find"] = () => [];

			await expect(
				broker.call("transport.estimateTransportCost", {
					groupSize: 100,
					days: 2,
				})
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.INVENTORY_UNAVAILABLE,
			});
		});

		it("should pick the smallest vehicle that fits the group", async () => {
			// Return vehicles sorted by capacity (smallest first)
			modelCallResults["vehicle.model.find"] = () => [
				{ ...mockVehicle2, capacity: 6, basePricePerDay: 80 },
				{ ...mockVehicle, capacity: 15, basePricePerDay: 200 },
			];

			const result = await broker.call("transport.estimateTransportCost", {
				groupSize: 5,
				days: 2,
			});

			// Should pick the first vehicle (capacity 6, price 80)
			expect(result.totalCost).toBe(160); // 80 * 2
			expect(result.vehicle.capacity).toBe(6);
		});
	});
});
