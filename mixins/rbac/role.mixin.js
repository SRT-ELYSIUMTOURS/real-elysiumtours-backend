"use strict";

const { USER_ROLES } = require("../../utils/constants");

/**
 * Role mixin — adds role-related helper methods to any service.
 */
module.exports = {
	methods: {
		/**
		 * Validate that a role name exists in the USER_ROLES enum.
		 *
		 * @param {String} roleName - The role name to validate
		 * @returns {Boolean} true if valid
		 */
		validateRole(roleName) {
			const validRoles = Object.values(USER_ROLES);
			return validRoles.includes(roleName);
		},

		/**
		 * Return the default role name for new users.
		 *
		 * @returns {String} The default role name ("customer")
		 */
		getDefaultRole() {
			return USER_ROLES.CUSTOMER;
		},
	},
};
