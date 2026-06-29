"use strict";

const { ServiceBroker } = require("moleculer");
const DynamicTourService = require("../../services/dynamicTour.service");
const PricingDeskService = require("../../services/pricingDesk.service");
const BookingService = require("../../services/booking.service");
const PaymentService = require("../../services/payment.service");

// ---- In-memory stores ----

let stores;
let idCounter;

function resetStores() {
	stores = {
		"tourPackage.model": new Map(),
		"packagePricing.model": new Map(),
		"booking.model": new Map(),
		"payment.model": new Map(),
		"destination.model": new Map(),
		"hotelPartner.model": new Map(),
		"attraction.model": new Map(),
		"diningPartner.model": new Map(),
		"vehicle.model": new Map(),
		"quote.model": new Map(),
		"tourRequest.model": new Map(),
		"user.model": new Map(),
		"interest.model": new Map(),
		"paymentPlan.model": new Map(),
	};
	idCounter = 1;
}

/**
 * Create a generic mock model service backed by an in-memory Map.
 */
function createMockModel(name) {
	return {
		name,
		actions: {
			create: {
				handler(ctx) {
					const store = stores[name];
					const id = `${name.replace(".model", "")}_${idCounter++}`;
					const doc = { _id: id, ...ctx.params, createdAt: new Date().toISOString() };
					store.set(id, doc);
					return { ...doc };
				},
			},
			find: {
				handler(ctx) {
					const store = stores[name];
					const { query } = ctx.params || {};
					const results = [];
					for (const doc of store.values()) {
						let match = true;
						if (query) {
							for (const [key, val] of Object.entries(query)) {
								if (typeof val === "object" && val !== null && !Array.isArray(val)) {
									continue;
								}
								if (doc[key] !== val) {
									match = false;
									break;
								}
							}
						}
						if (match) results.push({ ...doc });
					}
					return results;
				},
			},
			get: {
				handler(ctx) {
					const store = stores[name];
					const id = ctx.params.id;
					const doc = store.get(id);
					return doc ? { ...doc } : null;
				},
			},
			update: {
				handler(ctx) {
					const store = stores[name];
					const { id, ...updates } = ctx.params;
					const doc = store.get(id);
					if (!doc) return null;
					Object.assign(doc, updates);
					store.set(id, doc);
					return { ...doc };
				},
			},
			remove: {
				handler(ctx) {
					const store = stores[name];
					const doc = store.get(ctx.params.id);
					store.delete(ctx.params.id);
					return doc ? { ...doc } : null;
				},
			},
			count: {
				handler(ctx) {
					const store = stores[name];
					const { query } = ctx.params || {};
					if (!query || Object.keys(query).length === 0) return store.size;
					let count = 0;
					for (const doc of store.values()) {
						let match = true;
						if (query) {
							for (const [key, val] of Object.entries(query)) {
								if (typeof val === "object" && val !== null && !Array.isArray(val)) continue;
								if (doc[key] !== val) {
									match = false;
									break;
								}
							}
						}
						if (match) count++;
					}
					return count;
				},
			},
		},
	};
}

// ---- Tests ----

describe("Dynamic Booking Flow — Integration (Diagram 4)", () => {
	let broker;
	let paymentService;

	// State carried across ordered tests
	let destinationId;
	let tourRequestId;
	let quoteId;
	let bookingId;
	let transactionRef;

	const CUSTOMER_META = { user: { id: "customer1", email: "customer@test.com", role: "customer" } };
	const STAFF_META = { user: { id: "staff1", email: "staff@test.com", role: "staff" } };

	beforeAll(async () => {
		process.env.JWT_SECRET = "test-secret";
		process.env.JWT_EXPIRY = "1h";
		process.env.REFRESH_TOKEN_EXPIRY = "7d";
		process.env.DEFAULT_COMMITMENT_FEE_PERCENT = "15";
		process.env.SLA_HOURS = "72";

		resetStores();

		broker = new ServiceBroker({
			logger: false,
			validator: true,
		});

		// Load all mock model services
		const modelNames = [
			"tourPackage.model",
			"packagePricing.model",
			"booking.model",
			"payment.model",
			"destination.model",
			"hotelPartner.model",
			"attraction.model",
			"diningPartner.model",
			"vehicle.model",
			"quote.model",
			"tourRequest.model",
			"user.model",
			"interest.model",
			"paymentPlan.model",
			"tourGuide.model",
		];

		for (const name of modelNames) {
			broker.createService(createMockModel(name));
		}

		// Load real services
		broker.createService(DynamicTourService);
		broker.createService(PricingDeskService);
		broker.createService(BookingService);

		// Load payment service and capture reference for mocking
		paymentService = broker.createService(PaymentService);

		await broker.start();

		// Mock Paystack methods on the payment service after start
		paymentService.initializeTransaction = jest.fn().mockResolvedValue({
			authorization_url: "https://checkout.paystack.com/test456",
			access_code: "test_access_code_dyn",
			reference: "ref456",
		});
		paymentService.verifyTransaction = jest.fn().mockResolvedValue({
			status: "success",
			amount: 30000,
			currency: "GHS",
			reference: "ref456",
		});

		// Seed prerequisite data: destination
		const dest = await broker.call("destination.model.create", {
			name: "Cape Coast",
			country: "Ghana",
			isActive: true,
		});
		destinationId = dest._id;

		// Seed hotel, attraction, dining for the destination
		await broker.call("hotelPartner.model.create", {
			name: "Beach Resort",
			destinationId,
			isActive: true,
		});
		await broker.call("attraction.model.create", {
			name: "Cape Coast Castle",
			destinationId,
			isActive: true,
		});
		await broker.call("diningPartner.model.create", {
			name: "Ocean View Restaurant",
			destinationId,
			isActive: true,
		});

		// Seed a user record for the customer
		stores["user.model"].set("customer1", {
			_id: "customer1",
			email: "customer@test.com",
			firstName: "Test",
			lastName: "Customer",
		});
	});

	afterAll(async () => {
		await broker.stop();
	});

	// ========== Step 1: Build a tour request (customer) ==========

	it("1. Build a tour request", async () => {
		const result = await broker.call(
			"dynamicTour.buildTourRequest",
			{
				destinations: [
					{
						destinationId,
						nightsStay: 3,
						hotelPreference: "premium",
						selectedAttractions: [],
						diningPreferences: [],
					},
				],
				groupSize: 6,
				transportPreference: "bus",
				preferredStartDate: "2026-07-15",
				durationDays: 4,
				specialRequests: "Need wheelchair accessible rooms",
			},
			{ meta: CUSTOMER_META }
		);

		expect(result._id).toBeDefined();
		expect(result.referenceNumber).toBeDefined();
		expect(result.referenceNumber).toMatch(/^DYN-\d{8}-[A-F0-9]{4}$/);
		expect(result.status).toBe("draft");
		expect(result.groupSize).toBe(6);
		expect(result.customerId).toBe("customer1");
		expect(result.destinations).toHaveLength(1);

		tourRequestId = result._id;
	});

	// ========== Step 2: Submit for pricing ==========

	it("2. Submit for pricing — creates a quote with SLA deadline", async () => {
		const result = await broker.call(
			"dynamicTour.submitForPricing",
			{ tourRequestId },
			{ meta: CUSTOMER_META }
		);

		expect(result.tourRequest).toBeDefined();
		expect(result.tourRequest.status).toBe("in_pricing_queue");
		expect(result.quote).toBeDefined();
		expect(result.quote._id).toBeDefined();
		expect(result.quote.status).toBe("pending");
		expect(result.quote.slaDeadline).toBeDefined();
		expect(result.quote.tourRequestId).toBe(tourRequestId);
		expect(result.message).toBeDefined();

		quoteId = result.quote._id;
	});

	// ========== Step 3: Staff assigns quote ==========

	it("3. Staff assigns quote — quote transitions to calculating", async () => {
		const result = await broker.call(
			"pricingDesk.assignQuote",
			{ quoteId },
			{ meta: STAFF_META }
		);

		expect(result._id).toBe(quoteId);
		expect(result.status).toBe("calculating");
		expect(result.assignedStaffId).toBe("staff1");

		// Verify tour request also transitioned
		const tourRequest = await broker.call(
			"tourRequest.model.get",
			{ id: tourRequestId }
		);
		expect(tourRequest.status).toBe("assigned_to_staff");
	});

	// ========== Step 4: Staff submits quote with cost breakdown ==========

	it("4. Staff submits quote — quote transitions to sent", async () => {
		const result = await broker.call(
			"pricingDesk.submitQuote",
			{
				quoteId,
				costBreakdown: {
					accommodation: 1200,
					transport: 400,
					attractions: 200,
					dining: 200,
				},
				totalPrice: 2000,
				pricePerPerson: 333.33,
				marginPercent: 20,
			},
			{ meta: STAFF_META }
		);

		expect(result._id).toBe(quoteId);
		expect(result.status).toBe("sent");
		expect(result.totalPrice).toBe(2000);
		expect(result.pricePerPerson).toBe(333.33);
		expect(result.costBreakdown).toBeDefined();
		expect(result.sentAt).toBeDefined();
		expect(result.validUntil).toBeDefined();

		// Verify tour request status
		const tourRequest = await broker.call(
			"tourRequest.model.get",
			{ id: tourRequestId }
		);
		expect(tourRequest.status).toBe("quote_sent");
	});

	// ========== Step 5: Customer accepts quote ==========

	it("5. Customer accepts quote — quote transitions to accepted", async () => {
		const result = await broker.call(
			"pricingDesk.customerAccept",
			{ quoteId },
			{ meta: CUSTOMER_META }
		);

		expect(result.quote).toBeDefined();
		expect(result.quote._id).toBe(quoteId);
		expect(result.quote.status).toBe("accepted");
		expect(result.quote.respondedAt).toBeDefined();
		expect(result.message).toBeDefined();

		// Verify tour request status
		const tourRequest = await broker.call(
			"tourRequest.model.get",
			{ id: tourRequestId }
		);
		expect(tourRequest.status).toBe("quote_accepted");
	});

	// ========== Step 6: Create booking from accepted quote ==========

	it("6. Create booking from accepted quote (dynamic)", async () => {
		const result = await broker.call(
			"booking.createBooking",
			{
				quoteId,
				groupSize: 6,
			},
			{ meta: CUSTOMER_META }
		);

		expect(result._id).toBeDefined();
		expect(result.bookingRef).toBeDefined();
		expect(result.status).toBe("pending_payment");
		expect(result.bookingType).toBe("dynamic");
		expect(result.totalAmount).toBe(2000);
		expect(result.commitmentFeeAmount).toBe(300); // 15% of 2000
		expect(result.groupSize).toBe(6);
		expect(result.quoteId).toBe(quoteId);
		expect(result.customerId).toBe("customer1");

		bookingId = result._id;
	});

	// ========== Step 7: Initiate and verify payment ==========

	it("7a. Initiate payment (commitment fee)", async () => {
		const result = await broker.call(
			"payment.initiatePayment",
			{
				bookingId,
				paymentType: "commitment_fee",
			},
			{ meta: CUSTOMER_META }
		);

		expect(result.paymentId).toBeDefined();
		expect(result.authorizationUrl).toBe("https://checkout.paystack.com/test456");
		expect(result.transactionRef).toBeDefined();

		transactionRef = result.transactionRef;

		expect(paymentService.initializeTransaction).toHaveBeenCalledTimes(1);
	});

	it("7b. Verify payment — booking transitions to confirmed", async () => {
		const result = await broker.call(
			"payment.verifyPayment",
			{ reference: transactionRef },
			{ meta: CUSTOMER_META }
		);

		expect(result.payment).toBeDefined();
		expect(result.payment.status).toBe("success");
		expect(result.booking).toBeDefined();
		expect(result.booking.status).toBe("confirmed");
		expect(result.booking.commitmentFeePaid).toBe(true);
		expect(result.booking.confirmedAt).toBeDefined();

		expect(paymentService.verifyTransaction).toHaveBeenCalledTimes(1);
	});
});
