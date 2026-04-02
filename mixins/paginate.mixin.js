"use strict";

module.exports = {
	methods: {
		/**
		 * Build a paginated query params object for moleculer-db
		 * @param {Object} params - { page, pageSize, sort, query }
		 * @returns {Object} - { offset, limit, sort, query }
		 */
		buildPaginationParams(params = {}) {
			const page = Math.max(1, parseInt(params.page) || 1);
			const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize) || 10));
			const offset = (page - 1) * pageSize;

			return {
				offset,
				limit: pageSize,
				page,
				pageSize,
				sort: params.sort || "-createdAt",
			};
		},

		/**
		 * Format paginated response
		 * @param {Array} rows - Result rows
		 * @param {Number} total - Total count
		 * @param {Number} page - Current page
		 * @param {Number} pageSize - Page size
		 * @returns {Object}
		 */
		formatPaginatedResponse(rows, total, page, pageSize) {
			return {
				rows,
				total,
				page,
				pageSize,
				totalPages: Math.ceil(total / pageSize),
				hasMore: page * pageSize < total,
			};
		},
	},
};
