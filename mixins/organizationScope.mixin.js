"use strict";

module.exports = {
	methods: {
		/**
		 * Get the organizationId from context meta.
		 * Returns null if not in a multi-tenant context (v1 routes).
		 */
		getOrgId(ctx) {
			return ctx.meta.organizationId || null;
		},

		/**
		 * Add organizationId to a query filter object.
		 * Only adds it if we're in a multi-tenant context (orgId exists).
		 * For v1 routes (no orgId), returns the query unchanged.
		 */
		scopeQuery(ctx, query = {}) {
			const orgId = this.getOrgId(ctx);
			if (orgId) {
				return { ...query, organizationId: orgId };
			}
			return query;
		},

		/**
		 * Add organizationId to a create/update data object.
		 * Only adds it if we're in a multi-tenant context.
		 */
		scopeData(ctx, data = {}) {
			const orgId = this.getOrgId(ctx);
			if (orgId) {
				return { ...data, organizationId: orgId };
			}
			return data;
		},

		/**
		 * Validate that a record belongs to the current organization.
		 * For v1 routes (no orgId), always returns true.
		 * For v2 routes, checks record.organizationId matches ctx.meta.organizationId.
		 * Super admins bypass this check.
		 */
		validateOrgOwnership(ctx, record) {
			if (!record) return false;
			const orgId = this.getOrgId(ctx);
			if (!orgId) return true; // v1 route, no org scoping
			if (ctx.meta.user && ctx.meta.user.role === "super_admin") return true;

			const recordOrgId = record.organizationId
				? record.organizationId.toString()
				: null;
			return recordOrgId === orgId.toString();
		},

		/**
		 * Throw if record doesn't belong to current org.
		 */
		assertOrgOwnership(ctx, record, entityName = "Record") {
			if (!this.validateOrgOwnership(ctx, record)) {
				const { MoleculerClientError } = require("moleculer").Errors;
				throw new MoleculerClientError(
					`${entityName} not found.`,
					404,
					"NOT_FOUND"
				);
			}
		},
	},
};
