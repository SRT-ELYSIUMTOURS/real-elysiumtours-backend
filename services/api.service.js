"use strict";

const ApiGateway = require("moleculer-web");
const { MoleculerClientError, MoleculerError } = require("moleculer").Errors;
const jwt = require("jsonwebtoken");

module.exports = {
	name: "api",

	mixins: [ApiGateway],

	settings: {
		port: process.env.PORT || 3001,
		ip: "0.0.0.0",

		cors: {
			origin: process.env.CORS_ORIGIN || "*",
			methods: (process.env.CORS_METHODS || "GET,POST,PUT,PATCH,DELETE").split(","),
			credentials: process.env.CORS_CREDENTIALS !== "false",
		},

		rateLimit: {
			limit: process.env.NODE_ENV === "production" ? 100 : 1000,
			window: 15 * 60 * 1000,
			headers: true,
		},

		bodyParsers: {
			json: {
				strict: false,
				limit: "10mb",
			},
			urlencoded: {
				extended: true,
				limit: "10mb",
			},
		},

		// Global hook: coerce common query params from strings to numbers
		// and pass device info through meta for session tracking
		onBeforeCall(ctx, route, req) {
			const numericFields = ["page", "pageSize", "limit", "offset", "maxDistanceKm", "minPrice", "maxPrice", "minGroupSize", "numberOfPassengers", "groupSize", "commissionRate"];
			for (const field of numericFields) {
				if (typeof ctx.params[field] === "string" && ctx.params[field] !== "") {
					const num = Number(ctx.params[field]);
					if (!isNaN(num)) {
						ctx.params[field] = num;
					}
				}
			}
			ctx.meta.userAgent = req.headers["user-agent"] || null;
			ctx.meta.clientIp = (req.headers["x-forwarded-for"] || "").split(",")[0].trim()
				|| req.connection?.remoteAddress
				|| req.socket?.remoteAddress
				|| null;
		},

		routes: [
			// ─── Health Check (no auth) ───
			{
				path: "/health",
				authorization: false,
				authentication: false,
				aliases: {
					"GET /": function healthCheck(req, res) {
						res.writeHead(200, { "Content-Type": "application/json" });
						res.end(JSON.stringify({
							status: "ok",
							timestamp: new Date().toISOString(),
							service: "elysium-tours-api",
							version: require("../package.json").version,
						}));
					},
				},
			},

			// ─── Route 1: Auth (public) ───
			{
				path: "/api/v1/auth",
				authorization: false,
				authentication: false,
				aliases: {
					"POST /register": "auth.register",
					"POST /login": "auth.login",
					"POST /verify-otp": "auth.verifyOTP",
					"POST /refresh-token": "auth.refreshToken",
					"POST /forgot-password": "auth.forgotPassword",
					"POST /reset-password": "auth.resetPassword",
					"POST /resend-otp": "auth.resendOTP",
					"POST /logout": "auth.logout",
				},
			},

			// ─── Route 2: Users ───
			{
				path: "/api/v1/users",
				authorization: true,
				authentication: true,
				aliases: {
					"GET /profile": "user.getProfile",
					"PUT /profile": "user.updateProfile",
					"PUT /change-password": "user.changePassword",
					"GET /permissions": "auth.getPermissions",
					"POST /": "user.createStaffUser",
					"GET /": "user.listUsers",
					"GET /:id": "user.getUserById",
					"PUT /:id/status": "user.updateUserStatus",
				},
			},

			// ─── Route 3: Destinations ───
			{
				path: "/api/v1/destinations",
				authorization: true,
				authentication: true,
				aliases: {
					"GET /search": "destination.search",
					"GET /": "destination.list",
					"GET /region/:region": "destination.listByRegion",
					"GET /slug/:slug": "destination.getBySlug",
					"GET /:destinationId/nearby-partners": "destination.findNearbyPartners",
					"GET /:id": "destination.get",
					"POST /": "destination.create",
					"PUT /:id": "destination.update",
					"PUT /:id/toggle": "destination.toggleActive",
				},
			},

			// ─── Route 4: Hotel Partners ───
			{
				path: "/api/v1/partners/hotels",
				authorization: true,
				authentication: true,
				aliases: {
					"GET /": "hotelPartner.list",
					"GET /nearby": "hotelPartner.findNearby",
					"GET /destination/:destinationId": "hotelPartner.getByDestination",
					"GET /:id": "hotelPartner.get",
					"POST /": "hotelPartner.create",
					"PUT /:id": "hotelPartner.update",
					"PUT /:id/commission": "hotelPartner.setCommission",
					"PUT /:id/availability": "hotelPartner.updateAvailability",
					"POST /:id/closeout-dates": "hotelPartner.addCloseOutDates",
					"PUT /:id/toggle": "hotelPartner.toggleActive",
				},
			},

			// ─── Route 5: Attraction Partners ───
			{
				path: "/api/v1/partners/attractions",
				authorization: true,
				authentication: true,
				aliases: {
					"GET /": "attraction.list",
					"GET /categories": "attraction.listCategories",
					"GET /nearby": "attraction.findNearby",
					"GET /destination/:destinationId": "attraction.getByDestination",
					"GET /:id": "attraction.get",
					"POST /": "attraction.create",
					"PUT /:id": "attraction.update",
					"PUT /:id/toggle": "attraction.toggleActive",
				},
			},

			// ─── Route 6: Dining Partners ───
			{
				path: "/api/v1/partners/dining",
				authorization: true,
				authentication: true,
				aliases: {
					"GET /": "dining.list",
					"GET /nearby": "dining.findNearby",
					"GET /destination/:destinationId": "dining.getByDestination",
					"GET /:id": "dining.get",
					"POST /": "dining.create",
					"PUT /:id": "dining.update",
					"PUT /:id/commission": "dining.setCommission",
					"PUT /:id/toggle": "dining.toggleActive",
				},
			},

			// ─── Route 7: Transport Partners ───
			{
				path: "/api/v1/partners/transport",
				authorization: true,
				authentication: true,
				aliases: {
					"GET /providers": "transport.listProviders",
					"GET /providers/:id": "transport.getProvider",
					"POST /providers": "transport.registerProvider",
					"PUT /providers/:id": "transport.updateProvider",
					"PUT /providers/:id/toggle": "transport.toggleProviderActive",
					"GET /vehicles": "transport.listVehicles",
					"POST /vehicles": "transport.addVehicle",
					"PUT /vehicles/:id": "transport.updateVehicle",
					"GET /estimate": "transport.estimateTransportCost",
				},
			},

			// ─── Route 8: Tours (Phase 2) ───
			{
				path: "/api/v1/tours",
				authorization: true,
				authentication: true,
				aliases: {
					"GET /packages/search": "tourPackage.search",
					"GET /packages": "tourPackage.list",
					"GET /packages/:packageId/proximity-map": "tourPackage.getProximityMap",
					"POST /packages/:packageId/view": "tourPackage.incrementViewCount",
					"GET /packages/:id": "tourPackage.get",
					"POST /packages": "tourPackage.create",
					"PUT /packages/:id": "tourPackage.update",
					"PUT /packages/:id/toggle": "tourPackage.toggleActive",
					"POST /packages/:packageId/waitlist": "tourPackage.joinWaitlist",
					"GET /packages/:packageId/waitlist": "tourPackage.getWaitlist",
					"POST /dynamic/build": "dynamicTour.buildTourRequest",
					"POST /dynamic/submit": "dynamicTour.submitForPricing",
					"GET /dynamic/requests": "dynamicTour.getMyRequests",
					"DELETE /dynamic/requests/:id": "dynamicTour.cancelRequest",
				},
			},

			// ─── Route 9: Bookings (Phase 2) ───
			{
				path: "/api/v1/bookings",
				authorization: true,
				authentication: true,
				aliases: {
					"POST /": "booking.createBooking",
					"POST /check-overlap": "booking.checkOverlap",
					"GET /": "booking.listBookings",
					"GET /:id": "booking.getBooking",
					"PUT /:id/status": "booking.updateStatus",
					"PUT /:id/cancel": "booking.cancelBooking",
					"POST /:id/confirm-partner": "booking.confirmPartner",
					"POST /:id/reject-partner": "booking.rejectPartner",
					"GET /:id/substitutions/:partnerId": "booking.suggestSubstitution",
					"POST /:id/accept-substitution": "booking.acceptSubstitution",
				},
			},

			// ─── Route 10: Payments (Phase 2) ───
			{
				path: "/api/v1/payments",
				authorization: true,
				authentication: true,
				aliases: {
					"POST /initiate": "payment.initiatePayment",
					"POST /verify": "payment.verifyPayment",
					"POST /refund": "payment.refundPayment",
					"GET /transactions": "payment.getTransactions",
					"GET /transactions/:id": "payment.getPayment",
				},
			},

			// ─── Route 11: Notifications ───
			{
				path: "/api/v1/notifications",
				authorization: true,
				authentication: true,
				aliases: {
					"GET /": "notification.listForUser",
					"PUT /:id/read": "notification.markRead",
				},
			},

			// ─── Route 12: Admin ───
			{
				path: "/api/v1/admin",
				authorization: true,
				authentication: true,
				aliases: {
					"GET /dashboard": "admin.getDashboard",
					"GET /templates": "template.list",
					"GET /templates/:id": "template.get",
					"POST /templates": "template.create",
					"PUT /templates/:id": "template.update",
					"POST /templates/seed": "template.seedDefaults",
					"GET /contracts": "contract.listContracts",
					"POST /contract-templates": "contract.createTemplate",
					"GET /contract-templates/:id": "contract.getTemplate",
					"PUT /contract-templates/:id": "contract.updateTemplate",
					"GET /contract-templates": "contract.listTemplates",
					"POST /contract-templates/seed": "contract.seedDefaultTemplates",
					"GET /sla-metrics": "pricingDesk.getSLAMetrics",
					"GET /analytics/bookings": "booking.getAnalytics",
					"GET /analytics/occupancy": "booking.getOccupancyReport",
					"GET /analytics/payments": "payment.getPaymentAnalytics",
					"GET /analytics/revenue": "payment.getRevenueByPeriod",
				},
			},

			// ─── Route 13: Pricing Desk (Phase 3) ───
			{
				path: "/api/v1/pricing-desk",
				authorization: true,
				authentication: true,
				aliases: {
					"GET /queue": "pricingDesk.getQueue",
					"GET /quotes/:quoteId": "pricingDesk.getQuoteDetail",
					"POST /quotes/:quoteId/assign": "pricingDesk.assignQuote",
					"POST /quotes/:quoteId/submit": "pricingDesk.submitQuote",
					"POST /quotes/:quoteId/accept": "pricingDesk.customerAccept",
					"POST /quotes/:quoteId/reject": "pricingDesk.customerReject",
					"POST /quotes/:quoteId/revise": "pricingDesk.reviseQuote",
					"GET /sla-metrics": "pricingDesk.getSLAMetrics",
				},
			},

			// ─── Route 14: Payment Plans (Phase 3) ───
			{
				path: "/api/v1/payment-plans",
				authorization: true,
				authentication: true,
				aliases: {
					"GET /booking/:bookingId": "paymentPlan.getPlan",
					"GET /:id": "paymentPlan.getPlanById",
					"GET /:paymentPlanId/milestones": "paymentPlan.getMilestones",
					"GET /booking/:bookingId/next-due": "paymentPlan.getNextDueMilestone",
					"POST /milestones/:milestoneId/pay": "paymentPlan.payMilestone",
				},
			},

			// ─── Route: Forex Rates (admin-managed FX for USD→GHS settlement) ───
			{
				path: "/api/v1/forex-rates",
				authorization: true,
				authentication: true,
				aliases: {
					"GET /": "forexRate.list",
					"POST /": "forexRate.create",
					"PUT /:id": "forexRate.update",
					"POST /convert": "forexRate.convert",
					"GET /current": "forexRate.getCurrent",
					"PUT /:id/deactivate": "forexRate.deactivate",
				},
			},

			// ─── Route 15: Contracts (Phase 3) ───
			{
				path: "/api/v1/contracts",
				authorization: true,
				authentication: true,
				aliases: {
					"GET /booking/:bookingId": "contract.getByBooking",
					"POST /:contractId/send": "contract.sendToCustomer",
					"POST /accept": "contract.customerAccept",
					"POST /:contractId/reject": "contract.customerReject",
					"GET /verify/:bookingId": "contract.verifyAcceptance",
					"GET /": "contract.listContracts",
				},
			},

			// ─── Route 16: Interests (Phase 3) ───
			{
				path: "/api/v1/interests",
				authorization: true,
				authentication: true,
				aliases: {
					"POST /": "interest.submit",
					"GET /mine": "interest.listMine",
					"GET /": "interest.list",
					"GET /count": "interest.getInterestCount",
					"PUT /:id/status": "interest.updateStatus",
					"PUT /:id/withdraw": "interest.withdraw",
					"POST /bulk-invite/:tourPackageId": "interest.convertToBulkInvitation",
				},
			},

			// ─── Route: Reviews ───
			{
				path: "/api/v1/reviews",
				authorization: true,
				authentication: true,
				aliases: {
					"GET /tour/:tourPackageId": "review.listByTour",
					"GET /stats/:tourPackageId": "review.getStats",
					"GET /": "review.listAll",
					"GET /:id": "review.getById",
					"POST /": "review.create",
					"PUT /:id": "review.update",
					"DELETE /:id": "review.delete",
					"POST /:reviewId/response": "review.addResponse",
				},
			},

			// ─── Route: Contact & Newsletter ───
			{
				path: "/api/v1/contact",
				authorization: false,
				authentication: false,
				aliases: {
					"POST /": "contact.submit",
					"POST /newsletter": "contact.submitNewsletter",
				},
			},

			// ══════════════════════════════════════
			// API v2 — Multi-Tenant Routes
			// ══════════════════════════════════════

			// ─── v2 Auth ───
			{
				path: "/api/v2/auth",
				authorization: false,
				authentication: false,
				aliases: {
					"POST /register": "auth.register",
					"POST /login": "auth.login",
					"POST /verify-otp": "auth.verifyOTP",
					"POST /verify-2fa": "auth.verifyTwoFactorLogin",
					"POST /refresh-token": "auth.refreshToken",
					"POST /forgot-password": "auth.forgotPassword",
					"POST /reset-password": "auth.resetPassword",
					"POST /resend-otp": "auth.resendOTP",
					"POST /logout": "auth.logout",
					"POST /google": "auth.googleLogin",
				},
			},

			// ─── v2 Account (authenticated, no tenant scope) ───
			{
				path: "/api/v2/account",
				authorization: true,
				authentication: true,
				// No tenantRequired — permissions are role-based, not org-scoped
				aliases: {
					"GET /permissions": "auth.getPermissions",
				},
			},

			// ─── v2 Users ───
			{
				path: "/api/v2/users",
				authorization: true,
				authentication: true,
				onBeforeCall(ctx, route, req, res) {
					ctx.meta.tenantRequired = true;
				},
				aliases: {
					"GET /profile": "user.getProfile",
					"PUT /profile": "user.updateProfile",
					"PUT /change-password": "user.changePassword",
					"GET /permissions": "auth.getPermissions",
					"POST /": "user.createStaffUser",
					"GET /": "user.listUsers",
					"GET /:id": "user.getUserById",
					"PUT /:id/status": "user.updateUserStatus",
				},
			},

			// ─── v2 Destinations ───
			{
				path: "/api/v2/destinations",
				authorization: true,
				authentication: true,
				onBeforeCall(ctx, route, req, res) {
					ctx.meta.tenantRequired = true;
				},
				aliases: {
					"GET /search": "destination.search",
					"GET /": "destination.list",
					"GET /region/:region": "destination.listByRegion",
					"GET /slug/:slug": "destination.getBySlug",
					"GET /:destinationId/nearby-partners": "destination.findNearbyPartners",
					"GET /:id": "destination.get",
					"POST /": "destination.create",
					"PUT /:id": "destination.update",
					"PUT /:id/toggle": "destination.toggleActive",
				},
			},

			// ─── v2 Countries (admin) ───
			{
				path: "/api/v2/countries",
				authorization: true,
				authentication: true,
				onBeforeCall(ctx, route, req, res) {
					ctx.meta.tenantRequired = true;
				},
				aliases: {
					"GET /": "country.list",
					"GET /slug/:slug": "country.getBySlug",
					"GET /:id": "country.get",
					"POST /": "country.create",
					"PUT /:id": "country.update",
					"PUT /:id/toggle": "country.toggleActive",
				},
			},

			// ─── v2 Tours ───
			{
				path: "/api/v2/tours",
				authorization: true,
				authentication: true,
				onBeforeCall(ctx, route, req, res) {
					ctx.meta.tenantRequired = true;
				},
				aliases: {
					"GET /packages/search": "tourPackage.search",
					"GET /packages": "tourPackage.list",
					"GET /packages/:packageId/proximity-map": "tourPackage.getProximityMap",
					"POST /packages/:packageId/view": "tourPackage.incrementViewCount",
					"GET /packages/:id": "tourPackage.get",
					"POST /packages": "tourPackage.create",
					"PUT /packages/:id": "tourPackage.update",
					"PUT /packages/:id/toggle": "tourPackage.toggleActive",
					"POST /packages/:packageId/waitlist": "tourPackage.joinWaitlist",
					"GET /packages/:packageId/waitlist": "tourPackage.getWaitlist",
					"POST /dynamic/build": "dynamicTour.buildTourRequest",
					"POST /dynamic/submit": "dynamicTour.submitForPricing",
					"GET /dynamic/requests": "dynamicTour.getMyRequests",
					"DELETE /dynamic/requests/:id": "dynamicTour.cancelRequest",
				},
			},

			// ─── v2 Bookings ───
			{
				path: "/api/v2/bookings",
				authorization: true,
				authentication: true,
				onBeforeCall(ctx, route, req, res) {
					ctx.meta.tenantRequired = true;
				},
				aliases: {
					"POST /": "booking.createBooking",
					"POST /check-overlap": "booking.checkOverlap",
					"GET /": "booking.listBookings",
					"GET /:id": "booking.getBooking",
					"PUT /:id/status": "booking.updateStatus",
					"PUT /:id/cancel": "booking.cancelBooking",
					"POST /:id/confirm-partner": "booking.confirmPartner",
					"POST /:id/reject-partner": "booking.rejectPartner",
					"GET /:id/substitutions/:partnerId": "booking.suggestSubstitution",
					"POST /:id/accept-substitution": "booking.acceptSubstitution",
				},
			},

			// ─── v2 Payments ───
			{
				path: "/api/v2/payments",
				authorization: true,
				authentication: true,
				onBeforeCall(ctx, route, req, res) {
					ctx.meta.tenantRequired = true;
				},
				aliases: {
					"POST /initiate": "payment.initiatePayment",
					"POST /verify": "payment.verifyPayment",
					"POST /refund": "payment.refundPayment",
					"GET /transactions": "payment.getTransactions",
					"GET /transactions/:id": "payment.getPayment",
				},
			},

			// ─── v2 Partners (Hotels) ───
			{
				path: "/api/v2/partners/hotels",
				authorization: true,
				authentication: true,
				onBeforeCall(ctx, route, req, res) {
					ctx.meta.tenantRequired = true;
				},
				aliases: {
					"GET /": "hotelPartner.list",
					"GET /nearby": "hotelPartner.findNearby",
					"GET /destination/:destinationId": "hotelPartner.getByDestination",
					"GET /:id": "hotelPartner.get",
					"POST /": "hotelPartner.create",
					"PUT /:id": "hotelPartner.update",
					"PUT /:id/commission": "hotelPartner.setCommission",
					"PUT /:id/availability": "hotelPartner.updateAvailability",
					"POST /:id/closeout-dates": "hotelPartner.addCloseOutDates",
					"PUT /:id/toggle": "hotelPartner.toggleActive",
				},
			},

			// ─── v2 Gallery ───
			{
				path: "/api/v2/gallery",
				authorization: true,
				authentication: true,
				onBeforeCall(ctx, route, req, res) {
					ctx.meta.tenantRequired = true;
				},
				aliases: {
					"GET /": "gallery.list",
					"GET /:id": "gallery.get",
					"POST /": "gallery.create",
					"PUT /:id": "gallery.update",
					"DELETE /:id": "gallery.remove",
					"PUT /:id/toggle": "gallery.togglePublished",
				},
			},

			// ─── v2 Tour Guides ───
			{
				path: "/api/v2/guides",
				authorization: true,
				authentication: true,
				onBeforeCall(ctx, route, req, res) {
					ctx.meta.tenantRequired = true;
				},
				aliases: {
					"GET /": "tourGuide.list",
					"GET /:id": "tourGuide.get",
					"POST /": "tourGuide.create",
					"PUT /:id": "tourGuide.update",
					"PUT /:id/toggle": "tourGuide.toggleActive",
				},
			},

			// ─── v2 CMS / Blog / Content ───
			{
				path: "/api/v2/cms",
				authorization: false,
				authentication: false,
				aliases: {
					"GET /blog": "cms.listBlogPosts",
					"GET /blog/:slug": "cms.getBlogPost",
					"GET /faqs": "cms.listFAQs",
					"GET /testimonials": "cms.listTestimonials",
					"GET /gallery": "cms.listGallery",
					"GET /about": "cms.getAboutContent",
					"GET /settings": "cms.getSiteSettings",
				},
			},

			// ─── v2 Reviews ───
			{
				path: "/api/v2/reviews",
				authorization: true,
				authentication: true,
				onBeforeCall(ctx, route, req, res) {
					ctx.meta.tenantRequired = true;
				},
				aliases: {
					"GET /tour/:tourPackageId": "review.listByTour",
					"GET /stats/:tourPackageId": "review.getStats",
					"GET /": "review.listAll",
					"GET /:id": "review.getById",
					"POST /": "review.create",
					"PUT /:id": "review.update",
					"DELETE /:id": "review.delete",
					"POST /:reviewId/response": "review.addResponse",
				},
			},

			// ─── v2 Contact & Newsletter ───
			{
				path: "/api/v2/contact",
				authorization: false,
				authentication: false,
				aliases: {
					"POST /": "contact.submit",
					"POST /newsletter": "contact.submitNewsletter",
				},
			},

			// ─── v2 Organization (current user's org) ───
			{
				path: "/api/v2/organization",
				authorization: true,
				authentication: true,
				aliases: {
					"GET /config": "organization.getMyConfig",
				},
			},

			// ─── v2 Platform Admin (Super Admin only) ───
			{
				path: "/api/v2/platform",
				authorization: true,
				authentication: true,
				aliases: {
					"GET /organizations": "superAdmin.listOrganizations",
					"GET /organizations/:id": "superAdmin.getOrganization",
					"POST /organizations": "superAdmin.createOrganization",
					"PUT /organizations/:id/suspend": "superAdmin.suspendOrganization",
					"PUT /organizations/:id/activate": "superAdmin.activateOrganization",
					"DELETE /organizations/:id": "superAdmin.deleteOrganization",
					"GET /health": "superAdmin.getPlatformHealth",
					"GET /revenue": "superAdmin.getCrossOrgRevenue",
					"GET /analytics": "superAdmin.getCrossOrgAnalytics",
					"GET /organizations/:id/config": "organization.getConfig",
					"PUT /organizations/:id/config": "organization.setConfig",
					"PATCH /organizations/:id/config": "organization.mergeConfig",
					"DELETE /organizations/:id/config-key": "organization.deleteConfigKey",
				},
			},

			// ─── v2 Contracts ───
			{
				path: "/api/v2/contracts",
				authorization: true,
				authentication: true,
				onBeforeCall(ctx, route, req, res) { ctx.meta.tenantRequired = true; },
				aliases: {
					"GET /booking/:bookingId": "contract.getByBooking",
					"POST /:contractId/send": "contract.sendToCustomer",
					"POST /accept": "contract.customerAccept",
					"POST /:contractId/reject": "contract.customerReject",
					"GET /verify/:bookingId": "contract.verifyAcceptance",
					"GET /": "contract.listContracts",
				},
			},

			// ─── v2 Interests ───
			{
				path: "/api/v2/interests",
				authorization: true,
				authentication: true,
				onBeforeCall(ctx, route, req, res) { ctx.meta.tenantRequired = true; },
				aliases: {
					"POST /": "interest.submit",
					"GET /mine": "interest.listMine",
					"GET /": "interest.list",
					"GET /count": "interest.getInterestCount",
					"PUT /:id/status": "interest.updateStatus",
					"PUT /:id/withdraw": "interest.withdraw",
					"POST /bulk-invite/:tourPackageId": "interest.convertToBulkInvitation",
				},
			},

			// ─── v2 Notifications ───
			{
				path: "/api/v2/notifications",
				authorization: true,
				authentication: true,
				onBeforeCall(ctx, route, req, res) { ctx.meta.tenantRequired = true; },
				aliases: {
					"GET /": "notification.listForUser",
					"PUT /:id/read": "notification.markRead",
				},
			},

			// ─── v2 Payment Plans ───
			{
				path: "/api/v2/payment-plans",
				authorization: true,
				authentication: true,
				onBeforeCall(ctx, route, req, res) { ctx.meta.tenantRequired = true; },
				aliases: {
					"GET /booking/:bookingId": "paymentPlan.getPlan",
					"GET /:id": "paymentPlan.getPlanById",
					"GET /:paymentPlanId/milestones": "paymentPlan.getMilestones",
					"GET /booking/:bookingId/next-due": "paymentPlan.getNextDueMilestone",
					"POST /milestones/:milestoneId/pay": "paymentPlan.payMilestone",
				},
			},

			// ─── v2 Forex Rates ───
			{
				path: "/api/v2/forex-rates",
				authorization: true,
				authentication: true,
				onBeforeCall(ctx, route, req, res) { ctx.meta.tenantRequired = true; },
				aliases: {
					"GET /": "forexRate.list",
					"POST /": "forexRate.create",
					"PUT /:id": "forexRate.update",
					"POST /convert": "forexRate.convert",
					"GET /current": "forexRate.getCurrent",
					"PUT /:id/deactivate": "forexRate.deactivate",
				},
			},

			// ─── v2 Pricing Desk ───
			{
				path: "/api/v2/pricing-desk",
				authorization: true,
				authentication: true,
				onBeforeCall(ctx, route, req, res) { ctx.meta.tenantRequired = true; },
				aliases: {
					"GET /queue": "pricingDesk.getQueue",
					"GET /quotes/:quoteId": "pricingDesk.getQuoteDetail",
					"POST /quotes/:quoteId/assign": "pricingDesk.assignQuote",
					"POST /quotes/:quoteId/submit": "pricingDesk.submitQuote",
					"POST /quotes/:quoteId/accept": "pricingDesk.customerAccept",
					"POST /quotes/:quoteId/reject": "pricingDesk.customerReject",
					"POST /quotes/:quoteId/revise": "pricingDesk.reviseQuote",
					"GET /sla-metrics": "pricingDesk.getSLAMetrics",
				},
			},

			// ─── v2 Admin Dashboard ───
			{
				path: "/api/v2/admin",
				authorization: true,
				authentication: true,
				onBeforeCall(ctx, route, req, res) { ctx.meta.tenantRequired = true; },
				aliases: {
					"GET /dashboard": "admin.getDashboard",
					"GET /templates": "template.list",
					"GET /templates/:id": "template.get",
					"POST /templates": "template.create",
					"PUT /templates/:id": "template.update",
					"POST /templates/seed": "template.seedDefaults",
					"GET /contracts": "contract.listContracts",
					"POST /contract-templates": "contract.createTemplate",
					"GET /contract-templates/:id": "contract.getTemplate",
					"PUT /contract-templates/:id": "contract.updateTemplate",
					"GET /contract-templates": "contract.listTemplates",
					"POST /contract-templates/seed": "contract.seedDefaultTemplates",
					"GET /sla-metrics": "pricingDesk.getSLAMetrics",
					"GET /analytics/bookings": "booking.getAnalytics",
					"GET /analytics/occupancy": "booking.getOccupancyReport",
					"GET /analytics/payments": "payment.getPaymentAnalytics",
					"GET /analytics/revenue": "payment.getRevenueByPeriod",
				},
			},

			// ─── v2 Partners (Attractions) ───
			{
				path: "/api/v2/partners/attractions",
				authorization: true,
				authentication: true,
				onBeforeCall(ctx, route, req, res) { ctx.meta.tenantRequired = true; },
				aliases: {
					"GET /": "attraction.list",
					"GET /categories": "attraction.listCategories",
					"GET /nearby": "attraction.findNearby",
					"GET /destination/:destinationId": "attraction.getByDestination",
					"GET /:id": "attraction.get",
					"POST /": "attraction.create",
					"PUT /:id": "attraction.update",
					"PUT /:id/toggle": "attraction.toggleActive",
				},
			},

			// ─── v2 Partners (Dining) ───
			{
				path: "/api/v2/partners/dining",
				authorization: true,
				authentication: true,
				onBeforeCall(ctx, route, req, res) { ctx.meta.tenantRequired = true; },
				aliases: {
					"GET /": "dining.list",
					"GET /nearby": "dining.findNearby",
					"GET /destination/:destinationId": "dining.getByDestination",
					"GET /:id": "dining.get",
					"POST /": "dining.create",
					"PUT /:id": "dining.update",
					"PUT /:id/commission": "dining.setCommission",
					"PUT /:id/toggle": "dining.toggleActive",
				},
			},

			// ─── v2 Partners (Transport) ───
			{
				path: "/api/v2/partners/transport",
				authorization: true,
				authentication: true,
				onBeforeCall(ctx, route, req, res) { ctx.meta.tenantRequired = true; },
				aliases: {
					"GET /providers": "transport.listProviders",
					"GET /providers/:id": "transport.getProvider",
					"POST /providers": "transport.registerProvider",
					"PUT /providers/:id": "transport.updateProvider",
					"PUT /providers/:id/toggle": "transport.toggleProviderActive",
					"GET /vehicles": "transport.listVehicles",
					"POST /vehicles": "transport.addVehicle",
					"PUT /vehicles/:id": "transport.updateVehicle",
					"GET /estimate": "transport.estimateTransportCost",
				},
			},

			// ─── v2 Media ───
			{
				path: "/api/v2/media",
				authorization: true,
				authentication: true,
				onBeforeCall(ctx, route, req, res) { ctx.meta.tenantRequired = true; },
				aliases: {
					"POST /upload": "stream:media.upload",
					"POST /upload-url": "media.uploadFromUrl",
					"DELETE /:publicId": "media.delete",
					"GET /": "media.list",
					"GET /signed-url/:publicId": "media.getSignedUrl",
				},
				busboyConfig: {
					limits: { files: 1, fileSize: 10 * 1024 * 1024 },
				},
			},

			// ─── Route: Gallery ───
			{
				path: "/api/v1/gallery",
				authorization: true,
				authentication: true,
				aliases: {
					"GET /": "gallery.list",
					"GET /:id": "gallery.get",
					"POST /": "gallery.create",
					"PUT /:id": "gallery.update",
					"DELETE /:id": "gallery.remove",
					"PUT /:id/toggle": "gallery.togglePublished",
				},
			},
			// ─── Route: Tour Guides ───
			{
				path: "/api/v1/guides",
				authorization: true,
				authentication: true,
				aliases: {
					"GET /": "tourGuide.list",
					"GET /:id": "tourGuide.get",
					"POST /": "tourGuide.create",
					"PUT /:id": "tourGuide.update",
					"PUT /:id/toggle": "tourGuide.toggleActive",
				},
			},

			// ─── Route 17: CMS / Blog / Content ───
			{
				path: "/api/v1/cms",
				authorization: false,
				authentication: false,
				aliases: {
					"GET /blog": "cms.listBlogPosts",
					"GET /blog/:slug": "cms.getBlogPost",
					"GET /faqs": "cms.listFAQs",
					"GET /testimonials": "cms.listTestimonials",
					"GET /gallery": "cms.listGallery",
					"GET /about": "cms.getAboutContent",
					"GET /settings": "cms.getSiteSettings",
				},
			},

			// ─── Route 18: Webhooks (no auth) ───
			{
				path: "/api/v1/webhooks",
				authorization: false,
				authentication: false,
				aliases: {
					"POST /paystack": "payment.webhookHandler",
				},
				bodyParsers: {
					json: true,
				},
			},

			// ─── Route 18: Media Upload (Phase 4) ───
			{
				path: "/api/v1/media",
				authorization: true,
				authentication: true,
				aliases: {
					"POST /upload": "stream:media.upload",
					"POST /upload-url": "media.uploadFromUrl",
					"DELETE /:publicId": "media.delete",
					"GET /": "media.list",
					"GET /signed-url/:publicId": "media.getSignedUrl",
				},
				// Enable multipart for file uploads
				busboyConfig: {
					limits: {
						files: 1,
						fileSize: 10 * 1024 * 1024, // 10MB
					},
				},
			},

			// ══════════════════════════════════════
			// Tourist-facing public routes (no tenant scope)
			// ══════════════════════════════════════

			// ─── Tourist: Public tour browsing ───
			{
				path: "/api/v2/tourist/tours",
				authorization: false,
				authentication: false,
				aliases: {
					"GET /": "tourPackage.list",
					"GET /types": "tourPackage.getTourTypes",
					"GET /search": "tourPackage.search",
					"GET /gallery-images": "tourPackage.listGalleryImages",
					"GET /slug/:slug": "tourPackage.getBySlug",
					"GET /:id": "tourPackage.get",
					"POST /:packageId/view": "tourPackage.incrementViewCount",
					"POST /:packageId/waitlist": "tourPackage.joinWaitlist",
				},
			},

			// ─── Tourist: Public destination browsing ───
			{
				path: "/api/v2/tourist/destinations",
				authorization: false,
				authentication: false,
				aliases: {
					"GET /": "destination.list",
					"GET /region/:region": "destination.listByRegion",
					"GET /slug/:slug": "destination.getBySlug",
					"GET /:id": "destination.get",
				},
			},

			// ─── Tourist: Public guides browsing ───
			{
				path: "/api/v2/tourist/guides",
				authorization: false,
				authentication: false,
				aliases: {
					"GET /": "tourGuide.list",
					"GET /:id": "tourGuide.get",
				},
			},

			// ─── Tourist: Public country browsing ───
			{
				path: "/api/v2/tourist/countries",
				authorization: false,
				authentication: false,
				aliases: {
					"GET /": "country.list",
					"GET /slug/:slug": "country.getBySlug",
					"GET /:id": "country.get",
				},
			},

			// ─── Tourist: Public blog browsing ───
			{
				path: "/api/v2/tourist/blog",
				authorization: false,
				authentication: false,
				aliases: {
					"GET /": "blog.list",
					"GET /slug/:slug": "blog.getBySlug",
				},
			},

			// ─── Tourist: Public review browsing ───
			{
				path: "/api/v2/tourist/reviews",
				authorization: false,
				authentication: false,
				aliases: {
					"GET /tour/:tourPackageId": "review.listByTour",
					"GET /stats/:tourPackageId": "review.getStats",
					"GET /partner/:partnerId": "review.listByPartner",
				},
			},

			// ─── Tourist: Public partner browsing ───
			{
				path: "/api/v2/tourist/partners",
				authorization: false,
				authentication: false,
				aliases: {
					"GET /hotels": "hotelPartner.list",
					"GET /hotels/:id": "hotelPartner.get",
					"GET /attractions": "attraction.list",
					"GET /attractions/:id": "attraction.get",
					"GET /dining": "dining.list",
					"GET /dining/:id": "dining.get",
					"GET /transport": "transport.listProviders",
					"GET /transport/:id": "transport.getProvider",
					"GET /photographers": "photographer.list",
					"GET /photographers/:id": "photographer.get",
					"GET /services": "servicePartner.list",
					"GET /services/:id": "servicePartner.get",
					"GET /gallery-summary": async (req, res) => {
						try {
							const broker = req.$service.broker;
							const [hotels, attractions, dining, transport, guides] = await Promise.all([
								broker.call("hotelPartner.model.find",      { query: { isActive: true }, fields: ["coverImage", "images"], limit: 100 }),
								broker.call("attraction.model.find",        { query: { isActive: true }, fields: ["coverImage", "images"], limit: 100 }),
								broker.call("diningPartner.model.find",     { query: { isActive: true }, fields: ["coverImage", "images"], limit: 100 }),
								broker.call("transportProvider.model.find", { query: { isActive: true }, fields: ["coverImage", "images"], limit: 100 }),
								broker.call("tourGuide.model.find",         { query: { isActive: true }, fields: ["coverImage", "images"], limit: 100 }),
							]);

							const summarise = (records) => {
								const images = (records || []).flatMap(r => [r.coverImage, ...(r.images || [])].filter(Boolean));
								return { coverImage: records?.[0]?.coverImage || null, count: images.length };
							};

							const result = [
								{ type: "accommodation",  label: "Accommodation",        ...summarise(hotels) },
								{ type: "tour-sites",     label: "Tour Sites & Events",   ...summarise(attractions) },
								{ type: "transportation", label: "Transportation",         ...summarise(transport) },
								{ type: "restaurants",    label: "Restaurants & Dining",  ...summarise(dining) },
								{ type: "tour-guides",    label: "Tour Guides",           ...summarise(guides) },
							];

							res.setHeader("Content-Type", "application/json");
							res.end(JSON.stringify(result));
						} catch (err) {
							res.statusCode = 500;
							res.setHeader("Content-Type", "application/json");
							res.end(JSON.stringify({ error: err.message }));
						}
					},
				},
			},

			// ─── Tourist: Public guide browsing ───
			{
				path: "/api/v2/tourist/guides",
				authorization: false,
				authentication: false,
				aliases: {
					"GET /": "tourGuide.list",
					"GET /:id": "tourGuide.get",
				},
			},

			// ─── Tourist: Public partner applications ───
			{
				path: "/api/v2/partner-applications",
				authorization: false,
				authentication: false,
				aliases: {
					"POST /": "partnerApplication.submit",
				},
			},

			// ─── Tourist: Authenticated profile + bookings (no tenant scope) ───
			{
				path: "/api/v2/tourist/me",
				authorization: true,
				authentication: true,
				aliases: {
					"GET /profile": "user.getProfile",
					"PUT /profile": "user.updateProfile",
					"PUT /change-password": "user.changePassword",
					"PUT /avatar": "user.uploadAvatar",
					"GET /preferences": "user.getPreferences",
					"PUT /preferences": "user.updatePreferences",
					"PUT /security-email": "user.updateSecurityEmail",
					"DELETE /account": "user.deactivateAccount",
					"POST /2fa/init": "auth.initTwoFactor",
					"POST /2fa/confirm": "auth.confirmTwoFactor",
					"DELETE /2fa": "auth.disableTwoFactor",
					"GET /sessions": "user.listSessions",
					"DELETE /sessions/:sessionId": "user.revokeSession",
					"DELETE /sessions": "user.revokeAllOtherSessions",
					"GET /wishlist": "user.getWishlist",
					"POST /wishlist/:tourId": "user.addToWishlist",
					"DELETE /wishlist/:tourId": "user.removeFromWishlist",
					"GET /bookings": "booking.listBookings",
					"GET /bookings/:id": "booking.getBooking",
					"POST /bookings": "booking.createBooking",
					"PUT /bookings/:id/cancel": "booking.cancelBooking",
					"GET /review-stats": "review.getMyStats",
					"GET /reviews/tour/:tourPackageId": "review.listByTour",
					"GET /reviews/stats/:tourPackageId": "review.getStats",
					"POST /reviews": "review.create",
					"PUT /reviews/:id": "review.update",
					"DELETE /reviews/:id": "review.delete",
					"GET /notifications": "notification.listForUser",
					"PUT /notifications/:id/read": "notification.markRead",
				},
			},

			// ─── Tourist: Authenticated payments (no tenant scope) ───
			{
				path: "/api/v2/tourist/payments",
				authorization: true,
				authentication: true,
				aliases: {
					"POST /initiate": "payment.initiatePayment",
					"POST /verify": "payment.verifyPayment",
					"GET /transactions": "payment.getTransactions",
					"GET /transactions/:id": "payment.getPayment",
				},
			},

			// ─── Sitemap (public, non-versioned — must live at /sitemap.xml for SEO) ───
			{
				path: "/sitemap.xml",
				authorization: false,
				authentication: false,
				aliases: {
					"GET /": async function sitemapHandler(req, res) {
						try {
							const xml = await this.broker.call("sitemap.generate");
							res.writeHead(200, { "Content-Type": "text/xml; charset=utf-8" });
							res.end(xml);
						} catch (err) {
							this.logger.error("Sitemap generation failed", err);
							res.writeHead(500, { "Content-Type": "text/plain" });
							res.end("Sitemap temporarily unavailable");
						}
					},
				},
			},
		],

		// Global error handler
		onError(req, res, err) {
			res.setHeader("Content-Type", "application/json; charset=utf-8");

			// err.code can be a Mongo error code (11000) or non-HTTP number.
			// Only use it as HTTP status if it's a valid 3-digit HTTP code.
			let statusCode = 500;
			if (typeof err.code === "number" && err.code >= 100 && err.code < 600) {
				statusCode = err.code;
			}

			// Handle common Mongo errors
			let errorType = err.type || "INTERNAL_ERROR";
			let message = err.message || "An unexpected error occurred.";
			if (err.code === 11000 || (err.message && err.message.includes("E11000"))) {
				statusCode = 409;
				errorType = "DUPLICATE_KEY";
				message = "A record with this value already exists.";
			}

			res.writeHead(statusCode);
			res.end(
				JSON.stringify({
					success: false,
					code: errorType,
					message,
					data: err.data || null,
				})
			);
		},
	},

	methods: {
		/**
		 * Authenticate the request.
		 * Extracts JWT from the Authorization header and decodes the user.
		 * Does NOT throw if token is missing or invalid — lets service-level auth decide.
		 *
		 * @param {Context} ctx
		 * @param {Object} route
		 * @param {IncomingRequest} req
		 * @returns {Promise<Object|null>}
		 */
		async authenticate(ctx, route, req) {
			const authHeader = req.headers["authorization"];

			if (!authHeader) {
				return null;
			}

			const parts = authHeader.split(" ");
			if (parts.length !== 2 || parts[0] !== "Bearer") {
				return null;
			}

			const token = parts[1];

			try {
				const secret = process.env.JWT_SECRET || "elysium-secret-key";
				const decoded = jwt.verify(token, secret);

				ctx.meta.user = {
					id: decoded.id,
					email: decoded.email,
					role: decoded.role,
					organizationId: decoded.organizationId || null,
					sessionId: decoded.sessionId || null,
				};

				return ctx.meta.user;
			} catch (err) {
				// Token invalid or expired — don't throw, let middleware handle it
				return null;
			}
		},

		/**
		 * Authorize the request.
		 * Checks if the resolved action requires auth and blocks unauthenticated users.
		 * This runs AFTER authenticate() and BEFORE the action handler.
		 */
		async authorize(ctx, route, req) {
			const action = ctx.action;
			if (!action) return;

			// If action requires auth and user is not set, reject
			if (action.auth === "required" && !ctx.meta.user) {
				throw new MoleculerClientError(
					"Authentication required.",
					401,
					"UNAUTHORIZED"
				);
			}

			// If action requires a specific role, check it
			if (action.role && ctx.meta.user) {
				const userRole = ctx.meta.user.role;
				// super_admin can access anything
				if (userRole === "super_admin") return;
				if (action.role === "super_admin") {
					throw new MoleculerClientError("Super admin access required.", 403, "FORBIDDEN");
				}
				if (action.role === "admin" && userRole !== "admin") {
					throw new MoleculerClientError("Admin access required.", 403, "FORBIDDEN");
				}
				if (action.role === "staff" && userRole !== "staff" && userRole !== "admin") {
					throw new MoleculerClientError("Staff access required.", 403, "FORBIDDEN");
				}
			}
		},
	},
};
