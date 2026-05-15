"use strict";

const { ServiceBroker } = require("moleculer");
const BookingService = require("../../../services/booking.service");
const { ERROR_CODES, BOOKING_STATUSES } = require("../../../utils/constants");

const customerId = "customer-1";

const baseExistingBooking = {
	_id: "booking-existing-1",
	bookingRef: "ELY-EXIST-001",
	customerId,
	packageId: "pkg-existing",
	tourDate: "2027-01-23T06:00:00.000Z",
	endDate: "2027-01-28T18:00:00.000Z",
	groupSize: 1,
	status: BOOKING_STATUSES.CONFIRMED,
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

	// Stubs for booking.service deps so the service starts
	broker.createService({ name: "tourPackage.model", actions: { get: { handler() { return null; } }, find: { handler() { return []; } } } });
	broker.createService({ name: "quote.model", actions: { get: { handler() { return null; } } } });
	broker.createService({ name: "tourRequest.model", actions: { get: { handler() { return null; } } } });
	broker.createService({ name: "hotelPartner.model", actions: { get: { handler() { return null; } } } });

	broker.createService(BookingService);
	return broker;
}

const customerMeta = { user: { id: customerId, role: "customer", email: "c@test" } };

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

	it("returns no overlap when customer has no other active bookings", async () => {
		modelCallResults["booking.model.find"] = () => [];

		const result = await broker.call(
			"booking.checkOverlap",
			{ tourDate: "2027-01-23T06:00:00.000Z", endDate: "2027-01-28T18:00:00.000Z" },
			{ meta: customerMeta }
		);

		expect(result.hasOverlap).toBe(false);
		expect(result.overlaps).toEqual([]);
	});

	it("flags a fully-contained range as overlapping (Achimota Tour 3 within Tour 1)", async () => {
		modelCallResults["booking.model.find"] = () => [baseExistingBooking];

		// Tour 3: 26–28 Jan (inside Tour 1's 23–28 Jan)
		const result = await broker.call(
			"booking.checkOverlap",
			{ tourDate: "2027-01-26T06:00:00.000Z", endDate: "2027-01-28T18:00:00.000Z" },
			{ meta: customerMeta }
		);

		expect(result.hasOverlap).toBe(true);
		expect(result.overlaps).toHaveLength(1);
		expect(result.overlaps[0].bookingRef).toBe("ELY-EXIST-001");
		expect(result.overlaps[0].status).toBe(BOOKING_STATUSES.CONFIRMED);
	});

	it("flags a partial overlap (proposed range starts before existing ends)", async () => {
		modelCallResults["booking.model.find"] = () => [baseExistingBooking];

		const result = await broker.call(
			"booking.checkOverlap",
			{ tourDate: "2027-01-27T06:00:00.000Z", endDate: "2027-02-01T18:00:00.000Z" },
			{ meta: customerMeta }
		);

		expect(result.hasOverlap).toBe(true);
		expect(result.overlaps).toHaveLength(1);
	});

	it("does NOT flag adjacent non-overlapping dates (existing ends 28th, new starts 29th)", async () => {
		modelCallResults["booking.model.find"] = () => [baseExistingBooking];

		const result = await broker.call(
			"booking.checkOverlap",
			{ tourDate: "2027-01-29T06:00:00.000Z", endDate: "2027-02-02T18:00:00.000Z" },
			{ meta: customerMeta }
		);

		expect(result.hasOverlap).toBe(false);
	});

	it("excludes a booking by id (used by createBooking to ignore the just-created record)", async () => {
		modelCallResults["booking.model.find"] = () => [baseExistingBooking];

		const result = await broker.call(
			"booking.checkOverlap",
			{
				tourDate: "2027-01-26T06:00:00.000Z",
				endDate: "2027-01-28T18:00:00.000Z",
				excludeBookingId: baseExistingBooking._id,
			},
			{ meta: customerMeta }
		);

		expect(result.hasOverlap).toBe(false);
	});

	it("treats a single-day tour (no endDate) as a 24-hour window", async () => {
		// Implementation convention: a booking with no endDate occupies a 24h
		// window starting at tourDate. So a Mar 1 booking blocks Mar 1 → Mar 2.
		modelCallResults["booking.model.find"] = () => [
			{
				...baseExistingBooking,
				tourDate: "2027-03-01T08:00:00.000Z",
				endDate: undefined,
			},
		];

		const sameDay = await broker.call(
			"booking.checkOverlap",
			{ tourDate: "2027-03-01T08:00:00.000Z" },
			{ meta: customerMeta }
		);
		expect(sameDay.hasOverlap).toBe(true);

		// Two days before: proposed window Feb 27 → Feb 28 ends strictly before
		// the existing booking's Mar 1 start, so no overlap.
		const twoDaysBefore = await broker.call(
			"booking.checkOverlap",
			{ tourDate: "2027-02-27T08:00:00.000Z" },
			{ meta: customerMeta }
		);
		expect(twoDaysBefore.hasOverlap).toBe(false);
	});

	it("ignores cancelled bookings (they are filtered out at the query level)", async () => {
		// booking.model.find is called with `status: { $in: [active statuses] }`.
		// We simulate the DB filter by returning [] when status is a cancelled value.
		modelCallResults["booking.model.find"] = (params) => {
			const statusQuery = params && params.query && params.query.status;
			if (statusQuery && statusQuery.$in && !statusQuery.$in.includes(BOOKING_STATUSES.CANCELLED)) {
				return []; // cancelled was correctly excluded → no overlaps
			}
			return [{ ...baseExistingBooking, status: BOOKING_STATUSES.CANCELLED }];
		};

		const result = await broker.call(
			"booking.checkOverlap",
			{ tourDate: "2027-01-26T06:00:00.000Z", endDate: "2027-01-28T18:00:00.000Z" },
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
});
