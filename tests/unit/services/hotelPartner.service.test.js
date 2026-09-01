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

		it("should require tier (the admin form previously never sent it)", async () => {
			modelCallResults["destination.model.get"] = () => mockDestination;

			await expect(
				broker.call("hotelPartner.create", {
					name: "No Tier Hotel",
					destinationId: "dest-1",
				})
			).rejects.toMatchObject({ code: 422 });
		});

		// Every field the admin form collects must actually reach the model. This
		// is the regression guard for "form accepted it but it never persisted".
		it("should forward the full admin payload to the model", async () => {
			modelCallResults["destination.model.get"] = () => mockDestination;
			let received = null;
			modelCallResults["hotelPartner.model.create"] = (params) => {
				received = params;
				return { _id: "new-hotel", ...params };
			};

			await broker.call("hotelPartner.create", {
				name: "Full Payload Hotel",
				destinationId: "dest-1",
				tier: "premium",
				commissionRate: 12,
				contactInfo: { phone: "0200000000", email: "a@b.com", address: "Accra", contactPerson: "Ama" },
				inventoryModel: "free_sale",
				contractStatus: "active",
				availabilityStatus: "available",
				amenities: ["pool", "wifi"],
				images: ["https://img/1.jpg"],
				coverImage: "https://img/cover.jpg",
				starRating: 4,
				shortDescription: "Nice place",
				priceRange: "premium",
				packages: [{ id: "p1", title: "Weekend", price: "500", features: ["breakfast"] }],
				rateData: { standardRate: 400 },
				closeOutDates: [{ reason: "Renovation" }],
			});

			expect(received).toMatchObject({
				name: "Full Payload Hotel",
				tier: "premium",
				coverImage: "https://img/cover.jpg",
				starRating: 4,
				shortDescription: "Nice place",
				priceRange: "premium",
			});
			expect(received.packages).toHaveLength(1);
			expect(received.amenities).toEqual(["pool", "wifi"]);
			expect(received.contactInfo.contactPerson).toBe("Ama");
		});

		it("should derive GeoJSON location from gpsCoords", async () => {
			modelCallResults["destination.model.get"] = () => mockDestination;
			let received = null;
			modelCallResults["hotelPartner.model.create"] = (params) => {
				received = params;
				return { _id: "geo-hotel", ...params };
			};

			await broker.call("hotelPartner.create", {
				name: "Geo Hotel",
				destinationId: "dest-1",
				tier: "standard",
				gpsCoords: { lat: 5.6037, lng: -0.187 },
			});

			// GeoJSON coordinate order is [lng, lat].
			expect(received.location).toEqual({ type: "Point", coordinates: [-0.187, 5.6037] });
			// The raw gpsCoords must not leak onto the record.
			expect(received.gpsCoords).toBeUndefined();
		});

		// ── SECURITY: mass assignment ────────────────────────────────────────────
		// Without $$strict:"remove" the handler's `...rest` spread forwarded any
		// client field straight to Mongoose, letting an admin forge review scores
		// or move a record into another tenant's organization.
		it("should strip server-controlled and unknown fields on create", async () => {
			modelCallResults["destination.model.get"] = () => mockDestination;
			let received = null;
			modelCallResults["hotelPartner.model.create"] = (params) => {
				received = params;
				return { _id: "new-hotel", ...params };
			};

			await broker.call("hotelPartner.create", {
				name: "Sneaky Hotel",
				destinationId: "dest-1",
				tier: "budget",
				rating: 5,
				reviewCount: 9999,
				organizationId: "some-other-org",
				location: { type: "Point", coordinates: [0, 0] },
				bogusField: "nope",
			});

			expect(received.rating).toBeUndefined();
			expect(received.reviewCount).toBeUndefined();
			expect(received.bogusField).toBeUndefined();
			// organizationId is stamped by tenantScope.middleware, never by the client.
			expect(received.organizationId).not.toBe("some-other-org");
			// Raw location is refused; only gpsCoords-derived values are accepted.
			expect(received.location).toBeUndefined();
		});
	});

	// ========== update: field contract ==========

	describe("update field contract", () => {
		it("should strip server-controlled and unknown fields on update", async () => {
			modelCallResults["hotelPartner.model.get"] = () => mockHotel;
			let received = null;
			modelCallResults["hotelPartner.model.update"] = (params) => {
				received = params;
				return { ...mockHotel, ...params };
			};

			await broker.call("hotelPartner.update", {
				id: "hotel-1",
				name: "Renamed Hotel",
				rating: 5,
				reviewCount: 4242,
				organizationId: "some-other-org",
				bogusField: "nope",
			});

			expect(received.name).toBe("Renamed Hotel");
			expect(received.rating).toBeUndefined();
			expect(received.reviewCount).toBeUndefined();
			expect(received.bogusField).toBeUndefined();
			// .model.update is NOT tenant-scoped, so accepting organizationId here
			// would allow cross-tenant reassignment.
			expect(received.organizationId).toBeUndefined();
		});

		it("should persist the previously-droppable display fields on update", async () => {
			modelCallResults["hotelPartner.model.get"] = () => mockHotel;
			let received = null;
			modelCallResults["hotelPartner.model.update"] = (params) => {
				received = params;
				return { ...mockHotel, ...params };
			};

			await broker.call("hotelPartner.update", {
				id: "hotel-1",
				coverImage: "https://img/new.jpg",
				starRating: 5,
				shortDescription: "Updated",
				priceRange: "luxury",
			});

			expect(received).toMatchObject({
				coverImage: "https://img/new.jpg",
				starRating: 5,
				shortDescription: "Updated",
				priceRange: "luxury",
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
