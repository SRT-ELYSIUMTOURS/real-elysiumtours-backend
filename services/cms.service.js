"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const { ERROR_CODES } = require("../utils/constants");
const { getSanityClient } = require("../utils/sanity.client");

module.exports = {
	name: "cms",

	dependencies: [],

	methods: {
		/**
		 * Get or create the Sanity client instance.
		 * @returns {Object|null} Sanity client or null if not configured.
		 */
		getClient() {
			return getSanityClient();
		},

		/**
		 * Execute a GROQ query against Sanity with error handling.
		 * @param {string} groqQuery - The GROQ query string.
		 * @param {Object} params - Query parameters.
		 * @returns {Promise<*>} Query result.
		 */
		async query(groqQuery, params = {}) {
			const client = this.getClient();
			if (!client) {
				return null;
			}

			try {
				return await client.fetch(groqQuery, params);
			} catch (err) {
				this.logger.error("Sanity query failed:", err.message);
				throw new MoleculerClientError(
					"Failed to fetch content from CMS.",
					502,
					ERROR_CODES.INTERNAL_ERROR,
					{ detail: err.message }
				);
			}
		},
	},

	actions: {
		/**
		 * List blog posts with optional filtering and pagination.
		 * Public action.
		 */
		listBlogPosts: {
			auth: undefined,
			params: {
				category: "string|optional",
				page: { type: "number", optional: true, convert: true },
				pageSize: { type: "number", optional: true, convert: true },
				featured: "boolean|optional",
			},
			async handler(ctx) {
				const { category, page = 1, pageSize = 10, featured } = ctx.params;

				const client = this.getClient();
				if (!client) {
					return {
						posts: [],
						total: 0,
						page,
						pageSize,
						message: "CMS not configured. Set SANITY_PROJECT_ID in environment.",
					};
				}

				const filters = ['_type == "post"'];
				const queryParams = {};

				if (category) {
					filters.push("category == $category");
					queryParams.category = category;
				}
				if (typeof featured === "boolean") {
					filters.push("featured == $featured");
					queryParams.featured = featured;
				}

				const filterStr = filters.join(" && ");
				const start = (page - 1) * pageSize;
				const end = start + pageSize;
				queryParams.start = start;
				queryParams.end = end;

				const postsQuery = `*[${filterStr}] | order(publishedAt desc) [$start...$end] {
					_id, title, slug, excerpt, publishedAt, category, featured,
					"author": author->{ name, image },
					"mainImage": mainImage.asset->url,
					body
				}`;

				const countQuery = `count(*[${filterStr}])`;

				const [posts, total] = await Promise.all([
					this.query(postsQuery, queryParams),
					this.query(countQuery, queryParams),
				]);

				return {
					posts: posts || [],
					total: total || 0,
					page,
					pageSize,
				};
			},
		},

		/**
		 * Get a single blog post by slug.
		 * Public action.
		 */
		getBlogPost: {
			auth: undefined,
			params: {
				slug: "string",
			},
			async handler(ctx) {
				const { slug } = ctx.params;

				const client = this.getClient();
				if (!client) {
					throw new MoleculerClientError(
						"CMS not configured. Set SANITY_PROJECT_ID in environment.",
						503,
						ERROR_CODES.INTERNAL_ERROR
					);
				}

				const query = `*[_type == "post" && slug.current == $slug][0] {
					_id, title, slug, excerpt, publishedAt, category, featured,
					"author": author->{ name, image },
					"mainImage": mainImage.asset->url,
					body
				}`;

				const post = await this.query(query, { slug });

				if (!post) {
					throw new MoleculerClientError(
						"Blog post not found.",
						404,
						ERROR_CODES.NOT_FOUND,
						{ slug }
					);
				}

				return post;
			},
		},

		/**
		 * List FAQs with optional category filter.
		 * Public action.
		 */
		listFAQs: {
			auth: undefined,
			params: {
				category: "string|optional",
			},
			async handler(ctx) {
				const { category } = ctx.params;

				const client = this.getClient();
				if (!client) {
					return {
						faqs: [],
						message: "CMS not configured. Set SANITY_PROJECT_ID in environment.",
					};
				}

				const filters = ['_type == "faq"'];
				const queryParams = {};

				if (category) {
					filters.push("category == $category");
					queryParams.category = category;
				}

				const filterStr = filters.join(" && ");
				const query = `*[${filterStr}] | order(order asc) { _id, question, answer, category }`;

				const faqs = await this.query(query, queryParams);

				return { faqs: faqs || [] };
			},
		},

		/**
		 * List testimonials.
		 * Public action.
		 */
		listTestimonials: {
			auth: undefined,
			params: {
				limit: { type: "number", optional: true, convert: true },
			},
			async handler(ctx) {
				const { limit = 10 } = ctx.params;

				const client = this.getClient();
				if (!client) {
					return {
						testimonials: [],
						message: "CMS not configured. Set SANITY_PROJECT_ID in environment.",
					};
				}

				const query = `*[_type == "testimonial"] | order(_createdAt desc) [0...$limit] {
					_id, name, location, quote, rating,
					"image": image.asset->url
				}`;

				const testimonials = await this.query(query, { limit });

				return { testimonials: testimonials || [] };
			},
		},

		/**
		 * List gallery items with optional filtering and pagination.
		 * Public action.
		 */
		listGallery: {
			auth: undefined,
			params: {
				category: "string|optional",
				page: { type: "number", optional: true, convert: true },
				pageSize: { type: "number", optional: true, convert: true },
			},
			async handler(ctx) {
				const { category, page = 1, pageSize = 20 } = ctx.params;

				const client = this.getClient();
				if (!client) {
					return {
						items: [],
						total: 0,
						page,
						pageSize,
						message: "CMS not configured. Set SANITY_PROJECT_ID in environment.",
					};
				}

				const filters = ['(_type == "gallery" || _type == "galleryImage")'];
				const queryParams = {};

				if (category) {
					filters.push("category == $category");
					queryParams.category = category;
				}

				const filterStr = filters.join(" && ");
				const start = (page - 1) * pageSize;
				const end = start + pageSize;
				queryParams.start = start;
				queryParams.end = end;

				const itemsQuery = `*[${filterStr}] | order(_createdAt desc) [$start...$end] {
					_id, title, caption, category,
					"imageUrl": image.asset->url
				}`;

				const countQuery = `count(*[${filterStr}])`;

				const [items, total] = await Promise.all([
					this.query(itemsQuery, queryParams),
					this.query(countQuery, queryParams),
				]);

				return {
					items: items || [],
					total: total || 0,
					page,
					pageSize,
				};
			},
		},

		/**
		 * Get about page content.
		 * Public action.
		 */
		getAboutContent: {
			auth: undefined,
			async handler() {
				const client = this.getClient();
				if (!client) {
					return {
						content: null,
						message: "CMS not configured. Set SANITY_PROJECT_ID in environment.",
					};
				}

				const query = '*[_type == "about"][0]';
				const content = await this.query(query);

				return { content: content || null };
			},
		},

		/**
		 * Get site-wide settings (logo, social links, footer text, etc.).
		 * Public action.
		 */
		getSiteSettings: {
			auth: undefined,
			async handler() {
				const client = this.getClient();
				if (!client) {
					return {
						settings: null,
						message: "CMS not configured. Set SANITY_PROJECT_ID in environment.",
					};
				}

				const query = '*[_type == "siteSettings"][0]';
				const settings = await this.query(query);

				return { settings: settings || null };
			},
		},
	},

	events: {},

	started() {
		const client = this.getClient();
		if (client) {
			this.logger.info("CMS service connected to Sanity CMS.");
		} else {
			this.logger.warn("CMS service started WITHOUT Sanity connection — CMS features disabled.");
		}
	},
};
