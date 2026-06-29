"use strict";

const { ServiceBroker } = require("moleculer");
const TourPackageService = require("../../services/tourPackage.service");
const BookingService = require("../../services/booking.service");
const PaymentService = require("../../services/payment.service");
const InterestService = require("../../services/interest.service");

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
		"quote.model": new Map(),
		"tourRequest.model": new Map(),
		"user.model": new Map(),
		"interest.model": new Map(),
		"paymentPlan.model": new Map(),
		"review.model": new Map(),
		"waitlistEntry.model": new Map(),
	};
	idCounter = 1;
}

/**
 * Create a generic mock model service backed by an in-memory Map.
 * Supports: create, find, get, update, remove, count.
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
									// Skip complex queries like $in, $lt — return all
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

describe("Packaged Booking Flow — Integration (Diagram 3)", () => {
	let broker;
	let paymentService;

	// State carried across ordered tests
	let destinationId;
	let hotelPartnerId;
	let attractionId;
	let packageId;
	let pricingTierId;
	let bookingId;
	let bookingRef;
	let transactionRef;

	const ADMIN_META = { user: { id: "admin1", email: "admin@test.com", role: "admin" } };
	const CUSTOMER_META = { user: { id: "customer1", email: "customer@test.com", role: "customer" } };

	beforeAll(async () => {
		process.env.JWT_SECRET = "test-secret";
		process.env.JWT_EXPIRY = "1h";
		process.env.REFRESH_TOKEN_EXPIRY = "7d";
		process.env.DEFAULT_COMMITMENT_FEE_PERCENT = "15";

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
			"quote.model",
			"tourRequest.model",
			"user.model",
			"interest.model",
			"paymentPlan.model",
			"review.model",
			"waitlistEntry.model",
			"tourGuide.model",
		];

		for (const name of modelNames) {
			broker.createService(createMockModel(name));
		}

		// Mock review service
		broker.createService({
			name: "review",
			actions: {
				getStats: { handler() { return { weightedAverageRating: 0, simpleAverageRating: 0, totalReviews: 0, ratingBreakdown: {} }; } },
			},
		});

		// Mock hotelPartner service (non-model, for checkAvailability)
		broker.createService({
			name: "hotelPartner",
			actions: {
				checkAvailability: { handler() { return { available: true, needsConfirmation: false, inventoryModel: "free_sale", hotel: { name: "Test Hotel" } }; } },
				getByDestination: { handler() { return []; } },
			},
		});

		// Load real services
		broker.createService(TourPackageService);
		broker.createService(BookingService);

		// Load payment service and capture reference for mocking
		paymentService = broker.createService(PaymentService);

		await broker.start();

		// Mock Paystack methods on the payment service after start
		paymentService.initializeTransaction = jest.fn().mockResolvedValue({
			authorization_url: "https://checkout.paystack.com/test123",
			access_code: "test_access_code",
			reference: "ref123",
		});
		paymentService.verifyTransaction = jest.fn().mockResolvedValue({
			status: "success",
			amount: 15000,
			currency: "GHS",
			reference: "ref123",
		});

		// Seed prerequisite data: destination, hotel, attraction
		const dest = await broker.call("destination.model.create", {
			name: "Accra",
			country: "Ghana",
			isActive: true,
		});
		destinationId = dest._id;

		const hotel = await broker.call("hotelPartner.model.create", {
			name: "Test Hotel",
			destinationId,
			isActive: true,
		});
		hotelPartnerId = hotel._id;

		const attr = await broker.call("attraction.model.create", {
			name: "Cape Coast Castle",
			destinationId,
			isActive: true,
		});
		attractionId = attr._id;

		// Seed a user record for the customer (payment service reads user email)
		await broker.call("user.model.create", {
			_id: "customer1",
			email: "customer@test.com",
			firstName: "Test",
			lastName: "Customer",
		});
		// Override the stored id so model.get can find it
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

	// ========== Step 1: Create a tour package (admin) ==========

	it("1. Create a tour package", async () => {
		const result = await broker.call(
			"tourPackage.create",
			{
				title: "Weekend Getaway Accra",
				description: "A 3-day trip to Accra",
				destinationId,
				hotelPartnerId,
				attractionIds: [attractionId],
				durationDays: 3,
				sellingMode: "group_buy",
				startDate: "2026-06-01",
				endDate: "2026-06-03",
			},
			{ meta: ADMIN_META }
		);

		expect(result._id).toBeDefined();
		expect(result.title).toBe("Weekend Getaway Accra");
		expect(result.status).toBe("draft");
		expect(result.isActive).toBe(true);
		expect(result.destinationId).toBe(destinationId);

		packageId = result._id;
	});

	// ========== Step 2: Add a pricing tier ==========

	it("2. Add a pricing tier", async () => {
		const result = await broker.call(
			"tourPackage.addPricingTier",
			{
				packageId,
				minGroupSize: 1,
				maxGroupSize: 10,
				pricePerPerson: 150,
				label: "Small group",
			},
			{ meta: ADMIN_META }
		);

		expect(result._id).toBeDefined();
		expect(result.packageId).toBe(packageId);
		expect(result.minGroupSize).toBe(1);
		expect(result.maxGroupSize).toBe(10);
		expect(result.pricePerPerson).toBe(150);
		expect(result.isActive).toBe(true);

		pricingTierId = result._id;
	});

	// ========== Step 3: Publish the package ==========

	it("3. Publish the package", async () => {
		const result = await broker.call(
			"tourPackage.publish",
			{ id: packageId },
			{ meta: ADMIN_META }
		);

		expect(result.status).toBe("published");
		expect(result._id).toBe(packageId);
	});

	// ========== Step 4: Validate the package for a group size ==========

	it("4. Validate the package for a group size of 4", async () => {
		const result = await broker.call(
			"tourPackage.validatePackage",
			{ packageId, groupSize: 4 },
			{ meta: CUSTOMER_META }
		);

		expect(result.valid).toBe(true);
		expect(result.pricingTier).toBeDefined();
		expect(result.pricingTier._id).toBe(pricingTierId);
		expect(result.pricePerPerson).toBe(150);
		expect(result.totalPrice).toBe(600); // 150 * 4
	});

	// ========== Step 5: Create a booking (customer) ==========

	it("5. Create a booking", async () => {
		const result = await broker.call(
			"booking.createBooking",
			{
				packageId,
				groupSize: 4,
				specialRequests: "Vegetarian meals please",
			},
			{ meta: CUSTOMER_META }
		);

		expect(result._id).toBeDefined();
		expect(result.bookingRef).toBeDefined();
		expect(result.status).toBe("pending_payment");
		expect(result.bookingType).toBe("packaged");
		expect(result.totalAmount).toBe(600);
		expect(result.commitmentFeeAmount).toBe(90); // 15% of 600
		expect(result.groupSize).toBe(4);
		expect(result.customerId).toBe("customer1");
		expect(result.packageId).toBe(packageId);
		expect(result.specialRequests).toBe("Vegetarian meals please");

		bookingId = result._id;
		bookingRef = result.bookingRef;
	});

	// ========== Step 6: Initiate payment (commitment fee) ==========

	it("6. Initiate payment (commitment fee)", async () => {
		const result = await broker.call(
			"payment.initiatePayment",
			{
				bookingId,
				paymentType: "commitment_fee",
			},
			{ meta: CUSTOMER_META }
		);

		expect(result.paymentId).toBeDefined();
		expect(result.authorizationUrl).toBe("https://checkout.paystack.com/test123");
		expect(result.accessCode).toBe("test_access_code");
		expect(result.transactionRef).toBeDefined();

		transactionRef = result.transactionRef;

		// Verify Paystack initializeTransaction was called
		expect(paymentService.initializeTransaction).toHaveBeenCalledTimes(1);
		const callArgs = paymentService.initializeTransaction.mock.calls[0][0];
		expect(callArgs.email).toBe("customer@test.com");
		expect(callArgs.amount).toBe(90); // commitment fee amount
	});

	// ========== Step 7: Verify payment (success) ==========

	it("7. Verify payment — booking transitions to confirmed", async () => {
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

		// Verify Paystack verifyTransaction was called
		expect(paymentService.verifyTransaction).toHaveBeenCalledTimes(1);
	});

	// ========== Step 8: Cancel confirmed booking ==========

	it("8. Cancel booking (confirmed -> cancelled_with_refund)", async () => {
		const result = await broker.call(
			"booking.cancelBooking",
			{
				id: bookingId,
				reason: "Change of plans",
			},
			{ meta: CUSTOMER_META }
		);

		expect(result._id).toBe(bookingId);
		expect(result.status).toBe("cancelled_with_refund");
		expect(result.cancellationReason).toBe("Change of plans");
		expect(result.cancelledAt).toBeDefined();
	});
});
