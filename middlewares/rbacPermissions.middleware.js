"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const { ERROR_CODES } = require("../utils/constants");

module.exports = {
	name: "RbacPermissions",

	localAction(handler, action) {
		// If auth is undefined or not set, treat as public route — pass through
		if (action.auth === undefined || action.auth === null) {
			return handler;
		}

		if (action.auth === "required") {
			return async function rbacPermissionsHandler(ctx) {
				// 1. Check that user is authenticated
				if (!ctx.meta.user) {
					throw new MoleculerClientError(
						"Authentication required.",
						401,
						ERROR_CODES.UNAUTHORIZED
					);
				}

				// 2. If the action specifies a role, enforce it
				if (action.role) {
					const userRole = ctx.meta.user.role;

					// super_admin has access to everything
					if (userRole === "super_admin") {
						return handler(ctx);
					}

					switch (action.role) {
					case "super_admin":
						// Only super_admin can access super_admin actions
						throw new MoleculerClientError(
							"Super admin access required.",
							403,
							ERROR_CODES.FORBIDDEN
						);

					case "admin":
						if (userRole !== "admin") {
							throw new MoleculerClientError(
								"Admin access required.",
								403,
								ERROR_CODES.FORBIDDEN
							);
						}
						break;

					case "staff":
						// Admin inherits staff privileges
						if (userRole !== "staff" && userRole !== "admin") {
							throw new MoleculerClientError(
								"Staff access required.",
								403,
								ERROR_CODES.FORBIDDEN
							);
						}
						break;

					default:
						throw new MoleculerClientError(
							`Unknown role requirement: "${action.role}"`,
							403,
							ERROR_CODES.FORBIDDEN
						);
					}
				}

				// 3. All checks passed — continue to the handler
				return handler(ctx);
			};
		}

		// For any other auth value, pass through
		return handler;
	},
};
