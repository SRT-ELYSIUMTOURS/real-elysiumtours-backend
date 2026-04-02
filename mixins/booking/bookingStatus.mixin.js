"use strict";

const { BOOKING_TRANSITIONS, isValidTransition } = require("../../config/bookingStates.config");
const { MoleculerClientError } = require("moleculer").Errors;
const { ERROR_CODES } = require("../../utils/constants");

module.exports = {
	methods: {
		validateBookingTransition(fromStatus, toStatus) {
			if (!isValidTransition(BOOKING_TRANSITIONS, fromStatus, toStatus)) {
				throw new MoleculerClientError(
					`Invalid booking transition: ${fromStatus} \u2192 ${toStatus}`,
					422,
					ERROR_CODES.INVALID_BOOKING_TRANSITION,
					{ fromStatus, toStatus, validTransitions: BOOKING_TRANSITIONS[fromStatus] || [] }
				);
			}
			return true;
		},
	},
};
