"use strict";

const { ServiceBroker } = require("moleculer");
const BookingService = require("../../../services/booking.service");
const { ERROR_CODES, BOOKING_STATUSES } = require("../../../utils/constants");
const { BOOKING_TRANSITIONS } = require("../../../config/bookingStates.config");

// booking.getTransitions is the single source of truth for the admin status
// controls. These tests pin it to config/bookingStates.config.js (diagram 9)
// so the UI can never drift from the real state machine.

let currentBooking = null;

function staffMeta(id = "staff-1") {
	return { user: { id, role: "staff" } };
}

function createBroker() {
	const broker = new ServiceBroker({ logger: false, validator: true });

	broker.createService({
		name: "booking.model",
		actions: {
			get: { handler: () => currentBooking },
			find: { handler: () => [] },
			create: { handler: (ctx) => ctx.params },
			update: { handler: (ctx) => ctx.params },
			count: { handler: () => 0 },
		},
	});

	// Declared dependencies of booking.service — stubbed so the broker starts.
	for (const name of [
		"tourPackage.model",
		"tourGuide.model",
		"quote.model",
		"tourRequest.model",
		"hotelPartner.model",
	]) {
		broker.createService({
			name,
			actions: {
				get: { handler: () => null },
				find: { handler: () => [] },
				update: { handler: (ctx) => ctx.params },
			},
		});
	}

	broker.createService(BookingService);
	return broker;
}

describe("booking.getTransitions", () => {
	let broker;

	beforeAll(async () => {
		broker = createBroker();
		await broker.start();
	});

	afterAll(async () => {
		await broker.stop();
	});

	beforeEach(() => {
		currentBooking = null;
	});

	// Every status in the state machine must report exactly what the config says.
	// Parameterised so a config change without a UI change fails loudly here.
	it.each(Object.keys(BOOKING_TRANSITIONS))(
		"returns the config's allowed transitions for status '%s'",
		async (status) => {
			currentBooking = { _id: "bk-1", status };

			const res = await broker.call(
				"booking.getTransitions",
				{ bookingId: "bk-1" },
				{ meta: staffMeta() }
			);

			expect(res.currentStatus).toBe(status);
			expect(res.allowed.map((a) => a.status)).toEqual(BOOKING_TRANSITIONS[status]);
		}
	);

	it.each([
		BOOKING_STATUSES.CANCELLED,
		BOOKING_STATUSES.CANCELLED_WITH_REFUND,
		BOOKING_STATUSES.REVIEW_REQUESTED,
	])("flags terminal state '%s' with no allowed transitions", async (status) => {
		currentBooking = { _id: "bk-1", status };

		const res = await broker.call(
			"booking.getTransitions",
			{ bookingId: "bk-1" },
			{ meta: staffMeta() }
		);

		expect(res.terminal).toBe(true);
		expect(res.allowed).toEqual([]);
	});

	it("flags cancellation targets so the UI routes them through cancelBooking", async () => {
		// `confirmed` is the one status whose cancellation target carries a refund.
		currentBooking = { _id: "bk-1", status: BOOKING_STATUSES.CONFIRMED };

		const res = await broker.call(
			"booking.getTransitions",
			{ bookingId: "bk-1" },
			{ meta: staffMeta() }
		);

		const refundTarget = res.allowed.find(
			(a) => a.status === BOOKING_STATUSES.CANCELLED_WITH_REFUND
		);
		expect(refundTarget).toBeDefined();
		expect(refundTarget.requiresCancelAction).toBe(true);

		// Non-cancellation targets must NOT be flagged.
		const scheduled = res.allowed.find(
			(a) => a.status === BOOKING_STATUSES.TOUR_SCHEDULED
		);
		expect(scheduled.requiresCancelAction).toBe(false);
	});

	it("returns 404 BOOKING_NOT_FOUND for an unknown booking", async () => {
		currentBooking = null;

		await expect(
			broker.call("booking.getTransitions", { bookingId: "nope" }, { meta: staffMeta() })
		).rejects.toMatchObject({
			code: 404,
			type: ERROR_CODES.BOOKING_NOT_FOUND,
		});
	});

	it("returns no transitions for a status absent from the state machine", async () => {
		currentBooking = { _id: "bk-1", status: "some_legacy_status" };

		const res = await broker.call(
			"booking.getTransitions",
			{ bookingId: "bk-1" },
			{ meta: staffMeta() }
		);

		expect(res.allowed).toEqual([]);
		expect(res.terminal).toBe(true);
	});
});
