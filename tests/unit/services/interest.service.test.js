"use strict";

const { ServiceBroker } = require("moleculer");
const InterestService = require("../../../services/interest.service");
const { ERROR_CODES, INTEREST_STATUSES } = require("../../../utils/constants");

// ---- Test data ----

const mockUser = { id: "user-1" };
const mockOtherUser = { id: "user-2" };

const mockInterest = {
	_id: "interest-1",
	customerId: "user-1",
	tourPackageId: "pkg-1",
	destinationId: null,
	preferredDates: { startDate: "2026-06-01", endDate: "2026-06-10" },
	groupSize: 4,
	contactPreference: "email",
	notes: "Looking for a family trip",
	status: INTEREST_STATUSES.ACTIVE,
	convertedBookingId: null,
	notifiedAt: null,
};

const mockInterest2 = {
	_id: "interest-2",
	customerId: "user-2",
	tourPackageId: "pkg-1",
	destinationId: null,
	groupSize: 2,
	contactPreference: "phone",
	notes: "",
	status: INTEREST_STATUSES.ACTIVE,
};

const mockPackage = {
	_id: "pkg-1",
	name: "Bali Adventure",
};

const mockDestination = {
	_id: "dest-1",
	name: "Bali Paradise",
};

// Model call results — keyed by action name
let modelCallResults = {};
let emittedEvents = [];

function createBroker() {
	const broker = new ServiceBroker({
		logger: false,
		validator: true,
	});

	// Spy on broker.emit
	const originalEmit = broker.emit.bind(broker);
	broker.emit = function (event, payload) {
		emittedEvents.push({ event, payload });
		return originalEmit(event, payload);
	};

	// Mock interest.model service
	broker.createService({
		name: "interest.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["interest.model.find"] === "function"
						? modelCallResults["interest.model.find"](ctx.params)
						: modelCallResults["interest.model.find"] || [];
				},
			},
			get: {
				handler(ctx) {
					if (typeof modelCallResults["interest.model.get"] === "function") {
						return modelCallResults["interest.model.get"](ctx.params);
					}
					return modelCallResults["interest.model.get"] || null;
				},
			},
			create: {
				handler(ctx) {
					return typeof modelCallResults["interest.model.create"] === "function"
						? modelCallResults["interest.model.create"](ctx.params)
						: modelCallResults["interest.model.create"] || {};
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["interest.model.update"] === "function"
						? modelCallResults["interest.model.update"](ctx.params)
						: modelCallResults["interest.model.update"] || {};
				},
			},
			count: {
				handler(ctx) {
					return typeof modelCallResults["interest.model.count"] === "function"
						? modelCallResults["interest.model.count"](ctx.params)
						: modelCallResults["interest.model.count"] || 0;
				},
			},
		},
	});

	// Mock tourPackage.model service
	broker.createService({
		name: "tourPackage.model",
		actions: {
			get: {
				handler(ctx) {
					if (typeof modelCallResults["tourPackage.model.get"] === "function") {
						return modelCallResults["tourPackage.model.get"](ctx.params);
					}
					return modelCallResults["tourPackage.model.get"] || null;
				},
			},
		},
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
		},
	});

	// Load real interest service
	broker.createService(InterestService);

	return broker;
}

// ---- Tests ----

describe("Interest Service", () => {
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
		emittedEvents = [];
	});

	// ========== submit ==========

	describe("submit", () => {
		it("should create interest with customerId from context", async () => {
			modelCallResults["tourPackage.model.get"] = () => mockPackage;
			modelCallResults["interest.model.create"] = (params) => ({
				_id: "new-interest",
				...params,
			});
			modelCallResults["interest.model.find"] = () => [mockInterest];

			const result = await broker.call(
				"interest.submit",
				{
					tourPackageId: "pkg-1",
					groupSize: 4,
					contactPreference: "email",
					notes: "Looking for a family trip",
				},
				{ meta: { user: mockUser } }
			);

			expect(result._id).toBe("new-interest");
			expect(result.customerId).toBe("user-1");
			expect(result.tourPackageId).toBe("pkg-1");
			expect(result.status).toBe(INTEREST_STATUSES.ACTIVE);
		});

		it("should require at least tourPackageId or destinationId", async () => {
			await expect(
				broker.call(
					"interest.submit",
					{ groupSize: 4 },
					{ meta: { user: mockUser } }
				)
			).rejects.toMatchObject({
				code: 422,
				type: ERROR_CODES.VALIDATION_ERROR,
			});
		});

		it("should throw error for invalid tourPackageId", async () => {
			modelCallResults["tourPackage.model.get"] = () => {
				throw new Error("not found");
			};

			await expect(
				broker.call(
					"interest.submit",
					{ tourPackageId: "invalid-pkg" },
					{ meta: { user: mockUser } }
				)
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.PACKAGE_NOT_FOUND,
			});
		});

		it("should emit threshold event when count reaches 5", async () => {
			modelCallResults["tourPackage.model.get"] = () => mockPackage;
			modelCallResults["interest.model.create"] = (params) => ({
				_id: "new-interest",
				...params,
			});
			// Return 5 active interests to trigger threshold
			modelCallResults["interest.model.find"] = () => [
				{ _id: "i1", status: INTEREST_STATUSES.ACTIVE },
				{ _id: "i2", status: INTEREST_STATUSES.ACTIVE },
				{ _id: "i3", status: INTEREST_STATUSES.ACTIVE },
				{ _id: "i4", status: INTEREST_STATUSES.ACTIVE },
				{ _id: "i5", status: INTEREST_STATUSES.ACTIVE },
			];

			await broker.call(
				"interest.submit",
				{ tourPackageId: "pkg-1", groupSize: 2 },
				{ meta: { user: mockUser } }
			);

			const thresholdEvent = emittedEvents.find((e) => e.event === "interest.thresholdReached");
			expect(thresholdEvent).toBeDefined();
			expect(thresholdEvent.payload.tourPackageId).toBe("pkg-1");
			expect(thresholdEvent.payload.count).toBe(5);
		});
	});

	// ========== listMine ==========

	describe("listMine", () => {
		it("should return interests for current user only", async () => {
			modelCallResults["interest.model.find"] = (params) => {
				if (params.query && params.query.customerId === "user-1") {
					return [mockInterest];
				}
				return [];
			};

			const result = await broker.call(
				"interest.listMine",
				{},
				{ meta: { user: mockUser } }
			);

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBe(1);
			expect(result[0].customerId).toBe("user-1");
		});
	});

	// ========== list ==========

	describe("list", () => {
		it("should return paginated interests (staff/admin)", async () => {
			modelCallResults["interest.model.find"] = () => [mockInterest, mockInterest2];

			const result = await broker.call(
				"interest.list",
				{ status: "active", page: 1, pageSize: 10 },
				{ meta: { user: mockUser } }
			);

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBe(2);
		});
	});

	// ========== getInterestCount ==========

	describe("getInterestCount", () => {
		it("should return count of active interests", async () => {
			modelCallResults["interest.model.find"] = () => [
				mockInterest,
				mockInterest2,
			];

			const result = await broker.call("interest.getInterestCount", {
				tourPackageId: "pkg-1",
			});

			expect(result).toBeDefined();
			expect(result.count).toBe(2);
		});
	});

	// ========== withdraw ==========

	describe("withdraw", () => {
		it("should withdraw own interest", async () => {
			modelCallResults["interest.model.get"] = () => ({ ...mockInterest });
			modelCallResults["interest.model.update"] = (params) => ({
				...mockInterest,
				status: params.status,
			});

			const result = await broker.call(
				"interest.withdraw",
				{ id: "interest-1" },
				{ meta: { user: mockUser } }
			);

			expect(result.status).toBe(INTEREST_STATUSES.WITHDRAWN);
		});

		it("should throw error if interest does not belong to user", async () => {
			modelCallResults["interest.model.get"] = () => ({
				...mockInterest,
				customerId: "user-1",
			});

			await expect(
				broker.call(
					"interest.withdraw",
					{ id: "interest-1" },
					{ meta: { user: mockOtherUser } }
				)
			).rejects.toMatchObject({
				code: 403,
				type: ERROR_CODES.FORBIDDEN,
			});
		});
	});

	// ========== updateStatus ==========

	describe("updateStatus", () => {
		it("should update status (admin)", async () => {
			modelCallResults["interest.model.get"] = () => ({ ...mockInterest });
			modelCallResults["interest.model.update"] = (params) => ({
				...mockInterest,
				status: params.status,
			});

			const result = await broker.call(
				"interest.updateStatus",
				{ id: "interest-1", status: INTEREST_STATUSES.EXPIRED },
				{ meta: { user: mockUser } }
			);

			expect(result.status).toBe(INTEREST_STATUSES.EXPIRED);
		});

		it("should throw INTEREST_NOT_FOUND for invalid id", async () => {
			modelCallResults["interest.model.get"] = () => {
				throw new Error("not found");
			};

			await expect(
				broker.call(
					"interest.updateStatus",
					{ id: "invalid-id", status: INTEREST_STATUSES.EXPIRED },
					{ meta: { user: mockUser } }
				)
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.INTEREST_NOT_FOUND,
			});
		});
	});
});
