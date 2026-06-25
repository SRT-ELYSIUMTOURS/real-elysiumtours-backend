"use strict";

const { ServiceBroker } = require("moleculer");
const BookingService = require("../../../services/booking.service");
const PaymentService = require("../../../services/payment.service");
const { BOOKING_STATUSES, PAYMENT_STATUSES, SELLING_MODES } = require("../../../utils/constants");

// ---- Test data ----

const mockBookings = [
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
		packageId: { _id: "pkg-2", title: "Volta Region Tour" },
		bookingType: "dynamic",
		bookingRef: "ELY-20260301-AA03",
		groupSize: 6,
		totalAmount: 5000,
		currency: "GHS",
		status: BOOKING_STATUSES.PENDING_PAYMENT,
		createdAt: "2026-03-20T10:00:00.000Z",
	},
	{
		_id: "b4",
		customerId: "c4",
		packageId: { _id: "pkg-1", title: "Cape Coast Adventure" },
		bookingType: "interest",
		bookingRef: "ELY-20260301-AA04",
		groupSize: 3,
		totalAmount: 1500,
		currency: "GHS",
		status: BOOKING_STATUSES.CANCELLED,
		createdAt: "2026-02-20T10:00:00.000Z",
	},
	{
		_id: "b5",
		customerId: "c5",
		packageId: { _id: "pkg-2", title: "Volta Region Tour" },
		bookingType: "packaged",
		bookingRef: "ELY-20260301-AA05",
		groupSize: 5,
		totalAmount: 3000,
		currency: "GHS",
		status: BOOKING_STATUSES.TOUR_COMPLETED,
		createdAt: "2026-01-15T10:00:00.000Z",
	},
];

const mockPackages = [
	{
		_id: "pkg-1",
		title: "Cape Coast Adventure",
		sellingMode: SELLING_MODES.INDIVIDUAL_SEATS,
		totalCapacity: 20,
		isActive: true,
	},
	{
		_id: "pkg-2",
		title: "Volta Region Tour",
		sellingMode: SELLING_MODES.INDIVIDUAL_SEATS,
		totalCapacity: 15,
		isActive: true,
	},
];

const mockPayments = [
	{
		_id: "pay-1",
		bookingId: "b1",
		customerId: "c1",
		amount: 300,
		currency: "GHS",
		provider: "paystack",
		paymentType: "commitment_fee",
		transactionRef: "ELY-PAY-001",
		status: PAYMENT_STATUSES.SUCCESS,
		paidAt: "2026-03-10T12:00:00.000Z",
		createdAt: "2026-03-10T10:00:00.000Z",
	},
	{
		_id: "pay-2",
		bookingId: "b2",
		customerId: "c2",
		amount: 1000,
		currency: "GHS",
		provider: "paystack",
		paymentType: "full_payment",
		transactionRef: "ELY-PAY-002",
		status: PAYMENT_STATUSES.SUCCESS,
		paidAt: "2026-03-15T14:00:00.000Z",
		createdAt: "2026-03-15T10:00:00.000Z",
	},
	{
		_id: "pay-3",
		bookingId: "b3",
		customerId: "c3",
		amount: 500,
		currency: "GHS",
		provider: "paystack",
		paymentType: "milestone",
		transactionRef: "ELY-PAY-003",
		status: PAYMENT_STATUSES.FAILED,
		createdAt: "2026-03-20T10:00:00.000Z",
	},
	{
		_id: "pay-4",
		bookingId: "b1",
		customerId: "c1",
		amount: -300,
		currency: "GHS",
		provider: "paystack",
		paymentType: "refund",
		transactionRef: "ELY-REF-001",
		status: PAYMENT_STATUSES.SUCCESS,
		paidAt: "2026-03-12T12:00:00.000Z",
		createdAt: "2026-03-12T10:00:00.000Z",
	},
	{
		_id: "pay-5",
		bookingId: "b5",
		customerId: "c5",
		amount: 3000,
		currency: "GHS",
		provider: "paystack",
		paymentType: "full_payment",
		transactionRef: "ELY-PAY-005",
		status: PAYMENT_STATUSES.SUCCESS,
		paidAt: "2026-01-15T14:00:00.000Z",
		createdAt: "2026-01-15T10:00:00.000Z",
	},
	{
		_id: "pay-6",
		bookingId: "b4",
		customerId: "c4",
		amount: 200,
		currency: "GHS",
		provider: "paystack",
		paymentType: "commitment_fee",
		transactionRef: "ELY-PAY-006",
		status: PAYMENT_STATUSES.PENDING,
		createdAt: "2026-02-20T10:00:00.000Z",
	},
];

const mockPaymentPlans = [
	{
		_id: "plan-1",
		bookingId: "b1",
		totalAmount: 2000,
		paidAmount: 1000,
		status: "active",
		milestones: [
			{
				_id: "m1",
				amount: 500,
				dueDate: "2026-03-15T00:00:00.000Z",
				paidAt: "2026-03-14T10:00:00.000Z",
				status: "paid",
			},
			{
				_id: "m2",
				amount: 500,
				dueDate: "2026-04-15T00:00:00.000Z",
				paidAt: "2026-04-16T10:00:00.000Z",
				status: "paid",
			},
			{
				_id: "m3",
				amount: 500,
				dueDate: "2026-05-15T00:00:00.000Z",
				status: "pending",
			},
		],
	},
];

// ---- Model call results ----
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
			find: {
				handler(ctx) {
					return typeof modelCallResults["tourPackage.model.find"] === "function"
						? modelCallResults["tourPackage.model.find"](ctx.params)
						: modelCallResults["tourPackage.model.find"] || [];
				},
			},
			get: {
				handler(ctx) {
					if (typeof modelCallResults["tourPackage.model.get"] === "function") {
						return modelCallResults["tourPackage.model.get"](ctx.params);
					}
					return modelCallResults["tourPackage.model.get"] || null;
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["tourPackage.model.update"] === "function"
						? modelCallResults["tourPackage.model.update"](ctx.params)
						: modelCallResults["tourPackage.model.update"] || {};
				},
			},
		},
	});

	// Mock tourPackage service (for validatePackage and decrementCapacity)
	broker.createService({
		name: "tourPackage",
		actions: {
			validatePackage: {
				handler(ctx) {
					if (typeof modelCallResults["tourPackage.validatePackage"] === "function") {
						return modelCallResults["tourPackage.validatePackage"](ctx.params);
					}
					return modelCallResults["tourPackage.validatePackage"] || null;
				},
			},
			decrementCapacity: {
				handler(ctx) {
					if (typeof modelCallResults["tourPackage.decrementCapacity"] === "function") {
						return modelCallResults["tourPackage.decrementCapacity"](ctx.params);
					}
					return modelCallResults["tourPackage.decrementCapacity"] || {};
				},
			},
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
			get: {
				handler(ctx) {
					if (typeof modelCallResults["quote.model.get"] === "function") {
						return modelCallResults["quote.model.get"](ctx.params);
					}
					return modelCallResults["quote.model.get"] || null;
				},
			},
		},
	});

	// Mock tourRequest.model service
	broker.createService({
		name: "tourRequest.model",
		actions: {
			get: {
				handler(ctx) {
					if (typeof modelCallResults["tourRequest.model.get"] === "function") {
						return modelCallResults["tourRequest.model.get"](ctx.params);
					}
					return modelCallResults["tourRequest.model.get"] || null;
				},
			},
		},
	});

	// Mock payment.model service
	broker.createService({
		name: "payment.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["payment.model.find"] === "function"
						? modelCallResults["payment.model.find"](ctx.params)
						: modelCallResults["payment.model.find"] || [];
				},
			},
			get: {
				handler(ctx) {
					if (typeof modelCallResults["payment.model.get"] === "function") {
						return modelCallResults["payment.model.get"](ctx.params);
					}
					return modelCallResults["payment.model.get"] || null;
				},
			},
			create: {
				handler(ctx) {
					return typeof modelCallResults["payment.model.create"] === "function"
						? modelCallResults["payment.model.create"](ctx.params)
						: modelCallResults["payment.model.create"] || {};
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["payment.model.update"] === "function"
						? modelCallResults["payment.model.update"](ctx.params)
						: modelCallResults["payment.model.update"] || {};
				},
			},
		},
	});

	// Mock paymentPlan.model service
	broker.createService({
		name: "paymentPlan.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["paymentPlan.model.find"] === "function"
						? modelCallResults["paymentPlan.model.find"](ctx.params)
						: modelCallResults["paymentPlan.model.find"] || [];
				},
			},
		},
	});

	// Mock user.model service (needed by payment service)
	broker.createService({
		name: "user.model",
		actions: {
			get: {
				handler(ctx) {
					return { _id: "user-1", email: "test@test.com" };
				},
			},
		},
	});

	// Mock tourGuide.model service (booking.service + payment.service dependency)
	broker.createService({
		name: "tourGuide.model",
		actions: {
			get: { handler() { return null; } },
			find: { handler() { return []; } },
		},
	});

	// Load real services
	broker.createService(BookingService);
	broker.createService(PaymentService);

	return broker;
}

// ---- Tests ----

describe("Analytics Actions", () => {
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

	// ========== booking.getAnalytics ==========

	describe("booking.getAnalytics", () => {
		it("should return correct total counts and revenue", async () => {
			modelCallResults["booking.model.find"] = () => [...mockBookings];

			const result = await broker.call(
				"booking.getAnalytics",
				{},
				{ meta: adminMeta() }
			);

			expect(result.totalBookings).toBe(5);
			// Revenue: confirmed (2000 + 1000) + tour_completed (3000) = 6000
			// pending_payment and cancelled are excluded
			expect(result.totalRevenue).toBe(6000);
			expect(result.averageGroupSize).toBe(4); // (4+2+6+3+5)/5 = 4
			expect(result.averageBookingValue).toBe(1200); // 6000/5
		});

		it("should return correct bookingsByStatus breakdown", async () => {
			modelCallResults["booking.model.find"] = () => [...mockBookings];

			const result = await broker.call(
				"booking.getAnalytics",
				{},
				{ meta: adminMeta() }
			);

			expect(result.bookingsByStatus[BOOKING_STATUSES.CONFIRMED]).toBe(2);
			expect(result.bookingsByStatus[BOOKING_STATUSES.PENDING_PAYMENT]).toBe(1);
			expect(result.bookingsByStatus[BOOKING_STATUSES.CANCELLED]).toBe(1);
			expect(result.bookingsByStatus[BOOKING_STATUSES.TOUR_COMPLETED]).toBe(1);
		});

		it("should return correct bookingsByType breakdown", async () => {
			modelCallResults["booking.model.find"] = () => [...mockBookings];

			const result = await broker.call(
				"booking.getAnalytics",
				{},
				{ meta: adminMeta() }
			);

			expect(result.bookingsByType.packaged).toBe(3);
			expect(result.bookingsByType.dynamic).toBe(1);
			expect(result.bookingsByType.interest).toBe(1);
		});

		it("should return popular destinations sorted by booking count", async () => {
			modelCallResults["booking.model.find"] = () => [...mockBookings];

			const result = await broker.call(
				"booking.getAnalytics",
				{},
				{ meta: adminMeta() }
			);

			expect(result.popularDestinations.length).toBeGreaterThan(0);
			// pkg-1 has 3 bookings, pkg-2 has 2
			expect(result.popularDestinations[0].packageId).toBe("pkg-1");
			expect(result.popularDestinations[0].bookingCount).toBe(3);
			expect(result.popularDestinations[1].packageId).toBe("pkg-2");
			expect(result.popularDestinations[1].bookingCount).toBe(2);
		});

		it("should return monthlyTrend array", async () => {
			modelCallResults["booking.model.find"] = () => [...mockBookings];

			const result = await broker.call(
				"booking.getAnalytics",
				{},
				{ meta: adminMeta() }
			);

			expect(Array.isArray(result.monthlyTrend)).toBe(true);
			// Should have entries for months with bookings
			expect(result.monthlyTrend.length).toBeGreaterThan(0);
			for (const entry of result.monthlyTrend) {
				expect(entry).toHaveProperty("month");
				expect(entry).toHaveProperty("count");
				expect(entry).toHaveProperty("revenue");
			}
		});

		it("should filter by date range when startDate and endDate are provided", async () => {
			let capturedQuery;
			modelCallResults["booking.model.find"] = (params) => {
				capturedQuery = params.query;
				return mockBookings.filter((b) => {
					if (params.query.createdAt) {
						const created = new Date(b.createdAt);
						if (params.query.createdAt.$gte && created < new Date(params.query.createdAt.$gte)) return false;
						if (params.query.createdAt.$lte && created > new Date(params.query.createdAt.$lte)) return false;
					}
					return true;
				});
			};

			const result = await broker.call(
				"booking.getAnalytics",
				{ startDate: "2026-03-01", endDate: "2026-03-31" },
				{ meta: adminMeta() }
			);

			expect(capturedQuery.createdAt).toBeDefined();
			expect(capturedQuery.createdAt.$gte).toBeDefined();
			expect(capturedQuery.createdAt.$lte).toBeDefined();
			// Only bookings b1, b2, b3 are in March
			expect(result.totalBookings).toBe(3);
		});
	});

	// ========== booking.getOccupancyReport ==========

	describe("booking.getOccupancyReport", () => {
		it("should return fill rates for individual_seats packages", async () => {
			modelCallResults["tourPackage.model.find"] = () => [...mockPackages];
			modelCallResults["booking.model.find"] = () => [...mockBookings];

			const result = await broker.call(
				"booking.getOccupancyReport",
				{},
				{ meta: adminMeta() }
			);

			expect(result.packages).toBeDefined();
			expect(result.packages.length).toBe(2);

			// pkg-1: bookings b1(4) + b2(2) + b4(cancelled, excluded) = 6 booked out of 20
			const pkg1 = result.packages.find((p) => p.packageId === "pkg-1");
			expect(pkg1).toBeDefined();
			expect(pkg1.totalCapacity).toBe(20);
			expect(pkg1.bookedSeats).toBe(6); // b1(4)+b2(2), b4 is cancelled
			expect(pkg1.remainingCapacity).toBe(14);
			expect(pkg1.fillRate).toBe(30); // 6/20 * 100

			// pkg-2: bookings b3(pending_payment, not cancelled, counts)=6 + b5(5) = 11 out of 15
			const pkg2 = result.packages.find((p) => p.packageId === "pkg-2");
			expect(pkg2).toBeDefined();
			expect(pkg2.totalCapacity).toBe(15);
			expect(pkg2.bookedSeats).toBe(11);
			expect(pkg2.remainingCapacity).toBe(4);
		});

		it("should return averageFillRate across all packages", async () => {
			modelCallResults["tourPackage.model.find"] = () => [...mockPackages];
			modelCallResults["booking.model.find"] = () => [...mockBookings];

			const result = await broker.call(
				"booking.getOccupancyReport",
				{},
				{ meta: adminMeta() }
			);

			expect(result.averageFillRate).toBeDefined();
			expect(typeof result.averageFillRate).toBe("number");
			// pkg-1: 30%, pkg-2: 73.33% => average: ~51.67
			expect(result.averageFillRate).toBeGreaterThan(0);
		});
	});

	// ========== payment.getPaymentAnalytics ==========

	describe("payment.getPaymentAnalytics", () => {
		it("should return correct totals", async () => {
			modelCallResults["payment.model.find"] = () => [...mockPayments];
			modelCallResults["paymentPlan.model.find"] = () => [...mockPaymentPlans];

			const result = await broker.call(
				"payment.getPaymentAnalytics",
				{},
				{ meta: adminMeta() }
			);

			expect(result.totalTransactions).toBe(5); // 6 total minus 1 refund record
			// Successful non-refund: pay-1(300) + pay-2(1000) + pay-5(3000) = 4300
			expect(result.totalRevenue).toBe(4300);
			// Refund: pay-4 abs(-300) = 300
			expect(result.totalRefunds).toBe(300);
			expect(result.averageTransactionValue).toBe(
				Math.round((4300 / 3) * 100) / 100
			); // 3 successful non-refund payments
		});

		it("should calculate net revenue correctly", async () => {
			modelCallResults["payment.model.find"] = () => [...mockPayments];
			modelCallResults["paymentPlan.model.find"] = () => [...mockPaymentPlans];

			const result = await broker.call(
				"payment.getPaymentAnalytics",
				{},
				{ meta: adminMeta() }
			);

			// netRevenue = 4300 - 300 = 4000
			expect(result.netRevenue).toBe(4000);
		});

		it("should return paymentsByStatus breakdown", async () => {
			modelCallResults["payment.model.find"] = () => [...mockPayments];
			modelCallResults["paymentPlan.model.find"] = () => [...mockPaymentPlans];

			const result = await broker.call(
				"payment.getPaymentAnalytics",
				{},
				{ meta: adminMeta() }
			);

			// 4 success (pay-1, pay-2, pay-4 refund record, pay-5), 1 failed, 1 pending
			expect(result.paymentsByStatus[PAYMENT_STATUSES.SUCCESS]).toBe(4);
			expect(result.paymentsByStatus[PAYMENT_STATUSES.FAILED]).toBe(1);
			expect(result.paymentsByStatus[PAYMENT_STATUSES.PENDING]).toBe(1);
		});

		it("should return paymentsByType breakdown", async () => {
			modelCallResults["payment.model.find"] = () => [...mockPayments];
			modelCallResults["paymentPlan.model.find"] = () => [...mockPaymentPlans];

			const result = await broker.call(
				"payment.getPaymentAnalytics",
				{},
				{ meta: adminMeta() }
			);

			expect(result.paymentsByType.commitment_fee).toBe(2); // pay-1, pay-6
			expect(result.paymentsByType.full_payment).toBe(2); // pay-2, pay-5
			expect(result.paymentsByType.milestone).toBe(1); // pay-3
		});

		it("should return paymentPlanAdherence percentage", async () => {
			modelCallResults["payment.model.find"] = () => [...mockPayments];
			modelCallResults["paymentPlan.model.find"] = () => [...mockPaymentPlans];

			const result = await broker.call(
				"payment.getPaymentAnalytics",
				{},
				{ meta: adminMeta() }
			);

			expect(result.paymentPlanAdherence).toBeDefined();
			expect(typeof result.paymentPlanAdherence).toBe("number");
			// plan-1 has 2 paid milestones: m1 paid on time, m2 paid late
			// Adherence = 1/2 * 100 = 50%
			expect(result.paymentPlanAdherence).toBe(50);
		});
	});

	// ========== payment.getRevenueByPeriod ==========

	describe("payment.getRevenueByPeriod", () => {
		it("should group by monthly period", async () => {
			modelCallResults["payment.model.find"] = () =>
				mockPayments.filter((p) => p.status === PAYMENT_STATUSES.SUCCESS);

			const result = await broker.call(
				"payment.getRevenueByPeriod",
				{ period: "monthly" },
				{ meta: adminMeta() }
			);

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBeGreaterThan(0);

			for (const entry of result) {
				expect(entry).toHaveProperty("period");
				expect(entry).toHaveProperty("revenue");
				expect(entry).toHaveProperty("transactionCount");
			}

			// January: pay-5(3000), March: pay-1(300) + pay-2(1000) = 1300
			// Refund record pay-4 is excluded from revenue
			const janEntry = result.find((r) => r.period === "2026-01");
			expect(janEntry).toBeDefined();
			expect(janEntry.revenue).toBe(3000);
			expect(janEntry.transactionCount).toBe(1);

			const marEntry = result.find((r) => r.period === "2026-03");
			expect(marEntry).toBeDefined();
			expect(marEntry.revenue).toBe(1300);
			expect(marEntry.transactionCount).toBe(2);
		});

		it("should group by daily period", async () => {
			modelCallResults["payment.model.find"] = () =>
				mockPayments.filter((p) => p.status === PAYMENT_STATUSES.SUCCESS);

			const result = await broker.call(
				"payment.getRevenueByPeriod",
				{ period: "daily" },
				{ meta: adminMeta() }
			);

			expect(Array.isArray(result)).toBe(true);
			// Each successful non-refund payment should map to its paidAt date
			const jan15 = result.find((r) => r.period === "2026-01-15");
			expect(jan15).toBeDefined();
			expect(jan15.revenue).toBe(3000);
		});

		it("should filter by date range", async () => {
			let capturedQuery;
			modelCallResults["payment.model.find"] = (params) => {
				capturedQuery = params.query;
				return mockPayments.filter((p) => {
					if (p.status !== PAYMENT_STATUSES.SUCCESS) return false;
					if (params.query.createdAt) {
						const created = new Date(p.createdAt);
						if (params.query.createdAt.$gte && created < new Date(params.query.createdAt.$gte)) return false;
						if (params.query.createdAt.$lte && created > new Date(params.query.createdAt.$lte)) return false;
					}
					return true;
				});
			};

			const result = await broker.call(
				"payment.getRevenueByPeriod",
				{ period: "monthly", startDate: "2026-03-01", endDate: "2026-03-31" },
				{ meta: adminMeta() }
			);

			expect(capturedQuery.createdAt).toBeDefined();
			expect(Array.isArray(result)).toBe(true);
			// Only March payments: pay-1(300) + pay-2(1000) = 1300
			// pay-4 is a refund, excluded
			const marEntry = result.find((r) => r.period === "2026-03");
			if (marEntry) {
				expect(marEntry.revenue).toBe(1300);
			}
		});
	});
});
