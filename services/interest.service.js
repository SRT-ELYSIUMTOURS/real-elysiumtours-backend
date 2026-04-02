"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const { ERROR_CODES, INTEREST_STATUSES } = require("../utils/constants");

const INTEREST_THRESHOLD = 5;

module.exports = {
	name: "interest",

	dependencies: ["interest.model", "tourPackage.model", "destination.model"],

	actions: {
		/**
		 * Submit a new expression of interest.
		 * Requires authentication.
		 */
		submit: {
			auth: "required",
			params: {
				tourPackageId: "string|optional",
				destinationId: "string|optional",
				preferredDates: "object|optional",
				groupSize: { type: "number", optional: true, convert: true },
				contactPreference: "string|optional",
				notes: "string|optional",
			},
			async handler(ctx) {
				const { tourPackageId, destinationId, preferredDates, groupSize, contactPreference, notes } = ctx.params;

				// At least one of tourPackageId or destinationId must be provided
				if (!tourPackageId && !destinationId) {
					throw new MoleculerClientError(
						"At least one of tourPackageId or destinationId must be provided.",
						422,
						ERROR_CODES.VALIDATION_ERROR
					);
				}

				// Validate tourPackageId exists if provided
				if (tourPackageId) {
					const pkg = await ctx.call(
						"tourPackage.model.get",
						{ id: tourPackageId },
						{ meta: ctx.meta }
					).catch(() => null);

					if (!pkg) {
						throw new MoleculerClientError(
							"Tour package not found.",
							404,
							ERROR_CODES.PACKAGE_NOT_FOUND,
							{ tourPackageId }
						);
					}
				}

				// Validate destinationId exists if provided
				if (destinationId) {
					const dest = await ctx.call(
						"destination.model.get",
						{ id: destinationId },
						{ meta: ctx.meta }
					).catch(() => null);

					if (!dest) {
						throw new MoleculerClientError(
							"Destination not found.",
							404,
							ERROR_CODES.DESTINATION_NOT_FOUND,
							{ destinationId }
						);
					}
				}

				const customerId = ctx.meta.user.id;

				const interest = await ctx.call(
					"interest.model.create",
					{
						customerId,
						tourPackageId,
						destinationId,
						preferredDates,
						groupSize,
						contactPreference,
						notes,
						status: INTEREST_STATUSES.ACTIVE,
					},
					{ meta: ctx.meta }
				);

				// Emit submitted event
				this.broker.emit("interest.submitted", { interest });

				// Check threshold for tourPackageId
				if (tourPackageId) {
					const activeInterests = await ctx.call(
						"interest.model.find",
						{ query: { tourPackageId, status: INTEREST_STATUSES.ACTIVE } },
						{ meta: ctx.meta }
					);

					if (activeInterests && activeInterests.length >= INTEREST_THRESHOLD) {
						this.broker.emit("interest.thresholdReached", {
							tourPackageId,
							count: activeInterests.length,
						});
					}
				}

				return interest;
			},
		},

		/**
		 * List interests for the current authenticated customer.
		 * Requires authentication.
		 */
		listMine: {
			auth: "required",
			async handler(ctx) {
				const customerId = ctx.meta.user.id;

				return ctx.call(
					"interest.model.find",
					{ query: { customerId } },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * List all interests with filters (admin/staff).
		 * Requires staff role.
		 */
		list: {
			auth: "required",
			role: "staff",
			params: {
				tourPackageId: "string|optional",
				destinationId: "string|optional",
				status: "string|optional",
				page: { type: "number", integer: true, positive: true, optional: true, convert: true },
				pageSize: { type: "number", integer: true, positive: true, optional: true, convert: true },
			},
			async handler(ctx) {
				const { tourPackageId, destinationId, status, page, pageSize } = ctx.params;
				const query = {};

				if (tourPackageId) query.tourPackageId = tourPackageId;
				if (destinationId) query.destinationId = destinationId;
				if (status) query.status = status;

				const params = { query };
				if (page) params.page = page;
				if (pageSize) params.pageSize = pageSize;

				return ctx.call("interest.model.find", params, { meta: ctx.meta });
			},
		},

		/**
		 * Get count of active interests for a package or destination.
		 * Internal action (no auth).
		 */
		getInterestCount: {
			auth: undefined,
			params: {
				tourPackageId: "string|optional",
				destinationId: "string|optional",
			},
			async handler(ctx) {
				const { tourPackageId, destinationId } = ctx.params;
				const query = { status: INTEREST_STATUSES.ACTIVE };

				if (tourPackageId) query.tourPackageId = tourPackageId;
				if (destinationId) query.destinationId = destinationId;

				const results = await ctx.call(
					"interest.model.find",
					{ query },
					{ meta: ctx.meta }
				);

				return { count: results ? results.length : 0 };
			},
		},

		/**
		 * Update interest status (admin only).
		 */
		updateStatus: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
				status: {
					type: "enum",
					values: [
						INTEREST_STATUSES.ACTIVE,
						INTEREST_STATUSES.CONVERTED,
						INTEREST_STATUSES.WITHDRAWN,
						INTEREST_STATUSES.EXPIRED,
					],
				},
			},
			async handler(ctx) {
				const { id, status } = ctx.params;

				const existing = await ctx.call(
					"interest.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Interest not found.",
						404,
						ERROR_CODES.INTEREST_NOT_FOUND,
						{ id }
					);
				}

				return ctx.call(
					"interest.model.update",
					{ id, status },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Customer withdraws their own interest.
		 * Requires authentication.
		 */
		withdraw: {
			auth: "required",
			params: {
				id: "string",
			},
			async handler(ctx) {
				const { id } = ctx.params;
				const customerId = ctx.meta.user.id;

				const existing = await ctx.call(
					"interest.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Interest not found.",
						404,
						ERROR_CODES.INTEREST_NOT_FOUND,
						{ id }
					);
				}

				if (existing.customerId.toString() !== customerId.toString()) {
					throw new MoleculerClientError(
						"You can only withdraw your own interest.",
						403,
						ERROR_CODES.FORBIDDEN,
						{ id }
					);
				}

				return ctx.call(
					"interest.model.update",
					{ id, status: INTEREST_STATUSES.WITHDRAWN },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Convert active interests for a package into bulk invitations (admin).
		 * Requires admin role.
		 */
		convertToBulkInvitation: {
			auth: "required",
			role: "admin",
			params: {
				tourPackageId: "string",
			},
			async handler(ctx) {
				const { tourPackageId } = ctx.params;

				const activeInterests = await ctx.call(
					"interest.model.find",
					{ query: { tourPackageId, status: INTEREST_STATUSES.ACTIVE } },
					{ meta: ctx.meta }
				);

				const now = new Date();

				for (const interest of activeInterests) {
					this.broker.emit("interest.bulkInvitationSent", {
						interestId: interest._id,
						customerId: interest.customerId,
						tourPackageId,
					});

					await ctx.call(
						"interest.model.update",
						{ id: interest._id.toString(), notifiedAt: now },
						{ meta: ctx.meta }
					);
				}

				return {
					count: activeInterests.length,
					message: `Invitations sent to ${activeInterests.length} interested customers`,
				};
			},
		},
	},

	events: {
		"interest.submitted"(payload) {
			this.logger.info("Interest submitted:", payload.interest?._id || payload);
		},
		"interest.thresholdReached"(payload) {
			this.logger.info(
				`Interest threshold reached for package ${payload.tourPackageId}: ${payload.count} active interests`
			);
		},
	},
};
