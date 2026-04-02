"use strict";

const { MoleculerClientError } = require("moleculer").Errors;

module.exports = {
	name: "TenantScope",

	localAction(handler, action) {
		return async function tenantScopeHandler(ctx) {
			// Extract organizationId from meta (set by JWT decode in authenticate())
			const orgId = ctx.meta.organizationId
				|| (ctx.meta.user && ctx.meta.user.organizationId)
				|| null;

			// Set on meta for downstream use
			if (orgId) {
				ctx.meta.organizationId = orgId;
			}

			// Check if tenant context is required:
			// - action.tenantRequired (set at action definition)
			// - ctx.meta.tenantRequired (set by v2 route onBeforeCall)
			const tenantRequired = action.tenantRequired === true || ctx.meta.tenantRequired === true;
			if (tenantRequired) {
				if (!orgId) {
					throw new MoleculerClientError(
						"Organization context required. Use v2 API with organization-scoped authentication.",
						400,
						"ORGANIZATION_REQUIRED"
					);
				}
			}

			// For super_admin role: allow cross-org access
			// They can optionally scope to a specific org via header/meta
			if (ctx.meta.user && ctx.meta.user.role === "super_admin") {
				// Super admin can access any org or no org
				// Don't enforce org scoping for super admins
			}

			return handler(ctx);
		};
	},
};
