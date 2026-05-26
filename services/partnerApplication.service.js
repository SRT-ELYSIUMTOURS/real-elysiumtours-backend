"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const { ERROR_CODES } = require("../utils/constants");

module.exports = {
	name: "partnerApplication",

	dependencies: ["partnerApplication.model"],

	actions: {
		/**
		 * Submit a new partner application.
		 * Public — no auth required.
		 */
		submit: {
			auth: undefined,
			params: {
				partnerType: "string",
				businessName: "string",
				country: "string",
				yearsOperating: "string",
				monthlyCapacity: "string",
				website: "string|optional",
				registrationNumber: "string|optional",
				servicesDescription: "string",
				firstName: "string",
				lastName: "string",
				businessEmail: "string",
				phone: "string",
				roleTitle: "string|optional",
				preferredContact: "string|optional",
			},
			async handler(ctx) {
				const {
					partnerType, businessName, country, yearsOperating, monthlyCapacity,
					website, registrationNumber, servicesDescription,
					firstName, lastName, businessEmail, phone, roleTitle, preferredContact,
				} = ctx.params;

				const application = await ctx.call(
					"partnerApplication.model.create",
					{
						partnerType,
						businessName,
						country,
						yearsOperating,
						monthlyCapacity,
						website,
						registrationNumber,
						servicesDescription,
						firstName,
						lastName,
						businessEmail,
						phone,
						roleTitle,
						preferredContact,
						status: "pending",
					},
					{ meta: ctx.meta }
				);

				this.broker.emit("partnerApplication.submitted", { application });
				return { success: true, id: application._id };
			},
		},

		/**
		 * List partner applications.
		 * Admin only.
		 */
		list: {
			auth: "required",
			role: "admin",
			params: {
				status: "string|optional",
				page: { type: "number", integer: true, positive: true, optional: true, convert: true },
				pageSize: { type: "number", integer: true, positive: true, optional: true, convert: true },
			},
			async handler(ctx) {
				const { status, page, pageSize } = ctx.params;
				const query = {};
				if (status) query.status = status;

				const params = { query, sort: "-createdAt" };
				if (page) params.page = page;
				if (pageSize) params.pageSize = pageSize;

				return ctx.call("partnerApplication.model.find", params, { meta: ctx.meta });
			},
		},

		/**
		 * Update application status (review, approve, reject).
		 * Admin only.
		 */
		updateStatus: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
				status: { type: "enum", values: ["pending", "reviewed", "approved", "rejected"] },
			},
			async handler(ctx) {
				const { id, status } = ctx.params;

				const existing = await ctx.call(
					"partnerApplication.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Partner application not found.",
						404,
						ERROR_CODES.NOT_FOUND,
						{ id }
					);
				}

				return ctx.call(
					"partnerApplication.model.update",
					{ id, status },
					{ meta: ctx.meta }
				);
			},
		},
	},

	events: {
		"partnerApplication.submitted"({ application }) {
			this.logger.info(`New partner application from ${application?.businessEmail}`);
		},
	},
};
