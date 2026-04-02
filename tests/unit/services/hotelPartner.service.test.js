"use strict";

const { ServiceBroker } = require("moleculer");
const HotelPartnerService = require("../../../services/hotelPartner.service");
const { ERROR_CODES } = require("../../../utils/constants");

// ---- Test data ----

const mockDestination = {
	_id: "dest-1",
	name: "Bali Paradise",
	slug: "bali-paradise",
	region: "Asia",
	isActive: true,
};

const mockHotel = {
	_id: "hotel-1",
	name: "Grand Bali Resort",
	destinationId: "dest-1",
	tier: "luxury",
	commissionRate: 15,
	isActive: true,
	closeOutDates: [],
};

const mockHotel2 = {
	_id: "hotel-2",
	name: "Budget Bali Inn",
	destinationId: "dest-1",
	tier: "budget",
	commissionRate: 10,
	isActive: true,
	closeOutDates: [],
};

// Model call results
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
			get: {
				handler(ctx) {
					if (typeof modelCallResults["destination.model.get"] === "function") {
						return modelCallResults["destination.model.get"](ctx.params);
					}
					return modelCallResults["destination.model.get"] || null;
				},
			},
			find: {
				handler(ctx) {
					return typeof modelCallResults["destination.model.find"] === "function"
						? modelCallResults["destination.model.find"](ctx.params)
						: modelCallResults["destination.model.find"] || [];
				},
			},
		},
	});

	// Mock hotelPartner.model service
	broker.createService({
		name: "hotelPartner.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["hotelPartner.model.find"] === "function"
						? modelCallResults["hotelPartner.model.find"](ctx.params)
						: modelCallResults["hotelPartner.model.find"] || [];
				},
			},
			get: {
				handler(ctx) {
					if (typeof modelCallResults["hotelPartner.model.get"] === "function") {
						return modelCallResults["hotelPartner.model.get"](ctx.params);
					}
					return modelCallResults["hotelPartner.model.get"] || null;
				},
			},
			create: {
				handler(ctx) {
					return typeof modelCallResults["hotelPartner.model.create"] === "function"
						? modelCallResults["hotelPartner.model.create"](ctx.params)
						: modelCallResults["hotelPartner.model.create"] || {};
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["hotelPartner.model.update"] === "function"
						? modelCallResults["hotelPartner.model.update"](ctx.params)
						: modelCallResults["hotelPartner.model.update"] || {};
				},
			},
		},
	});

	// Load real hotelPartner service
	broker.createService(HotelPartnerService);

	return broker;
}

// ---- Tests ----

describe("HotelPartner Service", () => {
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
		it("should return an array of hotels", async () => {
			modelCallResults["hotelPartner.model.find"] = () => [mockHotel, mockHotel2];

			const result = await broker.call("hotelPartner.list", {});

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBe(2);
			expect(result[0].name).toBe("Grand Bali Resort");
		});
	});

	// ========== get ==========

	describe("get", () => {
		it("should return a hotel on happy path", async () => {
			modelCallResults["hotelPartner.model.get"] = () => mockHotel;

			const result = await broker.call("hotelPartner.get", { id: "hotel-1" });

			expect(result).toBeDefined();
			expect(result._id).toBe("hotel-1");
			expect(result.name).toBe("Grand Bali Resort");
		});

		it("should throw PARTNER_NOT_FOUND for invalid id", async () => {
			modelCallResults["hotelPartner.model.get"] = () => {
				throw new Error("not found");
			};

			await expect(
				broker.call("hotelPartner.get", { id: "invalid-id" })
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.PARTNER_NOT_FOUND,
			});
		});
	});

	// ========== getByDestination ==========

	describe("getByDestination", () => {
		it("should return hotels for a destination", async () => {
			modelCallResults["hotelPartner.model.find"] = (params) => {
				if (params.query && params.query.destinationId === "dest-1") {
					return [mockHotel, mockHotel2];
				}
				return [];
			};

			const result = await broker.call("hotelPartner.getByDestination", {
				destinationId: "dest-1",
			});

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBe(2);
			expect(result[0].destinationId).toBe("dest-1");
		});
	});

	// ========== create ==========

	describe("create", () => {
		it("should create a hotel when destination exists", async () => {
			modelCallResults["destination.model.get"] = () => mockDestination;
			modelCallResults["hotelPartner.model.create"] = (params) => ({
				_id: "new-hotel",
				...params,
			});

			const result = await broker.call("hotelPartner.create", {
				name: "Seaside Hotel",
				destinationId: "dest-1",
				tier: "premium",
				commissionRate: 12,
			});

			expect(result._id).toBe("new-hotel");
			expect(result.name).toBe("Seaside Hotel");
			expect(result.destinationId).toBe("dest-1");
			expect(result.tier).toBe("premium");
		});

		it("should throw DESTINATION_NOT_FOUND if destination does not exist", async () => {
			modelCallResults["destination.model.get"] = () => {
				throw new Error("not found");
			};

			await expect(
				broker.call("hotelPartner.create", {
					name: "Ghost Hotel",
					destinationId: "nonexistent-dest",
					tier: "budget",
				})
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.DESTINATION_NOT_FOUND,
			});
		});
	});

	// ========== setCommission ==========

	describe("setCommission", () => {
		it("should update the commission rate", async () => {
			modelCallResults["hotelPartner.model.get"] = () => mockHotel;
			modelCallResults["hotelPartner.model.update"] = (params) => ({
				...mockHotel,
				commissionRate: params.commissionRate,
			});

			const result = await broker.call("hotelPartner.setCommission", {
				id: "hotel-1",
				commissionRate: 20,
			});

			expect(result.commissionRate).toBe(20);
		});

		it("should throw PARTNER_NOT_FOUND for invalid id", async () => {
			modelCallResults["hotelPartner.model.get"] = () => {
				throw new Error("not found");
			};

			await expect(
				broker.call("hotelPartner.setCommission", {
					id: "invalid-id",
					commissionRate: 20,
				})
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.PARTNER_NOT_FOUND,
			});
		});
	});

	// ========== toggleActive ==========

	describe("toggleActive", () => {
		it("should toggle isActive from true to false", async () => {
			modelCallResults["hotelPartner.model.get"] = () => ({ ...mockHotel, isActive: true });
			modelCallResults["hotelPartner.model.update"] = (params) => ({
				...mockHotel,
				isActive: params.isActive,
			});

			const result = await broker.call("hotelPartner.toggleActive", { id: "hotel-1" });

			expect(result.isActive).toBe(false);
		});

		it("should toggle isActive from false to true", async () => {
			modelCallResults["hotelPartner.model.get"] = () => ({ ...mockHotel, isActive: false });
			modelCallResults["hotelPartner.model.update"] = (params) => ({
				...mockHotel,
				isActive: params.isActive,
			});

			const result = await broker.call("hotelPartner.toggleActive", { id: "hotel-1" });

			expect(result.isActive).toBe(true);
		});

		it("should throw PARTNER_NOT_FOUND for invalid id", async () => {
			modelCallResults["hotelPartner.model.get"] = () => {
				throw new Error("not found");
			};

			await expect(
				broker.call("hotelPartner.toggleActive", { id: "invalid-id" })
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.PARTNER_NOT_FOUND,
			});
		});
	});
});
