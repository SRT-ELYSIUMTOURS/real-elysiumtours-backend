"use strict";

const { ServiceBroker } = require("moleculer");
const BookingService = require("../../../services/booking.service");
const { BOOKING_STATUSES } = require("../../../utils/constants");

// ---- Test data ----

const sampleBookings = [
	{
		_id: "b1",
		customerId: "c1",
		packageId: { _id: "pkg-1", title: "Cape Coast Adventure" },
		bookingType: "packaged",
		bookingRef: "ELY-20260301-AA01",
		groupSize: 4,
		totalAmount: 2000,
		currency: "GHS",
		status: BOOKING_STATUSES.CONFIRMED,
		createdAt: "2026-03-10T10:00:00.000Z",
	},
	{
		_id: "b2",
		customerId: "c2",
		packageId: { _id: "pkg-1", title: "Cape Coast Adventure" },
		bookingType: "packaged",
		bookingRef: "ELY-20260301-AA02",
		groupSize: 2,
		totalAmount: 1000,
		currency: "GHS",
		status: BOOKING_STATUSES.CONFIRMED,
		createdAt: "2026-03-15T10:00:00.000Z",
	},
	{
		_id: "b3",
		customerId: "c3",
		packageId: { _id: "pkg-2", title: "Kumasi Cultural Tour" },
		bookingType: "packaged",
		bookingRef: "ELY-20260301-AA03",
		groupSize: 6,
		totalAmount: 3000,
		currency: "GHS",
		status: BOOKING_STATUSES.PENDING_PAYMENT,
		createdAt: "2026-03-20T10:00:00.000Z",
	},
	{
		_id: "b4",
		customerId: "c1",
		bookingType: "dynamic",
		bookingRef: "ELY-20260301-AA04",
		groupSize: 3,
		totalAmount: 4500,
		currency: "GHS",
		status: BOOKING_STATUSES.CANCELLED,
		createdAt: "2026-04-01T10:00:00.000Z",
	},
	{
		_id: "b5",
		customerId: "c4",
		packageId: { _id: "pkg-1", title: "Cape Coast Adventure" },
		bookingType: "packaged",
		bookingRef: "ELY-20260301-AA05",
		groupSize: 5,
		totalAmount: 2500,
		currency: "GHS",
		status: BOOKING_STATUSES.TOUR_COMPLETED,
		createdAt: "2026-04-05T10:00:00.000Z",
	},
];

let modelCallResults = {};

function adminMeta(id = "admin-1") {
	return { user: { id, role: "admin" } };
}

function createBroker() {
	const broker = new ServiceBroker({
		logger: false,
		validator: true,
	});

	// Mock booking.model service
	broker.createService({
		name: "booking.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["booking.model.find"] === "function"
						? modelCallResults["booking.model.find"](ctx.params)
						: modelCallResults["booking.model.find"] || [];
				},
			},
			get: {
				handler(ctx) {
					if (typeof modelCallResults["booking.model.get"] === "function") {
						return modelCallResults["booking.model.get"](ctx.params);
					}
					return modelCallResults["booking.model.get"] || null;
				},
			},
			create: {
				handler(ctx) {
					return typeof modelCallResults["booking.model.create"] === "function"
						? modelCallResults["booking.model.create"](ctx.params)
						: modelCallResults["booking.model.create"] || {};
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["booking.model.update"] === "function"
						? modelCallResults["booking.model.update"](ctx.params)
						: modelCallResults["booking.model.update"] || {};
				},
			},
			count: {
				handler(ctx) {
					return typeof modelCallResults["booking.model.count"] === "function"
						? modelCallResults["booking.model.count"](ctx.params)
						: modelCallResults["booking.model.count"] || 0;
				},
			},
		},
	});

	// Mock tourPackage.model service
	broker.createService({
		name: "tourPackage.model",
		actions: {
			get: { handler() { return null; } },
			update: { handler() { return {}; } },
		},
	});

	// Mock tourPackage service
	broker.createService({
		name: "tourPackage",
		actions: {
			validatePackage: { handler() { return null; } },
			decrementCapacity: { handler() { return {}; } },
		},
	});

	// Mock packagePricing.model service
	broker.createService({
		name: "packagePricing.model",
		actions: {
			find: { handler() { return []; } },
		},
	});

	// Mock hotelPartner.model service
	broker.createService({
		name: "hotelPartner.model",
		actions: {
			get: { handler() { return null; } },
			find: { handler() { return []; } },
		},
	});

	// Mock hotelPartner service
	broker.createService({
		name: "hotelPartner",
		actions: {
			checkAvailability: { handler() { return { available: true, needsConfirmation: true, inventoryModel: "on_request" }; } },
			getByDestination: { handler() { return []; } },
		},
	});

	// Mock quote.model service
	broker.createService({
		name: "quote.model",
		actions: {
			get: { handler() { return null; } },
		},
	});

	// Mock tourRequest.model service
	broker.createService({
		name: "tourRequest.model",
		actions: {
			get: { handler() { return null; } },
		},
	});

	broker.createService(BookingService);

	return broker;
}

// ---- Tests ----

describe("Booking Analytics", () => {
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

	// ========== getBookingAnalytics ==========

	describe("getBookingAnalytics", () => {
		it("should return correct totals and breakdowns", async () => {
			modelCallResults["booking.model.find"] = () => [...sampleBookings];

			const result = await broker.call(
				"booking.getBookingAnalytics",
				{},
				{ meta: adminMeta() }
			);

			expect(result.totalBookings).toBe(5);
			expect(result.byStatus[BOOKING_STATUSES.CONFIRMED]).toBe(2);
			expect(result.byStatus[BOOKING_STATUSES.PENDING_PAYMENT]).toBe(1);
			expect(result.byStatus[BOOKING_STATUSES.CANCELLED]).toBe(1);
			expect(result.byStatus[BOOKING_STATUSES.TOUR_COMPLETED]).toBe(1);
			expect(result.byType.packaged).toBe(4);
			expect(result.byType.dynamic).toBe(1);
			// Revenue: confirmed (2000 + 1000) + tour_completed (2500) = 5500
			// pending_payment and cancelled are excluded
			expect(result.totalRevenue).toBe(5500);
			expect(result.popularDestinations).toBeDefined();
			expect(result.popularDestinations.length).toBeGreaterThan(0);
			expect(result.bookingTrend).toBeDefined();
			expect(Array.isArray(result.bookingTrend)).toBe(true);
		});

		it("should filter by date range", async () => {
			modelCallResults["booking.model.find"] = (params) => {
				// Simulate date filtering
				return sampleBookings.filter((b) => {
					const created = b.createdAt;
					if (params.query.createdAt) {
						if (params.query.createdAt.$gte && created < params.query.createdAt.$gte) return false;
						if (params.query.createdAt.$lte && created > params.query.createdAt.$lte) return false;
					}
					return true;
				});
			};

			const result = await broker.call(
				"booking.getBookingAnalytics",
				{
					startDate: "2026-03-01T00:00:00.000Z",
					endDate: "2026-03-31T23:59:59.999Z",
				},
				{ meta: adminMeta() }
			);

			// Only 3 bookings in March (b1, b2, b3)
			expect(result.totalBookings).toBe(3);
			expect(result.byStatus[BOOKING_STATUSES.CONFIRMED]).toBe(2);
			expect(result.byStatus[BOOKING_STATUSES.PENDING_PAYMENT]).toBe(1);
		});

		it("should calculate average group size correctly", async () => {
			modelCallResults["booking.model.find"] = () => [...sampleBookings];

			const result = await broker.call(
				"booking.getBookingAnalytics",
				{},
				{ meta: adminMeta() }
			);

			// (4 + 2 + 6 + 3 + 5) / 5 = 20 / 5 = 4
			expect(result.averageGroupSize).toBe(4);
		});
	});

	// ========== getPopularPackages ==========

	describe("getPopularPackages", () => {
		it("should return top packages by booking count", async () => {
			modelCallResults["booking.model.find"] = () => [...sampleBookings];

			const result = await broker.call(
				"booking.getPopularPackages",
				{ limit: 5 },
				{ meta: adminMeta() }
			);

			expect(Array.isArray(result)).toBe(true);
			// pkg-1 has 3 bookings (b1, b2, b5), pkg-2 has 1 (b3), b4 has no packageId
			expect(result.length).toBe(2);
			expect(result[0].packageId).toBe("pkg-1");
			expect(result[0].bookingCount).toBe(3);
			expect(result[0].title).toBe("Cape Coast Adventure");
			// Revenue for pkg-1: 2000 + 1000 + 2500 = 5500
			expect(result[0].totalRevenue).toBe(5500);
			// Average group size for pkg-1: (4 + 2 + 5) / 3 = 3.67
			expect(result[0].averageGroupSize).toBe(3.67);
			expect(result[1].packageId).toBe("pkg-2");
			expect(result[1].bookingCount).toBe(1);
		});
	});
});
