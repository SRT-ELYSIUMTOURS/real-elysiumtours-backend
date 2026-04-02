"use strict";

// Booking state transitions (from diagram 9 -- Tour Lifecycle State Machine)
const BOOKING_TRANSITIONS = {
  pending_partner_confirmation: ["pending_payment", "cancelled"],
  pending_payment: ["payment_processing", "cancelled"],
  payment_processing: ["confirmed", "pending_payment"], // confirmed on success, back to pending on failure
  confirmed: ["tour_scheduled", "cancelled_with_refund"],
  tour_scheduled: ["tour_in_progress"],
  tour_in_progress: ["tour_completed"],
  tour_completed: ["review_requested"],
  review_requested: [], // terminal state
  cancelled: [],        // terminal state
  cancelled_with_refund: [], // terminal state
};

// Tour request state transitions (from diagram 4)
const TOUR_REQUEST_TRANSITIONS = {
  draft: ["submitted_for_pricing", "cancelled"],
  submitted_for_pricing: ["in_pricing_queue", "cancelled"],
  in_pricing_queue: ["assigned_to_staff"],
  assigned_to_staff: ["quote_sent"],
  quote_sent: ["quote_accepted", "quote_rejected", "quote_expired"],
  quote_accepted: [],  // converts to booking
  quote_rejected: ["assigned_to_staff"],  // can lead to revised quote
  quote_expired: [],   // terminal
  cancelled: [],       // terminal
};

// Quote state transitions (from diagram 10 -- pricing desk workflow)
const QUOTE_TRANSITIONS = {
  pending: ["calculating"],
  calculating: ["sent", "pending"], // back to pending if price unreasonable
  sent: ["accepted", "rejected", "expired"],
  accepted: [],  // terminal -- converts to booking
  rejected: ["revised", "pending"], // can revise or close
  expired: [],   // terminal
  revised: ["sent"], // revised quote gets re-sent
};

// Payment plan state transitions
const PAYMENT_PLAN_TRANSITIONS = {
  active: ["completed", "defaulted", "cancelled"],
  completed: [],  // terminal
  defaulted: ["active", "cancelled"], // can reactivate or cancel
  cancelled: [],  // terminal
};

// Contract state transitions
const CONTRACT_TRANSITIONS = {
  draft: ["sent"],
  sent: ["accepted", "rejected", "expired"],
  accepted: [], // terminal
  rejected: [], // terminal
  expired: [],  // terminal
};

/**
 * Check whether a status transition is valid within a given transition map.
 * @param {Object} transitionMap - One of the transition maps above.
 * @param {string} fromStatus - Current status.
 * @param {string} toStatus - Desired next status.
 * @returns {boolean}
 */
function isValidTransition(transitionMap, fromStatus, toStatus) {
  const validNext = transitionMap[fromStatus];
  if (!validNext) return false;
  return validNext.includes(toStatus);
}

/**
 * Return the list of valid next statuses for a given current status.
 * @param {Object} transitionMap - One of the transition maps above.
 * @param {string} fromStatus - Current status.
 * @returns {string[]}
 */
function getValidTransitions(transitionMap, fromStatus) {
  return transitionMap[fromStatus] || [];
}

module.exports = {
  BOOKING_TRANSITIONS,
  TOUR_REQUEST_TRANSITIONS,
  QUOTE_TRANSITIONS,
  PAYMENT_PLAN_TRANSITIONS,
  CONTRACT_TRANSITIONS,
  isValidTransition,
  getValidTransitions,
};
