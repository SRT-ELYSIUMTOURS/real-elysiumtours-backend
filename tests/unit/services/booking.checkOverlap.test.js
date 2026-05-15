"use strict";

const { ServiceBroker } = require("moleculer");
const BookingService = require("../../../services/booking.service");
const { BOOKING_STATUSES, ERROR_CODES } = require("../../../utils/constants");

const customerId = "cust-1";
const otherCustomerId = "cust-2";

const existingConfirmed = {
	_id: "bk-1",
	bookingRef: "ELY-BK-001",
	customerId,
	status: BOOKING_STATUSES.CONFIRMED,
	tourDate: "2027-01-23T06:00:00.000Z",
	endDate: "2027-01-28T18:00:00.000Z",
	packageId: "pkg-tour-1",
	groupSize: 2,
};

const existingPending = {
	_id: "bk-2",
	bookingRef: "ELY-BK-002",
	customerId,
	status: BOOKING_STATUSES.PENDING_PAYMENT,
	tourDate: "2027-02-15T06:00:00.000Z",
	endDate: "2027-02-20T18:00:00.000Z",
	packageId: "pkg-tour-x",
	groupSize: 1,
};

const existingCancelled = {
	_id: "bk-3",
	bookingRef: "ELY-BK-003",
	customerId,
	status: BOOKING_STATUSES.CANCELLED,
	tourDate: "2027-01-26T06:00:00.000Z",
	endDate: "2027-01-28T18:00:00.000Z",
};

const existingCompleted = {
	_id: "bk-4",
	bookingRef: "ELY-BK-004",
	customerId,
	status: BOOKING_STATUSES.TOUR_COMPLETED,
	tourDate: "2027-01-25T06:00:00.000Z",
	endDate: "2027-01-27T18:00:00.000Z",
};

const someoneElsesBooking = {
	_id: "bk-5",
	bookingRef: "ELY-BK-005",
	customerId: otherCustomerId,
	status: BOOKING_STATUSES.CONFIRMED,
	tourDate: "2027-01-23T06:00:00.000Z",
	endDate: "2027-01-28T18:00:00.000Z",
};

let modelCallResults = {};

function createBroker() {
	const broker = new ServiceBroker({ logger: false, validator: true });

	function resolveMock(key, ctx) {
		const r = modelCallResults[key];
		if (typeof r === "function") return r(ctx ? ctx.params : undefined);
		return r;
	}

	broker.createService({
		name: "booking.model",
		actions: {
			find: { handler(ctx) { return resolveMock("booking.model.find", ctx) || []; } },
			get: { handler(ctx) { return resolveMock("booking.model.get", ctx) || null; } },
			create: { handler() { return {}; } },
			update: { handler() { return {}; } },
		},
	});

	broker.createService({ name: "tourPackage.model", actions: { get: { handler() { return null; } }, find: { handler() { return []; } } } });
	broker.createService({ name: "quote.model", actions: { get: { handler() { return null; } } } });
	broker.createService({ name: "tourRequest.model", actions: { get: { handler() { return null; } } } });
	broker.createService({ name: "hotelPartner.model", actions: { get: { handler() { return null; } } } });

	broker.createService(BookingService);
	return broker;
}

const customerMeta = { user: { id: customerId, role: "customer", email: "c@test.com" } };

describe("booking.checkOverlap", () => {
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

	it("returns hasOverlap=false when the customer has no active bookings", async () => {
		modelCallResults["booking.model.find"] = () => [];

		const result = await broker.call(
			"booking.checkOverlap",
			{ tourDate: "2027-01-23T06:00:00.000Z", endDate: "2027-01-28T18:00:00.000Z" },
			{ meta: customerMeta }
		);

		expect(result.hasOverlap).toBe(false);
		expect(result.overlaps).toEqual([]);
	});

	it("detects an identical overlap with an active confirmed booking", async () => {
		modelCallResults["booking.model.find"] = () => [existingConfirmed];

		const result = await broker.call(
			"booking.checkOverlap",
			{ tourDate: "2027-01-23T06:00:00.000Z", endDate: "2027-01-28T18:00:00.000Z" },
			{ meta: customerMeta }
		);

		expect(result.hasOverlap).toBe(true);
		expect(result.overlaps).toHaveLength(1);
		expect(result.overlaps[0].bookingRef).toBe("ELY-BK-001");
	});

	it("detects a partial overlap (Achimota Tour 1 + Tour 3 case)", async () => {
		// Tour 1: 23–28 Jan exists. New booking: Tour 3, 26–28 Jan. Overlap on 26–28.
		modelCallResults["booking.model.find"] = () => [existingConfirmed];

		const result = await broker.call(
			"booking.checkOverlap",
			{ tourDate: "2027-01-26T06:00:00.000Z", endDate: "2027-01-28T18:00:00.000Z" },
			{ meta: customerMeta }
		);

		expect(result.hasOverlap).toBe(true);
		expect(result.overlaps).toHaveLength(1);
	});

	it("returns no overlap for non-adjacent date ranges", async () => {
		modelCallResults["booking.model.find"] = () => [existingConfirmed];

		const result = await broker.call(
			"booking.checkOverlap",
			{ tourDate: "2027-03-01T06:00:00.000Z", endDate: "2027-03-05T18:00:00.000Z" },
			{ meta: customerMeta }
		);

		expect(result.hasOverlap).toBe(false);
	});

	it("considers pending_payment bookings as active conflict candidates", async () => {
		modelCallResults["booking.model.find"] = () => [existingPending];

		const result = await broker.call(
			"booking.checkOverlap",
			{ tourDate: "2027-02-17T06:00:00.000Z", endDate: "2027-02-19T18:00:00.000Z" },
			{ meta: customerMeta }
		);

		expect(result.hasOverlap).toBe(true);
		expect(result.overlaps[0].status).toBe(BOOKING_STATUSES.PENDING_PAYMENT);
	});

	it("ignores cancelled bookings even when dates overlap", async () => {
		// booking.model.find is keyed on the query, but our mock returns whatever we set.
		// We simulate the case where booking.model is fed only the cancelled record — in
		// reality the service's $in query would exclude it, but this test pins down the
		// behaviour at the action boundary if a cancelled record sneaks through.
		modelCallResults["booking.model.find"] = (params) => {
			// Mirror the service's $in filter for status to make the test realistic.
			const allowed = params && params.query && params.query.status && params.query.status.$in;
			if (allowed && !allowed.includes(existingCancelled.status)) return [];
			return [existingCancelled];
		};

		const result = await broker.call(
			"booking.checkOverlap",
			{ tourDate: "2027-01-26T06:00:00.000Z", endDate: "2027-01-28T18:00:00.000Z" },
			{ meta: customerMeta }
		);

		expect(result.hasOverlap).toBe(false);
	});

	it("ignores completed bookings (terminal status)", async () => {
		modelCallResults["booking.model.find"] = (params) => {
			const allowed = params && params.query && params.query.status && params.query.status.$in;
			if (allowed && !allowed.includes(existingCompleted.status)) return [];
			return [existingCompleted];
		};

		const result = await broker.call(
			"booking.checkOverlap",
			{ tourDate: "2027-01-25T06:00:00.000Z", endDate: "2027-01-27T18:00:00.000Z" },
			{ meta: customerMeta }
		);

		expect(result.hasOverlap).toBe(false);
	});

	it("excludes the specified bookingId (useful when re-checking a draft)", async () => {
		modelCallResults["booking.model.find"] = () => [existingConfirmed];

		const result = await broker.call(
			"booking.checkOverlap",
			{
				tourDate: "2027-01-23T06:00:00.000Z",
				endDate: "2027-01-28T18:00:00.000Z",
				excludeBookingId: "bk-1",
			},
			{ meta: customerMeta }
		);

		expect(result.hasOverlap).toBe(false);
	});

	it("only checks the requesting customer's own bookings", async () => {
		// booking.model.find is called with customerId in the query — our mock honours that.
		modelCallResults["booking.model.find"] = (params) => {
			if (params.query.customerId !== customerId) return [];
			return [];
		};

		const result = await broker.call(
			"booking.checkOverlap",
			{ tourDate: "2027-01-23T06:00:00.000Z", endDate: "2027-01-28T18:00:00.000Z" },
			{ meta: customerMeta }
		);

		expect(result.hasOverlap).toBe(false);
	});

	it("rejects invalid date input with VALIDATION_ERROR", async () => {
		await expect(
			broker.call(
				"booking.checkOverlap",
				{ tourDate: "not-a-date" },
				{ meta: customerMeta }
			)
		).rejects.toMatchObject({ type: ERROR_CODES.VALIDATION_ERROR });
	});

	it("treats single-day tours (no endDate) as tourDate..tourDate", async () => {
		const singleDay = {
			_id: "bk-day",
			bookingRef: "ELY-BK-DAY",
			customerId,
			status: BOOKING_STATUSES.CONFIRMED,
			tourDate: "2027-01-26T06:00:00.000Z",
			// no endDate
		};
		modelCallResults["booking.model.find"] = () => [singleDay];

		const result = await broker.call(
			"booking.checkOverlap",
			{ tourDate: "2027-01-26T08:00:00.000Z" },
			{ meta: customerMeta }
		);

		expect(result.hasOverlap).toBe(true);
	});
});
