"use strict";

const { ServiceBroker } = require("moleculer");
const { MoleculerClientError } = require("moleculer").Errors;
const TourPackageService = require("../../../services/tourPackage.service");
const { ERROR_CODES, WAITLIST_STATUSES } = require("../../../utils/constants");

// ---- Test data ----

const mockPackageWithWaitlist = {
	_id: "pkg-wl-1",
	title: "Accra Night Tour",
	isActive: true,
	status: "published",
	waitlistEnabled: true,
	maxWaitlistSize: 5,
	startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
	bookingCutoffHours: 24,
	destinationId: "dest-1",
	sellingMode: "group_buy",
};

const mockPackageNoWaitlist = {
	_id: "pkg-no-wl",
	title: "Elmina Day Tour",
	isActive: true,
	status: "published",
	waitlistEnabled: false,
	destinationId: "dest-1",
	sellingMode: "group_buy",
};

const mockPackageCutoffPassed = {
	_id: "pkg-cutoff",
	title: "Last Minute Tour",
	isActive: true,
	status: "published",
	waitlistEnabled: false,
	destinationId: "dest-1",
	sellingMode: "group_buy",
	// startDate 12 hours from now, but cutoff is 24 hours
	startDate: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
	bookingCutoffHours: 24,
};

const mockPackageCutoffOk = {
	_id: "pkg-cutoff-ok",
	title: "Plenty of Time Tour",
	isActive: true,
	status: "published",
	waitlistEnabled: false,
	destinationId: "dest-1",
	sellingMode: "group_buy",
	// startDate 48 hours from now, cutoff is 24 hours => still open
	startDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
	bookingCutoffHours: 24,
};

const mockPricingTier = {
	_id: "tier-wl-1",
	packageId: "pkg-cutoff-ok",
	minGroupSize: 1,
	maxGroupSize: 10,
	pricePerPerson: 300,
	isActive: true,
};

const mockWaitlistEntries = [
	{
		_id: "wl-entry-1",
		tourPackageId: "pkg-wl-1",
		customerId: "customer-1",
		groupSize: 2,
		status: "waiting",
		position: 1,
		createdAt: "2026-03-30T10:00:00.000Z",
	},
	{
		_id: "wl-entry-2",
		tourPackageId: "pkg-wl-1",
		customerId: "customer-2",
		groupSize: 4,
		status: "waiting",
		position: 2,
		createdAt: "2026-03-30T11:00:00.000Z",
	},
	{
		_id: "wl-entry-3",
		tourPackageId: "pkg-wl-1",
		customerId: "customer-3",
		groupSize: 3,
		status: "waiting",
		position: 3,
		createdAt: "2026-03-30T12:00:00.000Z",
	},
];

// ---- Model mock results store ----
let modelCallResults = {};

function resolveResult(key, params) {
	if (typeof modelCallResults[key] === "function") {
		return modelCallResults[key](params);
	}
	return modelCallResults[key] || null;
}

function customerMeta(id = "customer-1") {
	return { user: { id, role: "customer" } };
}

function staffMeta(id = "staff-1") {
	return { user: { id, role: "staff" } };
}

// ---- Broker factory ----

function createWaitlistBroker() {
	const broker = new ServiceBroker({ logger: false, validator: true });

	broker.createService({
		name: "tourPackage.model",
		actions: {
			get: { handler(ctx) { return resolveResult("tourPackage.model.get", ctx.params); } },
			find: { handler(ctx) { return resolveResult("tourPackage.model.find", ctx.params); } },
			create: { handler(ctx) { return resolveResult("tourPackage.model.create", ctx.params); } },
			update: { handler(ctx) { return resolveResult("tourPackage.model.update", ctx.params); } },
			incrementField: { handler(ctx) { return resolveResult("tourPackage.model.incrementField", ctx.params); } },
		},
	});

	broker.createService({
		name: "packagePricing.model",
		actions: {
			get: { handler(ctx) { return resolveResult("packagePricing.model.get", ctx.params); } },
			find: { handler(ctx) { return resolveResult("packagePricing.model.find", ctx.params); } },
			create: { handler(ctx) { return resolveResult("packagePricing.model.create", ctx.params); } },
			update: { handler(ctx) { return resolveResult("packagePricing.model.update", ctx.params); } },
			remove: { handler(ctx) { return resolveResult("packagePricing.model.remove", ctx.params); } },
		},
	});

	broker.createService({
		name: "destination.model",
		actions: {
			get: { handler(ctx) { return resolveResult("destination.model.get", ctx.params); } },
			find: { handler(ctx) { return resolveResult("destination.model.find", ctx.params); } },
		},
	});

	broker.createService({
		name: "hotelPartner.model",
		actions: {
			get: { handler(ctx) { return resolveResult("hotelPartner.model.get", ctx.params); } },
			find: { handler(ctx) { return resolveResult("hotelPartner.model.find", ctx.params); } },
		},
	});

	broker.createService({
		name: "attraction.model",
		actions: {
			get: { handler(ctx) { return resolveResult("attraction.model.get", ctx.params); } },
			find: { handler(ctx) { return resolveResult("attraction.model.find", ctx.params); } },
		},
	});

	broker.createService({
		name: "review.model",
		actions: {
			find: { handler(ctx) { return resolveResult("review.model.find", ctx.params); } },
		},
	});

	broker.createService({
		name: "waitlistEntry.model",
		actions: {
			find: { handler(ctx) { return resolveResult("waitlistEntry.model.find", ctx.params); } },
			count: { handler(ctx) { return resolveResult("waitlistEntry.model.count", ctx.params); } },
			create: { handler(ctx) { return resolveResult("waitlistEntry.model.create", ctx.params); } },
			update: { handler(ctx) { return resolveResult("waitlistEntry.model.update", ctx.params); } },
		},
	});

	broker.createService(TourPackageService);

	return broker;
}

// ---- Tests ----

describe("Waitlist and overbooking prevention", () => {
	let broker;

	beforeAll(async () => {
		broker = createWaitlistBroker();
		await broker.start();
	});

	afterAll(() => broker.stop());

	beforeEach(() => {
		modelCallResults = {};
	});

	// ========== joinWaitlist ==========

	describe("tourPackage.joinWaitlist", () => {
		it("should create a waitlist entry with the correct position", async () => {
			modelCallResults["tourPackage.model.get"] = () => ({
				...mockPackageWithWaitlist,
			});
			modelCallResults["waitlistEntry.model.count"] = () => 2; // 2 already waiting
			modelCallResults["waitlistEntry.model.create"] = (params) => ({
				_id: "wl-new-1",
				...params,
			});

			const result = await broker.call(
				"tourPackage.joinWaitlist",
				{ packageId: "pkg-wl-1", groupSize: 3 },
				{ meta: customerMeta("customer-5") }
			);

			expect(result._id).toBe("wl-new-1");
			expect(result.position).toBe(3); // 2 + 1
			expect(result.status).toBe("waiting");
			expect(result.tourPackageId).toBe("pkg-wl-1");
			expect(result.message).toContain("#3");
		});

		it("should throw WAITLIST_FULL when at capacity", async () => {
			modelCallResults["tourPackage.model.get"] = () => ({
				...mockPackageWithWaitlist,
				maxWaitlistSize: 5,
			});
			modelCallResults["waitlistEntry.model.count"] = () => 5; // at max

			await expect(
				broker.call(
					"tourPackage.joinWaitlist",
					{ packageId: "pkg-wl-1", groupSize: 2 },
					{ meta: customerMeta("customer-10") }
				)
			).rejects.toMatchObject({
				code: 422,
				type: ERROR_CODES.WAITLIST_FULL,
			});
		});

		it("should throw when waitlist is not enabled", async () => {
			modelCallResults["tourPackage.model.get"] = () => ({
				...mockPackageNoWaitlist,
			});

			await expect(
				broker.call(
					"tourPackage.joinWaitlist",
					{ packageId: "pkg-no-wl", groupSize: 2 },
					{ meta: customerMeta("customer-5") }
				)
			).rejects.toMatchObject({
				code: 422,
			});
		});

		it("should throw PACKAGE_NOT_FOUND for invalid package", async () => {
			modelCallResults["tourPackage.model.get"] = () => null;

			await expect(
				broker.call(
					"tourPackage.joinWaitlist",
					{ packageId: "nonexistent-pkg", groupSize: 2 },
					{ meta: customerMeta("customer-5") }
				)
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.PACKAGE_NOT_FOUND,
			});
		});
	});

	// ========== getWaitlist ==========

	describe("tourPackage.getWaitlist", () => {
		it("should return waitlist entries sorted by position", async () => {
			modelCallResults["waitlistEntry.model.find"] = (params) => {
				// Verify correct query shape
				expect(params.sort).toBe("position");
				return [...mockWaitlistEntries];
			};

			const results = await broker.call(
				"tourPackage.getWaitlist",
				{ packageId: "pkg-wl-1" },
				{ meta: staffMeta() }
			);

			expect(Array.isArray(results)).toBe(true);
			expect(results).toHaveLength(3);
			expect(results[0].position).toBe(1);
			expect(results[1].position).toBe(2);
			expect(results[2].position).toBe(3);
		});
	});

	// ========== processWaitlist ==========

	describe("tourPackage.processWaitlist", () => {
		it("should offer to next person in line", async () => {
			let updatedId = null;
			let updatedData = null;

			modelCallResults["waitlistEntry.model.find"] = () => [
				{ ...mockWaitlistEntries[0] },
			];
			modelCallResults["waitlistEntry.model.update"] = (params) => {
				updatedId = params.id;
				updatedData = params;
				return { ...mockWaitlistEntries[0], ...params };
			};

			const result = await broker.call("tourPackage.processWaitlist", {
				packageId: "pkg-wl-1",
			});

			expect(result.offered).toBe(true);
			expect(result.customerId).toBe("customer-1");
			expect(result.position).toBe(1);

			// Verify the model was updated to "offered"
			expect(updatedId).toBe("wl-entry-1");
			expect(updatedData.status).toBe("offered");
			expect(updatedData.offeredAt).toBeDefined();
			expect(updatedData.expiresAt).toBeDefined();
		});

		it("should return no-one when waitlist is empty", async () => {
			modelCallResults["waitlistEntry.model.find"] = () => [];

			const result = await broker.call("tourPackage.processWaitlist", {
				packageId: "pkg-wl-1",
			});

			expect(result.offered).toBe(false);
			expect(result.message).toContain("No one");
		});
	});

	// ========== validatePackage — booking cutoff ==========

	describe("tourPackage.validatePackage — booking cutoff", () => {
		it("should reject when booking cutoff has passed", async () => {
			modelCallResults["tourPackage.model.get"] = () => ({
				...mockPackageCutoffPassed,
			});

			await expect(
				broker.call("tourPackage.validatePackage", {
					packageId: "pkg-cutoff",
					groupSize: 2,
				})
			).rejects.toMatchObject({
				code: 422,
				type: ERROR_CODES.BOOKING_CUTOFF_PASSED,
			});
		});

		it("should pass when booking cutoff has NOT passed", async () => {
			modelCallResults["tourPackage.model.get"] = () => ({
				...mockPackageCutoffOk,
			});
			modelCallResults["packagePricing.model.find"] = () => [
				{ ...mockPricingTier },
			];

			const result = await broker.call("tourPackage.validatePackage", {
				packageId: "pkg-cutoff-ok",
				groupSize: 2,
			});

			expect(result.valid).toBe(true);
			expect(result.package).toBeDefined();
			expect(result.pricingTier).toBeDefined();
			expect(result.pricePerPerson).toBe(300);
		});
	});
});
