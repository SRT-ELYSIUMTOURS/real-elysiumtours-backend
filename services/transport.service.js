"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const { ERROR_CODES } = require("../utils/constants");

module.exports = {
	name: "transport",

	dependencies: ["transportProvider.model", "vehicle.model"],

	actions: {
		/**
		 * List all active transport providers.
		 * Public action.
		 */
		listProviders: {
			auth: undefined,
			params: {
				page: "number|integer|positive|optional",
				pageSize: "number|integer|positive|optional",
			},
			async handler(ctx) {
				const { page, pageSize } = ctx.params;
				const params = { query: { isActive: true } };
				if (page) params.page = page;
				if (pageSize) params.pageSize = pageSize;

				return ctx.call("transportProvider.model.find", params, { meta: ctx.meta });
			},
		},

		/**
		 * Get a single transport provider by ID.
		 * Public action.
		 */
		getProvider: {
			auth: undefined,
			params: {
				id: "string",
			},
			async handler(ctx) {
				const provider = await ctx.call(
					"transportProvider.model.get",
					{ id: ctx.params.id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!provider) {
					throw new MoleculerClientError(
						"Transport provider not found.",
						404,
						ERROR_CODES.PARTNER_NOT_FOUND,
						{ id: ctx.params.id }
					);
				}

				return provider;
			},
		},

		/**
		 * Register a new transport provider.
		 * Requires admin role.
		 */
		registerProvider: {
			auth: "required",
			role: "admin",
			params: {
				companyName: "string",
				contactPerson: "string|optional",
				phone: "string|optional",
				email: "string|optional",
				commissionRate: "number|optional",
			},
			async handler(ctx) {
				return ctx.call(
					"transportProvider.model.create",
					ctx.params,
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Update a transport provider.
		 * Requires admin role.
		 */
		updateProvider: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
				companyName: "string|optional",
				contactPerson: "string|optional",
				phone: "string|optional",
				email: "string|optional",
				commissionRate: "number|optional",
				isActive: "boolean|optional",
			},
			async handler(ctx) {
				const { id, ...updateFields } = ctx.params;

				const existing = await ctx.call(
					"transportProvider.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Transport provider not found.",
						404,
						ERROR_CODES.PARTNER_NOT_FOUND,
						{ id }
					);
				}

				return ctx.call(
					"transportProvider.model.update",
					{ id, ...updateFields },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * List vehicles with optional filters.
		 * Public action.
		 */
		listVehicles: {
			auth: undefined,
			params: {
				providerId: "string|optional",
				type: "string|optional",
				minCapacity: "number|optional",
				page: "number|integer|positive|optional",
				pageSize: "number|integer|positive|optional",
			},
			async handler(ctx) {
				const { providerId, type, minCapacity, page, pageSize } = ctx.params;
				const query = { isAvailable: true };

				if (providerId) query.providerId = providerId;
				if (type) query.type = type;
				if (minCapacity) query.capacity = { $gte: minCapacity };

				const params = { query };
				if (page) params.page = page;
				if (pageSize) params.pageSize = pageSize;

				return ctx.call("vehicle.model.find", params, { meta: ctx.meta });
			},
		},

		/**
		 * Add a vehicle to a transport provider.
		 * Requires admin role.
		 */
		addVehicle: {
			auth: "required",
			role: "admin",
			params: {
				providerId: "string",
				type: "string",
				capacity: "number",
				basePricePerDay: "number",
				description: "string|optional",
			},
			async handler(ctx) {
				const { providerId, ...rest } = ctx.params;

				// Validate provider exists
				const provider = await ctx.call(
					"transportProvider.model.get",
					{ id: providerId },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!provider) {
					throw new MoleculerClientError(
						"Transport provider not found.",
						404,
						ERROR_CODES.PARTNER_NOT_FOUND,
						{ providerId }
					);
				}

				return ctx.call(
					"vehicle.model.create",
					{ providerId, ...rest },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Update a vehicle.
		 * Requires admin role.
		 */
		updateVehicle: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
				providerId: "string|optional",
				type: "string|optional",
				capacity: "number|optional",
				basePricePerDay: "number|optional",
				description: "string|optional",
				isAvailable: "boolean|optional",
			},
			async handler(ctx) {
				const { id, ...updateFields } = ctx.params;

				const existing = await ctx.call(
					"vehicle.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Vehicle not found.",
						404,
						ERROR_CODES.NOT_FOUND,
						{ id }
					);
				}

				return ctx.call(
					"vehicle.model.update",
					{ id, ...updateFields },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Estimate transport cost based on group size and days.
		 * Public action.
		 */
		estimateTransportCost: {
			auth: undefined,
			params: {
				groupSize: "number|integer|positive",
				days: "number|integer|positive",
			},
			async handler(ctx) {
				const { groupSize, days } = ctx.params;

				// Find a suitable vehicle by capacity (smallest that fits the group)
				const vehicles = await ctx.call(
					"vehicle.model.find",
					{
						query: {
							isAvailable: true,
							capacity: { $gte: groupSize },
						},
						sort: "capacity",
					},
					{ meta: ctx.meta }
				);

				if (!vehicles || vehicles.length === 0) {
					throw new MoleculerClientError(
						"No suitable vehicle available for this group size.",
						404,
						ERROR_CODES.INVENTORY_UNAVAILABLE,
						{ groupSize }
					);
				}

				const vehicle = vehicles[0];
				const totalCost = vehicle.basePricePerDay * days;

				return {
					vehicle: {
						id: vehicle._id,
						type: vehicle.type,
						capacity: vehicle.capacity,
						basePricePerDay: vehicle.basePricePerDay,
					},
					days,
					groupSize,
					totalCost,
				};
			},
		},

		/**
		 * Toggle the isActive field of a transport provider.
		 * Requires admin role.
		 */
		toggleProviderActive: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
			},
			async handler(ctx) {
				const { id } = ctx.params;

				const existing = await ctx.call(
					"transportProvider.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Transport provider not found.",
						404,
						ERROR_CODES.PARTNER_NOT_FOUND,
						{ id }
					);
				}

				return ctx.call(
					"transportProvider.model.update",
					{ id, isActive: !existing.isActive },
					{ meta: ctx.meta }
				);
			},
		},
	},
};
