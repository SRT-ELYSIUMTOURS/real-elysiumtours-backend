"use strict";

const { ServiceBroker } = require("moleculer");
const PricingDeskService = require("../../../services/pricingDesk.service");
const { ERROR_CODES, TOUR_REQUEST_STATUSES, QUOTE_STATUSES } = require("../../../utils/constants");

// ---- Test data ----

const mockCustomerId = "customer-1";
const mockStaffId = "staff-1";
const mockOtherStaffId = "staff-2";

const mockTourRequest = {
	_id: "tr-1",
	customerId: mockCustomerId,
	destinations: [{ destinationId: "dest-1", order: 1, nightsStay: 2 }],
	groupSize: 4,
	durationDays: 5,
	status: TOUR_REQUEST_STATUSES.IN_QUEUE,
	referenceNumber: "DYN-20260401-AB12",
};

const mockPendingQuote = {
	_id: "quote-1",
	tourRequestId: "tr-1",
	totalPrice: 0,
	pricePerPerson: 0,
	status: QUOTE_STATUSES.PENDING,
	slaDeadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
	revisionNumber: 1,
	createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
};

const mockCalculatingQuote = {
	_id: "quote-1",
	tourRequestId: "tr-1",
	assignedStaffId: mockStaffId,
	totalPrice: 0,
	pricePerPerson: 0,
	status: QUOTE_STATUSES.CALCULATING,
	slaDeadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
	revisionNumber: 1,
	createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
};

const mockSentQuote = {
	_id: "quote-1",
	tourRequestId: "tr-1",
	assignedStaffId: mockStaffId,
	totalPrice: 5000,
	pricePerPerson: 1250,
	status: QUOTE_STATUSES.SENT,
	slaDeadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
	sentAt: new Date().toISOString(),
	validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
	revisionNumber: 1,
	createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
};

const mockExpiredQuote = {
	...mockSentQuote,
	validUntil: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
};

const mockRejectedQuote = {
	_id: "quote-1",
	tourRequestId: "tr-1",
	assignedStaffId: mockStaffId,
	totalPrice: 5000,
	pricePerPerson: 1250,
	status: QUOTE_STATUSES.REJECTED,
	slaDeadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
	revisionNumber: 1,
	createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
};

const mockCostBreakdown = {
	transport: { description: "SUV 5 days", amount: 1500 },
	accommodation: { description: "Premium hotel 4 nights", amount: 2000 },
	attractions: { description: "3 attractions", amount: 600 },
	dining: { description: "Meal plan", amount: 400 },
	platformFee: { description: "Service fee", amount: 250 },
	subtotal: 4750,
	margin: 250,
	marginPercent: 5,
};

// Model call results -- keyed by action name
let modelCallResults = {};

function createBroker() {
	const broker = new ServiceBroker({
		logger: false,
		validator: true,
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
		},
	});

	// Mock vehicle.model service
	broker.createService({
		name: "vehicle.model",
		actions: {
			find: {
				handler() {
					return modelCallResults["vehicle.model.find"] || [];
				},
			},
		},
	});

	// Mock attraction.model service
	broker.createService({
		name: "attraction.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["attraction.model.find"] === "function"
						? modelCallResults["attraction.model.find"](ctx.params)
						: modelCallResults["attraction.model.find"] || [];
				},
			},
		},
	});

	// Mock diningPartner.model service
	broker.createService({
		name: "diningPartner.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["diningPartner.model.find"] === "function"
						? modelCallResults["diningPartner.model.find"](ctx.params)
						: modelCallResults["diningPartner.model.find"] || [];
				},
			},
		},
	});

	// Mock tourRequest.model service
	broker.createService({
		name: "tourRequest.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["tourRequest.model.find"] === "function"
						? modelCallResults["tourRequest.model.find"](ctx.params)
						: modelCallResults["tourRequest.model.find"] || [];
				},
			},
			get: {
				handler(ctx) {
					if (typeof modelCallResults["tourRequest.model.get"] === "function") {
						return modelCallResults["tourRequest.model.get"](ctx.params);
					}
					return modelCallResults["tourRequest.model.get"] || null;
				},
			},
			create: {
				handler(ctx) {
					return typeof modelCallResults["tourRequest.model.create"] === "function"
						? modelCallResults["tourRequest.model.create"](ctx.params)
						: modelCallResults["tourRequest.model.create"] || {};
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["tourRequest.model.update"] === "function"
						? modelCallResults["tourRequest.model.update"](ctx.params)
						: modelCallResults["tourRequest.model.update"] || {};
				},
			},
		},
	});

	// Mock quote.model service
	broker.createService({
		name: "quote.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["quote.model.find"] === "function"
						? modelCallResults["quote.model.find"](ctx.params)
						: modelCallResults["quote.model.find"] || [];
				},
			},
			get: {
				handler(ctx) {
					if (typeof modelCallResults["quote.model.get"] === "function") {
						return modelCallResults["quote.model.get"](ctx.params);
					}
					return modelCallResults["quote.model.get"] || null;
				},
			},
			create: {
				handler(ctx) {
					return typeof modelCallResults["quote.model.create"] === "function"
						? modelCallResults["quote.model.create"](ctx.params)
						: modelCallResults["quote.model.create"] || {};
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["quote.model.update"] === "function"
						? modelCallResults["quote.model.update"](ctx.params)
						: modelCallResults["quote.model.update"] || {};
				},
			},
			count: {
				handler(ctx) {
					if (typeof modelCallResults["quote.model.count"] === "function") {
						return modelCallResults["quote.model.count"](ctx.params);
					}
					return modelCallResults["quote.model.count"] || 0;
				},
			},
		},
	});

	// Load the real pricingDesk service
	broker.createService(PricingDeskService);

	return broker;
}

// ---- Tests ----

describe("PricingDesk Service", () => {
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

	// ========== getQueue ==========

	describe("getQueue", () => {
		it("should return pending quotes ordered by SLA deadline", async () => {
			const earlyDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
			const lateDeadline = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

			modelCallResults["quote.model.count"] = () => 2;
			modelCallResults["quote.model.find"] = () => [
				{ ...mockPendingQuote, _id: "quote-a", slaDeadline: earlyDeadline, tourRequestId: "tr-1" },
				{ ...mockPendingQuote, _id: "quote-b", slaDeadline: lateDeadline, tourRequestId: "tr-1" },
			];

			modelCallResults["tourRequest.model.get"] = () => ({ ...mockTourRequest });

			const result = await broker.call(
				"pricingDesk.getQueue",
				{},
				{ meta: { user: { id: mockStaffId, role: "staff" } } }
			);

			expect(result.quotes).toBeDefined();
			expect(result.quotes.length).toBe(2);
			expect(result.total).toBe(2);
			expect(result.page).toBe(1);
			expect(result.pageSize).toBe(20);
			expect(result.quotes[0].tourRequest).toBeDefined();
		});
	});

	// ========== assignQuote ==========

	describe("assignQuote", () => {
		it("should assign quote to staff and transition to calculating", async () => {
			modelCallResults["quote.model.get"] = () => ({ ...mockPendingQuote });

			modelCallResults["quote.model.update"] = (params) => ({
				...mockPendingQuote,
				...params,
			});

			modelCallResults["tourRequest.model.update"] = (params) => ({
				...mockTourRequest,
				...params,
			});

			const result = await broker.call(
				"pricingDesk.assignQuote",
				{ quoteId: "quote-1" },
				{ meta: { user: { id: mockStaffId, role: "staff" } } }
			);

			expect(result.status).toBe(QUOTE_STATUSES.CALCULATING);
			expect(result.assignedStaffId).toBe(mockStaffId);
		});

		it("should throw QUOTE_NOT_FOUND for invalid id", async () => {
			modelCallResults["quote.model.get"] = () => {
				throw new Error("not found");
			};

			await expect(
				broker.call(
					"pricingDesk.assignQuote",
					{ quoteId: "nonexistent" },
					{ meta: { user: { id: mockStaffId, role: "staff" } } }
				)
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.QUOTE_NOT_FOUND,
			});
		});

		it("should throw error if quote is not in pending status", async () => {
			modelCallResults["quote.model.get"] = () => ({
				...mockPendingQuote,
				status: QUOTE_STATUSES.SENT,
			});

			await expect(
				broker.call(
					"pricingDesk.assignQuote",
					{ quoteId: "quote-1" },
					{ meta: { user: { id: mockStaffId, role: "staff" } } }
				)
			).rejects.toMatchObject({
				code: 422,
				type: ERROR_CODES.INVALID_BOOKING_TRANSITION,
			});
		});
	});

	// ========== submitQuote ==========

	describe("submitQuote", () => {
		it("should update quote with cost breakdown and transition to sent", async () => {
			modelCallResults["quote.model.get"] = () => ({ ...mockCalculatingQuote });

			modelCallResults["quote.model.update"] = (params) => ({
				...mockCalculatingQuote,
				...params,
			});

			modelCallResults["tourRequest.model.update"] = (params) => ({
				...mockTourRequest,
				...params,
			});

			const result = await broker.call(
				"pricingDesk.submitQuote",
				{
					quoteId: "quote-1",
					costBreakdown: mockCostBreakdown,
					totalPrice: 5000,
					pricePerPerson: 1250,
				},
				{ meta: { user: { id: mockStaffId, role: "staff" } } }
			);

			expect(result.status).toBe(QUOTE_STATUSES.SENT);
			expect(result.totalPrice).toBe(5000);
			expect(result.pricePerPerson).toBe(1250);
			expect(result.costBreakdown).toEqual(mockCostBreakdown);
			expect(result.sentAt).toBeDefined();
			expect(result.validUntil).toBeDefined();
		});

		it("should throw error if staff is not the assigned user", async () => {
			modelCallResults["quote.model.get"] = () => ({ ...mockCalculatingQuote });

			await expect(
				broker.call(
					"pricingDesk.submitQuote",
					{
						quoteId: "quote-1",
						costBreakdown: mockCostBreakdown,
						totalPrice: 5000,
						pricePerPerson: 1250,
					},
					{ meta: { user: { id: mockOtherStaffId, role: "staff" } } }
				)
			).rejects.toMatchObject({
				code: 403,
				type: ERROR_CODES.FORBIDDEN,
			});
		});
	});

	// ========== customerAccept ==========

	describe("customerAccept", () => {
		it("should accept quote and transition statuses", async () => {
			modelCallResults["quote.model.get"] = () => ({ ...mockSentQuote });

			modelCallResults["tourRequest.model.get"] = () => ({
				...mockTourRequest,
				status: TOUR_REQUEST_STATUSES.QUOTE_SENT,
			});

			modelCallResults["quote.model.update"] = (params) => ({
				...mockSentQuote,
				...params,
			});

			modelCallResults["tourRequest.model.update"] = (params) => ({
				...mockTourRequest,
				...params,
			});

			const result = await broker.call(
				"pricingDesk.customerAccept",
				{ quoteId: "quote-1" },
				{ meta: { user: { id: mockCustomerId } } }
			);

			expect(result.quote).toBeDefined();
			expect(result.quote.status).toBe(QUOTE_STATUSES.ACCEPTED);
			expect(result.quote.respondedAt).toBeDefined();
			expect(result.message).toContain("accepted");
		});

		it("should throw error if quote is expired", async () => {
			modelCallResults["quote.model.get"] = () => ({ ...mockExpiredQuote });

			modelCallResults["tourRequest.model.get"] = () => ({
				...mockTourRequest,
				status: TOUR_REQUEST_STATUSES.QUOTE_SENT,
			});

			await expect(
				broker.call(
					"pricingDesk.customerAccept",
					{ quoteId: "quote-1" },
					{ meta: { user: { id: mockCustomerId } } }
				)
			).rejects.toMatchObject({
				code: 422,
				type: ERROR_CODES.QUOTE_EXPIRED,
			});
		});

		it("should throw error if customer doesn't own the request", async () => {
			modelCallResults["quote.model.get"] = () => ({ ...mockSentQuote });

			modelCallResults["tourRequest.model.get"] = () => ({
				...mockTourRequest,
				customerId: "other-customer",
			});

			await expect(
				broker.call(
					"pricingDesk.customerAccept",
					{ quoteId: "quote-1" },
					{ meta: { user: { id: mockCustomerId } } }
				)
			).rejects.toMatchObject({
				code: 403,
				type: ERROR_CODES.FORBIDDEN,
			});
		});
	});

	// ========== customerReject ==========

	describe("customerReject", () => {
		it("should reject quote with reason", async () => {
			modelCallResults["quote.model.get"] = () => ({ ...mockSentQuote });

			modelCallResults["tourRequest.model.get"] = () => ({
				...mockTourRequest,
				status: TOUR_REQUEST_STATUSES.QUOTE_SENT,
			});

			modelCallResults["quote.model.update"] = (params) => ({
				...mockSentQuote,
				...params,
			});

			modelCallResults["tourRequest.model.update"] = (params) => ({
				...mockTourRequest,
				...params,
			});

			const result = await broker.call(
				"pricingDesk.customerReject",
				{ quoteId: "quote-1", reason: "Too expensive" },
				{ meta: { user: { id: mockCustomerId } } }
			);

			expect(result.quote).toBeDefined();
			expect(result.quote.status).toBe(QUOTE_STATUSES.REJECTED);
			expect(result.quote.customerResponse).toBe("Too expensive");
			expect(result.quote.respondedAt).toBeDefined();
			expect(result.message).toContain("rejected");
		});
	});

	// ========== getSLAMetrics ==========

	describe("getSLAMetrics", () => {
		it("should return compliance metrics", async () => {
			const now = new Date();
			const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
			const slaDeadline = new Date(now.getTime() + 72 * 60 * 60 * 1000);

			modelCallResults["quote.model.find"] = () => [
				{
					_id: "q1",
					status: QUOTE_STATUSES.SENT,
					sentAt: twoHoursAgo.toISOString(),
					createdAt: new Date(twoHoursAgo.getTime() - 1 * 60 * 60 * 1000).toISOString(),
					slaDeadline: slaDeadline.toISOString(),
				},
				{
					_id: "q2",
					status: QUOTE_STATUSES.PENDING,
					createdAt: now.toISOString(),
					slaDeadline: slaDeadline.toISOString(),
				},
				{
					_id: "q3",
					status: QUOTE_STATUSES.PENDING,
					createdAt: now.toISOString(),
					slaDeadline: new Date(now.getTime() - 1000).toISOString(), // breached
				},
			];

			const result = await broker.call(
				"pricingDesk.getSLAMetrics",
				{},
				{ meta: { user: { id: "admin-1", role: "admin" } } }
			);

			expect(result.totalQuotes).toBe(3);
			expect(result.withinSLA).toBe(2);
			expect(result.breachedSLA).toBe(1);
			expect(result.complianceRate).toBeCloseTo(66.67, 1);
			expect(typeof result.averageResponseTime).toBe("number");
		});
	});
});
