"use strict";

const ERROR_CODES = {
	// Auth
	USER_NOT_FOUND: "USER_NOT_FOUND",
	INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
	OTP_EXPIRED: "OTP_EXPIRED",
	OTP_INVALID: "OTP_INVALID",
	TOKEN_EXPIRED: "TOKEN_EXPIRED",
	TOKEN_INVALID: "TOKEN_INVALID",
	EMAIL_ALREADY_EXISTS: "EMAIL_ALREADY_EXISTS",
	EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
	UNAUTHORIZED: "UNAUTHORIZED",
	FORBIDDEN: "FORBIDDEN",
	// Booking
	BOOKING_NOT_FOUND: "BOOKING_NOT_FOUND",
	INVALID_BOOKING_TRANSITION: "INVALID_BOOKING_TRANSITION",
	PACKAGE_UNAVAILABLE: "PACKAGE_UNAVAILABLE",
	PACKAGE_NOT_FOUND: "PACKAGE_NOT_FOUND",
	INSUFFICIENT_CAPACITY: "INSUFFICIENT_CAPACITY",
	// Payment
	PAYMENT_FAILED: "PAYMENT_FAILED",
	PAYMENT_NOT_FOUND: "PAYMENT_NOT_FOUND",
	PAYMENT_ALREADY_VERIFIED: "PAYMENT_ALREADY_VERIFIED",
	COMMITMENT_FEE_REQUIRED: "COMMITMENT_FEE_REQUIRED",
	MILESTONE_NOT_FOUND: "MILESTONE_NOT_FOUND",
	MILESTONE_ALREADY_PAID: "MILESTONE_ALREADY_PAID",
	// FX
	FOREX_RATE_NOT_FOUND: "FOREX_RATE_NOT_FOUND",
	FOREX_RATE_STALE: "FOREX_RATE_STALE",
	UNSUPPORTED_CURRENCY: "UNSUPPORTED_CURRENCY",
	// Accommodation
	ACCOMMODATION_OPTION_NOT_FOUND: "ACCOMMODATION_OPTION_NOT_FOUND",
	ROOM_TYPE_NOT_AVAILABLE: "ROOM_TYPE_NOT_AVAILABLE",
	ACCOMMODATION_REQUIRED: "ACCOMMODATION_REQUIRED",
	// Quote
	QUOTE_NOT_FOUND: "QUOTE_NOT_FOUND",
	QUOTE_EXPIRED: "QUOTE_EXPIRED",
	QUOTE_ALREADY_RESPONDED: "QUOTE_ALREADY_RESPONDED",
	SLA_BREACHED: "SLA_BREACHED",
	// Contract
	CONTRACT_NOT_FOUND: "CONTRACT_NOT_FOUND",
	CONTRACT_NOT_ACCEPTED: "CONTRACT_NOT_ACCEPTED",
	CONTRACT_ALREADY_ACCEPTED: "CONTRACT_ALREADY_ACCEPTED",
	TEMPLATE_NOT_FOUND: "TEMPLATE_NOT_FOUND",
	// Partner
	PARTNER_NOT_FOUND: "PARTNER_NOT_FOUND",
	INVENTORY_UNAVAILABLE: "INVENTORY_UNAVAILABLE",
	DESTINATION_NOT_FOUND: "DESTINATION_NOT_FOUND",
	COUNTRY_NOT_FOUND: "COUNTRY_NOT_FOUND",
	// Tour
	TOUR_REQUEST_NOT_FOUND: "TOUR_REQUEST_NOT_FOUND",
	INTEREST_NOT_FOUND: "INTEREST_NOT_FOUND",
	// Notification
	NOTIFICATION_NOT_FOUND: "NOTIFICATION_NOT_FOUND",
	NOTIFICATION_ACCESS_DENIED: "NOTIFICATION_ACCESS_DENIED",
	// Media
	UPLOAD_FAILED: "UPLOAD_FAILED",
	DELETE_FAILED: "DELETE_FAILED",
	// Organization
	ORG_NOT_FOUND: "ORG_NOT_FOUND",
	ORG_SLUG_EXISTS: "ORG_SLUG_EXISTS",
	ORG_ALREADY_ACTIVE: "ORG_ALREADY_ACTIVE",
	ORG_ALREADY_SUSPENDED: "ORG_ALREADY_SUSPENDED",
	// Review
	REVIEW_NOT_FOUND: "REVIEW_NOT_FOUND",
	REVIEW_ACCESS_DENIED: "REVIEW_ACCESS_DENIED",
	// Subscriber
	SUBSCRIBER_ALREADY_EXISTS: "SUBSCRIBER_ALREADY_EXISTS",
	// CMS
	CMS_NOT_CONFIGURED: "CMS_NOT_CONFIGURED",
	CMS_QUERY_FAILED: "CMS_QUERY_FAILED",
	// Waitlist
	WAITLIST_FULL: "WAITLIST_FULL",
	WAITLIST_NOT_FOUND: "WAITLIST_NOT_FOUND",
	BOOKING_CUTOFF_PASSED: "BOOKING_CUTOFF_PASSED",
	// Gallery
	GALLERY_ITEM_NOT_FOUND: "GALLERY_ITEM_NOT_FOUND",
	// Tour Guide
	TOUR_GUIDE_NOT_FOUND: "TOUR_GUIDE_NOT_FOUND",
	// General
	VALIDATION_ERROR: "VALIDATION_ERROR",
	NOT_FOUND: "NOT_FOUND",
	INTERNAL_ERROR: "INTERNAL_ERROR",
};

const BOOKING_STATUSES = {
	PENDING_PARTNER_CONFIRMATION: "pending_partner_confirmation",
	PENDING_PAYMENT: "pending_payment",
	PAYMENT_PROCESSING: "payment_processing",
	CONFIRMED: "confirmed",
	FULLY_PAID: "fully_paid",
	CANCELLED: "cancelled",
	CANCELLED_WITH_REFUND: "cancelled_with_refund",
	CANCELLATION_OVERDUE: "cancellation_overdue",
	TOUR_SCHEDULED: "tour_scheduled",
	TOUR_IN_PROGRESS: "tour_in_progress",
	TOUR_COMPLETED: "tour_completed",
	REVIEW_REQUESTED: "review_requested",
};

const TOUR_REQUEST_STATUSES = {
	DRAFT: "draft",
	SUBMITTED: "submitted_for_pricing",
	IN_QUEUE: "in_pricing_queue",
	ASSIGNED: "assigned_to_staff",
	QUOTE_SENT: "quote_sent",
	QUOTE_ACCEPTED: "quote_accepted",
	QUOTE_REJECTED: "quote_rejected",
	QUOTE_EXPIRED: "quote_expired",
	CANCELLED: "cancelled",
};

const QUOTE_STATUSES = {
	PENDING: "pending",
	CALCULATING: "calculating",
	SENT: "sent",
	ACCEPTED: "accepted",
	REJECTED: "rejected",
	EXPIRED: "expired",
	REVISED: "revised",
};

const PAYMENT_STATUSES = {
	PENDING: "pending",
	PROCESSING: "processing",
	SUCCESS: "success",
	FAILED: "failed",
	REFUNDED: "refunded",
	PARTIALLY_REFUNDED: "partially_refunded",
};

const CONTRACT_STATUSES = {
	DRAFT: "draft",
	SENT: "sent",
	ACCEPTED: "accepted",
	REJECTED: "rejected",
	EXPIRED: "expired",
};

const PAYMENT_PLAN_STATUSES = {
	ACTIVE: "active",
	COMPLETED: "completed",
	DEFAULTED: "defaulted",
	CANCELLED: "cancelled",
};

const MILESTONE_STATUSES = {
	PENDING: "pending",
	OVERDUE: "overdue",
	PAID: "paid",
	WAIVED: "waived",
};

const INTEREST_STATUSES = {
	ACTIVE: "active",
	CONVERTED: "converted_to_booking",
	WITHDRAWN: "withdrawn",
	EXPIRED: "expired",
};

const USER_ROLES = {
	CUSTOMER: "customer",
	STAFF: "staff",
	ADMIN: "admin",
	SUPER_ADMIN: "super_admin",
};

const ORG_STATUSES = {
	ACTIVE: "active",
	SUSPENDED: "suspended",
	TRIAL: "trial",
};

const SUBSCRIPTION_PLANS = {
	FREE: "free",
	BASIC: "basic",
	PROFESSIONAL: "professional",
	ENTERPRISE: "enterprise",
};

const NOTIFICATION_CHANNELS = {
	EMAIL: "email",
	SMS: "sms",
	WHATSAPP: "whatsapp",
	IN_APP: "in_app",
};

const PARTNER_INVENTORY_MODELS = {
	ON_REQUEST: "on_request",
	FREE_SALE: "free_sale",
	ALLOTMENT: "allotment",
};

const HOTEL_TIERS = {
	BUDGET: "budget",
	STANDARD: "standard",
	PREMIUM: "premium",
	LUXURY: "luxury",
};

const TRANSPORT_TYPES = {
	BUS: "bus",
	MINIBUS: "minibus",
	SUV: "suv",
	SEDAN: "sedan",
	VAN: "van",
};

const SELLING_MODES = {
	GROUP_BUY: "group_buy",
	INDIVIDUAL_SEATS: "individual_seats",
};

const WAITLIST_STATUSES = {
	WAITING: "waiting",
	OFFERED: "offered",
	ACCEPTED: "accepted",
	EXPIRED: "expired",
	CANCELLED: "cancelled",
};

const ROOM_TYPES = {
	SINGLE: "single",
	DOUBLE: "double",
	TRIPLE: "triple",
	QUAD: "quad",
};

// Canonical attraction categories. Kept as a soft enum (the model stores a
// plain string) so existing free-form data isn't rejected, but admin pickers
// and frontend filters should pull from this list to keep tagging consistent.
//
// Covers the Achimota brief categories (ceremonies, dinners, slave-trade sites,
// safaris, boat rides) plus the existing generic Ghana tour vocabulary.
const ATTRACTION_CATEGORIES = {
	NATURAL_SITE: "natural_site",          // waterfalls, lakes, forests
	WILDLIFE_TOUR: "wildlife_tour",        // safaris, game drives, sanctuaries
	MUSEUM: "museum",                       // ethnographic, historical, art museums
	PALACE: "palace",                       // royal/chieftaincy seats (e.g. Manhyia)
	MONUMENT: "monument",                   // landmarks, statues, bridges
	BRIDGE: "bridge",                       // notable bridges (Adomi, etc.)
	SLAVE_TRADE_SITE: "slave_trade_site",  // forts/castles tied to the slave trade
	FORT: "fort",                           // forts and castles (Elmina, Prinzenstein)
	RELIGIOUS_SITE: "religious_site",       // shrines, churches, mosques
	CULTURAL_VILLAGE: "cultural_village",   // artisan villages (shea butter, kente)
	BEACH: "beach",                         // coastline, lagoons
	BOAT_RIDE: "boat_ride",                 // Dodi Princess, lake cruises
	HIKING: "hiking",                       // trails, mountains
	CEREMONY: "ceremony",                   // flag-planting, durbars, festivals
	DINNER_EVENT: "dinner_event",           // formal alumni dinners, fundraisers
	PERFORMANCE: "performance",             // music, dance, theatre
	MARKET: "market",                       // cultural / craft markets
	OTHER: "other",
};

// Currencies the platform can price tours in.
// Paystack-Ghana settles in GHS only — any other display currency is converted at payment time.
const CURRENCIES = {
	GHS: "GHS",
	USD: "USD",
	EUR: "EUR",
	GBP: "GBP",
};

const SETTLEMENT_CURRENCY = CURRENCIES.GHS;

module.exports = {
	ERROR_CODES,
	BOOKING_STATUSES,
	TOUR_REQUEST_STATUSES,
	QUOTE_STATUSES,
	PAYMENT_STATUSES,
	CONTRACT_STATUSES,
	PAYMENT_PLAN_STATUSES,
	MILESTONE_STATUSES,
	INTEREST_STATUSES,
	USER_ROLES,
	NOTIFICATION_CHANNELS,
	PARTNER_INVENTORY_MODELS,
	HOTEL_TIERS,
	TRANSPORT_TYPES,
	SELLING_MODES,
	WAITLIST_STATUSES,
	ORG_STATUSES,
	SUBSCRIPTION_PLANS,
	ROOM_TYPES,
	CURRENCIES,
	SETTLEMENT_CURRENCY,
	ATTRACTION_CATEGORIES,
};
