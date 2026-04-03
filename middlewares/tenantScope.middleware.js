"use strict";

const { MoleculerClientError } = require("moleculer").Errors;

/**
 * Tenant Scope Middleware
 *
 * Handles multi-tenancy at the middleware level so individual services
 * don't need to manually filter by organizationId.
 *
 * Two hooks:
 * 1. localAction — validates tenant context on incoming API requests
 * 2. call — auto-injects organizationId into model service queries/creates
 *    so data is automatically scoped to the user's org
 *
 * Super admins bypass all scoping — they see global data.
 */
module.exports = {
	name: "TenantScope",

	// ─── Hook 1: Validate tenant context on incoming actions ───
	localAction(handler, action) {
		return async function tenantScopeHandler(ctx) {
			// Extract organizationId from meta (set by JWT decode in authenticate())
			const orgId = ctx.meta.organizationId
				|| (ctx.meta.user && ctx.meta.user.organizationId)
				|| null;

			// Normalize — always set on meta as string for downstream use
			if (orgId) {
				ctx.meta.organizationId = typeof orgId === "object" ? orgId.toString() : orgId;
			}

			// Super admins bypass all tenant requirements
			if (ctx.meta.user && ctx.meta.user.role === "super_admin") {
				return handler(ctx);
			}

			// Check if tenant context is required (v2 routes set this)
			const tenantRequired = action.tenantRequired === true || ctx.meta.tenantRequired === true;
			if (tenantRequired && !orgId) {
				throw new MoleculerClientError(
					"Organization context required. Use v2 API with organization-scoped authentication.",
					400,
					"ORGANIZATION_REQUIRED"
				);
			}

			return handler(ctx);
		};
	},

	// ─── Hook 2: Auto-inject org scoping into model service calls ───
	call(next) {
		return function tenantScopeCall(actionName, params, opts) {
			// actionName may be a string or an object — only process strings
			if (typeof actionName !== "string" || !actionName.includes(".model.")) {
				return next(actionName, params, opts);
			}

			// Get organizationId from the call's meta
			const meta = opts && opts.meta ? opts.meta : (this && this.meta ? this.meta : null);
			const orgId = meta && meta.organizationId;

			// Super admins bypass scoping
			if (meta && meta.user && meta.user.role === "super_admin") {
				return next(actionName, params, opts);
			}

			// No orgId means v1 route or unauthenticated — don't scope
			if (!orgId) {
				return next(actionName, params, opts);
			}

			const orgIdStr = typeof orgId === "object" ? orgId.toString() : orgId;

			// Auto-scope model.find / model.list calls
			if (actionName.endsWith(".find") || actionName.endsWith(".list")) {
				if (params && params.query && typeof params.query === "object") {
					params.query.organizationId = orgIdStr;
				} else if (params && !params.query) {
					// Some calls pass query at top level
					params.query = { organizationId: orgIdStr };
				}
			}

			// Auto-scope model.count calls
			if (actionName.endsWith(".count")) {
				if (params && params.query && typeof params.query === "object") {
					params.query.organizationId = orgIdStr;
				}
			}

			// Auto-stamp model.create calls with organizationId
			if (actionName.endsWith(".create")) {
				if (params && typeof params === "object") {
					params.organizationId = orgIdStr;
				}
			}

			return next(actionName, params, opts);
		};
	},
};
