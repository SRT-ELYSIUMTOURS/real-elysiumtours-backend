"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const { ERROR_CODES } = require("../../utils/constants");

/**
 * Permission mixin — adds permission-checking helpers to any service.
 */
module.exports = {
	methods: {
		/**
		 * Check if the current user has a specific permission.
		 *
		 * @param {Context} ctx - Moleculer request context
		 * @param {String} permissionName - Permission name to check
		 * @returns {Promise<Boolean>}
		 */
		async hasPermission(ctx, permissionName) {
			if (!ctx.meta.user || !ctx.meta.user.id) {
				return false;
			}

			return ctx.call("rbac.checkAccess", {
				userId: ctx.meta.user.id,
				permission: permissionName,
			});
		},

		/**
		 * Require that the current user has a specific permission.
		 * Throws FORBIDDEN if the user lacks the permission.
		 *
		 * @param {Context} ctx - Moleculer request context
		 * @param {String} permissionName - Permission name to require
		 * @throws {MoleculerClientError} 403 FORBIDDEN
		 */
		async requirePermission(ctx, permissionName) {
			const allowed = await this.hasPermission(ctx, permissionName);
			if (!allowed) {
				throw new MoleculerClientError(
					`Forbidden — missing permission: "${permissionName}"`,
					403,
					ERROR_CODES.FORBIDDEN
				);
			}
		},
	},
};
