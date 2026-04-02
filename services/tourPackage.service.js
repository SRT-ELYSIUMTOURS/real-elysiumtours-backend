"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const { ERROR_CODES, SELLING_MODES } = require("../utils/constants");
const { generateSlug } = require("../utils/slug.utils");

module.exports = {
	name: "tourPackage",

	dependencies: [
		"tourPackage.model",
		"packagePricing.model",
		"destination.model",
		"hotelPartner.model",
		"attraction.model",
		"review.model",
		"waitlistEntry.model",
	],

	actions: {
		/**
		 * Search tour packages using text search with optional filters.
		 * Public action.
		 */
		search: {
			auth: undefined,
			params: {
				query: "string",
				destinationId: "string|optional",
				minPrice: "number|optional",
				maxPrice: "number|optional",
				minGroupSize: "number|optional",
				sellingMode: "string|optional",
				sortBy: { type: "enum", values: ["relevance", "price_low", "price_high", "rating", "popularity", "newest"], optional: true, default: "relevance" },
				page: { type: "number", optional: true, default: 1 },
				pageSize: { type: "number", optional: true, default: 10 },
			},
			async handler(ctx) {
				const {
					query,
					destinationId,
					minPrice,
					maxPrice,
					minGroupSize,
					sellingMode,
					sortBy = "relevance",
					page = 1,
					pageSize = 10,
				} = ctx.params;

				const filter = {
					isActive: true,
					status: "published",
				};

				if (query) {
					filter.$text = { $search: query };
				}
				if (destinationId) {
					filter.destinationId = destinationId;
				}
				if (sellingMode) {
					filter.sellingMode = sellingMode;
				}

				const packages = await ctx.call(
					"tourPackage.model.find",
					{ query: filter },
					{ meta: ctx.meta }
				);

				// Filter by price range if provided
				let results = packages;
				if (minPrice !== undefined || maxPrice !== undefined) {
					results = [];
					for (const pkg of packages) {
						const pricingTiers = await ctx.call(
							"packagePricing.model.find",
							{ query: { packageId: pkg._id.toString(), isActive: true } },
							{ meta: ctx.meta }
						);

						if (pricingTiers.length === 0) continue;

						const lowestPrice = Math.min(
							...pricingTiers.map((t) => t.pricePerPerson)
						);

						if (minPrice !== undefined && lowestPrice < minPrice) continue;
						if (maxPrice !== undefined && lowestPrice > maxPrice) continue;

						results.push({ ...pkg, pricingTiers });
					}
				}

				// Apply sorting (non-relevance modes)
				if (sortBy && sortBy !== "relevance") {
					results = await this.applySortBy(ctx, results, sortBy);
				}

				// Paginate
				const total = results.length;
				const offset = (page - 1) * pageSize;
				const paginatedResults = results.slice(offset, offset + pageSize);

				return {
					results: paginatedResults,
					total,
					page,
					pageSize,
					query,
					sortBy,
				};
			},
		},

		/**
		 * List tour packages with optional filters.
		 * Public action.
		 */
		list: {
			auth: undefined,
			params: {
				destinationId: "string|optional",
				isActive: "boolean|optional",
				status: "string|optional",
				sellingMode: "string|optional",
				page: "number|integer|positive|optional",
				pageSize: "number|integer|positive|optional",
			},
			async handler(ctx) {
				const { destinationId, isActive, status, sellingMode, page, pageSize } = ctx.params;
				const query = {};

				if (destinationId) query.destinationId = destinationId;
				if (typeof isActive === "boolean") query.isActive = isActive;
				if (status) query.status = status;
				if (sellingMode) query.sellingMode = sellingMode;

				// Non-admin users only see active + published packages
				const isAdmin = ctx.meta && ctx.meta.user && ctx.meta.user.role === "admin";
				if (!isAdmin) {
					query.isActive = true;
					query.status = "published";
				}

				const params = { query };
				if (page) params.page = page;
				if (pageSize) params.pageSize = pageSize;

				const packages = await ctx.call("tourPackage.model.find", params, { meta: ctx.meta });

				// Attach pricing tiers to each package
				const results = await Promise.all(
					packages.map(async (pkg) => {
						const pricingTiers = await ctx.call(
							"packagePricing.model.find",
							{ query: { packageId: pkg._id.toString(), isActive: true } },
							{ meta: ctx.meta }
						);
						return { ...pkg, pricingTiers };
					})
				);

				return results;
			},
		},

		/**
		 * Get a single tour package by ID.
		 * Public action.
		 */
		get: {
			auth: undefined,
			params: {
				id: "string",
			},
			async handler(ctx) {
				const pkg = await ctx.call(
					"tourPackage.model.get",
					{ id: ctx.params.id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!pkg) {
					throw new MoleculerClientError(
						"Tour package not found.",
						404,
						ERROR_CODES.PACKAGE_NOT_FOUND,
						{ id: ctx.params.id }
					);
				}

				// Attach pricing tiers
				const pricingTiers = await ctx.call(
					"packagePricing.model.find",
					{ query: { packageId: pkg._id.toString(), isActive: true } },
					{ meta: ctx.meta }
				);

				// Populate destination details
				const destination = await ctx.call(
					"destination.model.get",
					{ id: pkg.destinationId.toString() },
					{ meta: ctx.meta }
				).catch(() => null);

				return { ...pkg, pricingTiers, destination };
			},
		},

		/**
		 * Get a tour package by slug.
		 * Public action.
		 */
		getBySlug: {
			auth: undefined,
			params: {
				slug: "string",
			},
			async handler(ctx) {
				const results = await ctx.call(
					"tourPackage.model.find",
					{ query: { slug: ctx.params.slug } },
					{ meta: ctx.meta }
				);

				if (!results || results.length === 0) {
					throw new MoleculerClientError(
						"Tour package not found.",
						404,
						ERROR_CODES.PACKAGE_NOT_FOUND,
						{ slug: ctx.params.slug }
					);
				}

				const pkg = results[0];

				// Attach pricing tiers
				const pricingTiers = await ctx.call(
					"packagePricing.model.find",
					{ query: { packageId: pkg._id.toString(), isActive: true } },
					{ meta: ctx.meta }
				);

				// Populate destination details
				const destination = await ctx.call(
					"destination.model.get",
					{ id: pkg.destinationId.toString() },
					{ meta: ctx.meta }
				).catch(() => null);

				return { ...pkg, pricingTiers, destination };
			},
		},

		/**
		 * Create a new tour package.
		 * Requires admin role.
		 */
		create: {
			auth: "required",
			role: "admin",
			params: {
				title: "string",
				description: "string|optional",
				destinationId: "string",
				hotelPartnerId: "string|optional",
				attractionIds: "array|optional",
				diningIds: "array|optional",
				transportType: "string|optional",
				sellingMode: "string|optional",
				totalCapacity: "number|optional",
				durationDays: "number|integer|positive",
				images: "array|optional",
				highlights: "array|optional",
				inclusions: "array|optional",
				exclusions: "array|optional",
				itinerary: "array|optional",
				startDate: "string|optional",
				endDate: "string|optional",
				pricingTiers: "array|optional",
			},
			async handler(ctx) {
				const {
					title,
					description,
					destinationId,
					hotelPartnerId,
					attractionIds,
					diningIds,
					transportType,
					sellingMode,
					totalCapacity,
					durationDays,
					images,
					highlights,
					inclusions,
					exclusions,
					itinerary,
					startDate,
					endDate,
					pricingTiers,
				} = ctx.params;

				// Validate destinationId exists
				const destination = await ctx.call(
					"destination.model.get",
					{ id: destinationId },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!destination) {
					throw new MoleculerClientError(
						"Destination not found.",
						404,
						ERROR_CODES.DESTINATION_NOT_FOUND,
						{ destinationId }
					);
				}

				// Validate hotelPartnerId if provided
				if (hotelPartnerId) {
					const hotel = await ctx.call(
						"hotelPartner.model.get",
						{ id: hotelPartnerId },
						{ meta: ctx.meta }
					).catch(() => null);

					if (!hotel) {
						throw new MoleculerClientError(
							"Hotel partner not found.",
							404,
							ERROR_CODES.PARTNER_NOT_FOUND,
							{ hotelPartnerId }
						);
					}
				}

				// Validate attractionIds if provided
				if (attractionIds && attractionIds.length > 0) {
					for (const attractionId of attractionIds) {
						const attraction = await ctx.call(
							"attraction.model.get",
							{ id: attractionId },
							{ meta: ctx.meta }
						).catch(() => null);

						if (!attraction) {
							throw new MoleculerClientError(
								"Attraction not found.",
								404,
								ERROR_CODES.NOT_FOUND,
								{ attractionId }
							);
						}
					}
				}

				// Auto-generate slug from title
				const slug = generateSlug(title);

				// Build package data
				const packageData = {
					title,
					description,
					slug,
					destinationId,
					hotelPartnerId,
					attractionIds: attractionIds || [],
					diningIds: diningIds || [],
					transportType,
					images: images || [],
					sellingMode: sellingMode || SELLING_MODES.GROUP_BUY,
					totalCapacity,
					durationDays,
					isActive: true,
					status: "draft",
					highlights: highlights || [],
					inclusions: inclusions || [],
					exclusions: exclusions || [],
					itinerary: itinerary || [],
					startDate,
					endDate,
					createdBy: ctx.meta && ctx.meta.user ? ctx.meta.user._id : undefined,
				};

				// Set remainingCapacity for individual_seats mode
				if ((sellingMode || SELLING_MODES.GROUP_BUY) === SELLING_MODES.INDIVIDUAL_SEATS && totalCapacity) {
					packageData.remainingCapacity = totalCapacity;
				}

				const tourPackage = await ctx.call(
					"tourPackage.model.create",
					packageData,
					{ meta: ctx.meta }
				);

				// Create pricing tiers if provided
				let createdTiers = [];
				if (pricingTiers && pricingTiers.length > 0) {
					createdTiers = await Promise.all(
						pricingTiers.map((tier) =>
							ctx.call(
								"packagePricing.model.create",
								{
									packageId: tourPackage._id.toString(),
									minGroupSize: tier.minGroupSize,
									maxGroupSize: tier.maxGroupSize,
									pricePerPerson: tier.pricePerPerson,
									totalPrice: tier.totalPrice,
									label: tier.label,
									isActive: true,
								},
								{ meta: ctx.meta }
							)
						)
					);
				}

				this.broker.broadcast("tourPackage.created", { tourPackage });

				return { ...tourPackage, pricingTiers: createdTiers };
			},
		},

		/**
		 * Update a tour package.
		 * Requires admin role.
		 */
		update: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
				title: "string|optional",
				description: "string|optional",
				destinationId: "string|optional",
				hotelPartnerId: "string|optional",
				attractionIds: "array|optional",
				diningIds: "array|optional",
				transportType: "string|optional",
				sellingMode: "string|optional",
				totalCapacity: "number|optional",
				durationDays: "number|integer|positive|optional",
				images: "array|optional",
				highlights: "array|optional",
				inclusions: "array|optional",
				exclusions: "array|optional",
				itinerary: "array|optional",
				startDate: "string|optional",
				endDate: "string|optional",
			},
			async handler(ctx) {
				const { id, ...updateFields } = ctx.params;

				// Verify package exists
				const existing = await ctx.call(
					"tourPackage.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Tour package not found.",
						404,
						ERROR_CODES.PACKAGE_NOT_FOUND,
						{ id }
					);
				}

				// Re-generate slug if title changes
				if (updateFields.title) {
					updateFields.slug = generateSlug(updateFields.title);
				}

				// Validate destinationId if changed
				if (updateFields.destinationId) {
					const destination = await ctx.call(
						"destination.model.get",
						{ id: updateFields.destinationId },
						{ meta: ctx.meta }
					).catch(() => null);

					if (!destination) {
						throw new MoleculerClientError(
							"Destination not found.",
							404,
							ERROR_CODES.DESTINATION_NOT_FOUND,
							{ destinationId: updateFields.destinationId }
						);
					}
				}

				// Validate hotelPartnerId if changed
				if (updateFields.hotelPartnerId) {
					const hotel = await ctx.call(
						"hotelPartner.model.get",
						{ id: updateFields.hotelPartnerId },
						{ meta: ctx.meta }
					).catch(() => null);

					if (!hotel) {
						throw new MoleculerClientError(
							"Hotel partner not found.",
							404,
							ERROR_CODES.PARTNER_NOT_FOUND,
							{ hotelPartnerId: updateFields.hotelPartnerId }
						);
					}
				}

				return ctx.call(
					"tourPackage.model.update",
					{ id, ...updateFields },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Toggle the isActive field of a tour package.
		 * Requires admin role.
		 */
		toggleActive: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
			},
			async handler(ctx) {
				const { id } = ctx.params;

				const existing = await ctx.call(
					"tourPackage.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Tour package not found.",
						404,
						ERROR_CODES.PACKAGE_NOT_FOUND,
						{ id }
					);
				}

				return ctx.call(
					"tourPackage.model.update",
					{ id, isActive: !existing.isActive },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Publish a tour package (only from "draft" status).
		 * Requires admin role.
		 */
		publish: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
			},
			async handler(ctx) {
				const { id } = ctx.params;

				const existing = await ctx.call(
					"tourPackage.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Tour package not found.",
						404,
						ERROR_CODES.PACKAGE_NOT_FOUND,
						{ id }
					);
				}

				if (existing.status !== "draft") {
					throw new MoleculerClientError(
						"Only draft packages can be published.",
						422,
						ERROR_CODES.VALIDATION_ERROR,
						{ id, currentStatus: existing.status }
					);
				}

				return ctx.call(
					"tourPackage.model.update",
					{ id, status: "published" },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Archive a tour package.
		 * Requires admin role.
		 */
		archive: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
			},
			async handler(ctx) {
				const { id } = ctx.params;

				const existing = await ctx.call(
					"tourPackage.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Tour package not found.",
						404,
						ERROR_CODES.PACKAGE_NOT_FOUND,
						{ id }
					);
				}

				return ctx.call(
					"tourPackage.model.update",
					{ id, status: "archived" },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Get all pricing tiers for a package.
		 * Public action.
		 */
		getPricingTiers: {
			auth: undefined,
			params: {
				packageId: "string",
			},
			async handler(ctx) {
				return ctx.call(
					"packagePricing.model.find",
					{ query: { packageId: ctx.params.packageId, isActive: true } },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Add a pricing tier to a package.
		 * Requires admin role.
		 */
		addPricingTier: {
			auth: "required",
			role: "admin",
			params: {
				packageId: "string",
				minGroupSize: "number|integer|positive",
				maxGroupSize: "number|integer|positive",
				pricePerPerson: "number|positive",
				totalPrice: "number|optional",
				label: "string|optional",
			},
			async handler(ctx) {
				const { packageId, minGroupSize, maxGroupSize, pricePerPerson, totalPrice, label } = ctx.params;

				// Validate package exists
				const pkg = await ctx.call(
					"tourPackage.model.get",
					{ id: packageId },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!pkg) {
					throw new MoleculerClientError(
						"Tour package not found.",
						404,
						ERROR_CODES.PACKAGE_NOT_FOUND,
						{ packageId }
					);
				}

				return ctx.call(
					"packagePricing.model.create",
					{
						packageId,
						minGroupSize,
						maxGroupSize,
						pricePerPerson,
						totalPrice,
						label,
						isActive: true,
					},
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Update a pricing tier.
		 * Requires admin role.
		 */
		updatePricingTier: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
				minGroupSize: "number|integer|positive|optional",
				maxGroupSize: "number|integer|positive|optional",
				pricePerPerson: "number|positive|optional",
				totalPrice: "number|optional",
				label: "string|optional",
				isActive: "boolean|optional",
			},
			async handler(ctx) {
				const { id, ...updateFields } = ctx.params;

				const existing = await ctx.call(
					"packagePricing.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Pricing tier not found.",
						404,
						ERROR_CODES.NOT_FOUND,
						{ id }
					);
				}

				return ctx.call(
					"packagePricing.model.update",
					{ id, ...updateFields },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Remove a pricing tier.
		 * Requires admin role.
		 */
		removePricingTier: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
			},
			async handler(ctx) {
				const existing = await ctx.call(
					"packagePricing.model.get",
					{ id: ctx.params.id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Pricing tier not found.",
						404,
						ERROR_CODES.NOT_FOUND,
						{ id: ctx.params.id }
					);
				}

				return ctx.call(
					"packagePricing.model.remove",
					{ id: ctx.params.id },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Validate a package for booking.
		 * Internal action.
		 */
		validatePackage: {
			auth: undefined,
			params: {
				packageId: "string",
				groupSize: "number|integer|positive",
			},
			async handler(ctx) {
				const { packageId, groupSize } = ctx.params;

				const pkg = await ctx.call(
					"tourPackage.model.get",
					{ id: packageId },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!pkg) {
					throw new MoleculerClientError(
						"Tour package not found.",
						404,
						ERROR_CODES.PACKAGE_NOT_FOUND,
						{ packageId }
					);
				}

				// Check booking cutoff time
				if (pkg.startDate && pkg.bookingCutoffHours) {
					const cutoffMs = pkg.bookingCutoffHours * 60 * 60 * 1000;
					const timeUntilTour = new Date(pkg.startDate).getTime() - Date.now();
					if (timeUntilTour < cutoffMs) {
						throw new MoleculerClientError(
							`Booking cutoff passed. Bookings must be made at least ${pkg.bookingCutoffHours} hours before tour start.`,
							422,
							ERROR_CODES.BOOKING_CUTOFF_PASSED,
							{ bookingCutoffHours: pkg.bookingCutoffHours }
						);
					}
				}

				if (!pkg.isActive || pkg.status !== "published") {
					throw new MoleculerClientError(
						"Tour package is not available.",
						422,
						ERROR_CODES.PACKAGE_UNAVAILABLE,
						{ packageId }
					);
				}

				// Find applicable pricing tier for groupSize
				const pricingTiers = await ctx.call(
					"packagePricing.model.find",
					{ query: { packageId, isActive: true } },
					{ meta: ctx.meta }
				);

				const matchingTier = pricingTiers.find(
					(tier) => groupSize >= tier.minGroupSize && groupSize <= tier.maxGroupSize
				);

				if (!matchingTier) {
					throw new MoleculerClientError(
						"No pricing tier matches the given group size.",
						422,
						ERROR_CODES.VALIDATION_ERROR,
						{ packageId, groupSize }
					);
				}

				return {
					valid: true,
					package: pkg,
					pricingTier: matchingTier,
					pricePerPerson: matchingTier.pricePerPerson,
					totalPrice: matchingTier.totalPrice || matchingTier.pricePerPerson * groupSize,
				};
			},
		},

		/**
		 * Decrement remaining capacity for individual_seats mode.
		 * Internal action.
		 */
		decrementCapacity: {
			auth: undefined,
			params: {
				packageId: "string",
				seats: "number|integer|positive",
			},
			async handler(ctx) {
				const { packageId, seats } = ctx.params;

				const pkg = await ctx.call(
					"tourPackage.model.get",
					{ id: packageId },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!pkg) {
					throw new MoleculerClientError(
						"Tour package not found.",
						404,
						ERROR_CODES.PACKAGE_NOT_FOUND,
						{ packageId }
					);
				}

				if (pkg.sellingMode !== SELLING_MODES.INDIVIDUAL_SEATS) {
					throw new MoleculerClientError(
						"Capacity decrement is only for individual_seats mode.",
						422,
						ERROR_CODES.VALIDATION_ERROR,
						{ packageId, sellingMode: pkg.sellingMode }
					);
				}

				if (pkg.remainingCapacity < seats) {
					throw new MoleculerClientError(
						"Insufficient capacity.",
						422,
						ERROR_CODES.INSUFFICIENT_CAPACITY,
						{ packageId, remainingCapacity: pkg.remainingCapacity, requested: seats }
					);
				}

				return ctx.call(
					"tourPackage.model.update",
					{ id: packageId, remainingCapacity: pkg.remainingCapacity - seats },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * Join the waitlist for a tour package.
		 */
		joinWaitlist: {
			auth: "required",
			params: {
				packageId: "string",
				groupSize: "number|min:1",
				preferredDate: "string|optional",
			},
			async handler(ctx) {
				const { packageId, groupSize, preferredDate } = ctx.params;
				const customerId = ctx.meta.user.id;

				// Validate package exists and has waitlist enabled
				const pkg = await ctx.call("tourPackage.model.get", { id: packageId }, { meta: ctx.meta }).catch(() => null);
				if (!pkg) throw new MoleculerClientError("Package not found.", 404, ERROR_CODES.PACKAGE_NOT_FOUND);
				if (!pkg.waitlistEnabled) throw new MoleculerClientError("Waitlist is not enabled for this package.", 422, "WAITLIST_NOT_ENABLED");

				// Check waitlist capacity
				const currentCount = await ctx.call("waitlistEntry.model.count", {
					query: { tourPackageId: packageId, status: "waiting" },
				}, { meta: ctx.meta });
				if (currentCount >= (pkg.maxWaitlistSize || 20)) {
					throw new MoleculerClientError("Waitlist is full.", 422, ERROR_CODES.WAITLIST_FULL);
				}

				// Assign next position
				const position = currentCount + 1;

				const entry = await ctx.call("waitlistEntry.model.create", {
					tourPackageId: packageId,
					customerId,
					groupSize,
					preferredDate: preferredDate ? new Date(preferredDate) : undefined,
					status: "waiting",
					position,
				}, { meta: ctx.meta });

				ctx.emit("waitlist.joined", { packageId, customerId, position });
				return { ...entry, message: `You are #${position} on the waitlist.` };
			},
		},

		/**
		 * Get the waitlist for a tour package (staff only).
		 */
		getWaitlist: {
			auth: "required",
			role: "staff",
			params: { packageId: "string" },
			async handler(ctx) {
				return ctx.call("waitlistEntry.model.find", {
					query: { tourPackageId: ctx.params.packageId, status: { $in: ["waiting", "offered"] } },
					sort: "position",
				}, { meta: ctx.meta });
			},
		},

		/**
		 * Process waitlist — offer the next waiting entry a spot.
		 * Internal action — called by event handler after cancellation.
		 */
		processWaitlist: {
			auth: undefined, // internal — called by event handler
			params: { packageId: "string" },
			async handler(ctx) {
				// Find next waiting entry
				const entries = await ctx.call("waitlistEntry.model.find", {
					query: { tourPackageId: ctx.params.packageId, status: "waiting" },
					sort: "position",
					limit: 1,
				}, { meta: ctx.meta });

				if (!entries || entries.length === 0) return { offered: false, message: "No one on waitlist" };

				const entry = entries[0];
				const now = new Date();
				await ctx.call("waitlistEntry.model.update", {
					id: entry._id.toString ? entry._id.toString() : entry._id,
					status: "offered",
					offeredAt: now,
					expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24h to accept
				}, { meta: ctx.meta });

				ctx.emit("waitlist.offered", { packageId: ctx.params.packageId, customerId: entry.customerId, position: entry.position });
				return { offered: true, customerId: entry.customerId, position: entry.position };
			},
		},

		/**
		 * Get a proximity map of all locations in a tour package with distances.
		 * Public action.
		 */
		getProximityMap: {
			auth: undefined,
			params: { packageId: "string" },
			async handler(ctx) {
				const pkg = await ctx.call("tourPackage.model.get", { id: ctx.params.packageId }, { meta: ctx.meta }).catch(() => null);
				if (!pkg) {
					throw new MoleculerClientError("Package not found.", 404, ERROR_CODES.PACKAGE_NOT_FOUND);
				}

				const { haversineDistance } = require("../utils/geo.utils");
				const locations = [];

				// Get hotel location
				if (pkg.hotelPartnerId) {
					const hotel = await ctx.call("hotelPartner.model.get", { id: pkg.hotelPartnerId.toString() }, { meta: ctx.meta }).catch(() => null);
					if (hotel && hotel.location && hotel.location.coordinates) {
						locations.push({ type: "hotel", id: hotel._id, name: hotel.name, location: hotel.location });
					}
				}

				// Get attraction locations
				if (pkg.attractionIds && pkg.attractionIds.length > 0) {
					for (const aid of pkg.attractionIds) {
						const attr = await ctx.call("attraction.model.get", { id: aid.toString() }, { meta: ctx.meta }).catch(() => null);
						if (attr && attr.location && attr.location.coordinates) {
							locations.push({ type: "attraction", id: attr._id, name: attr.name, location: attr.location });
						}
					}
				}

				// Calculate distances between all locations
				const distances = [];
				for (let i = 0; i < locations.length; i++) {
					for (let j = i + 1; j < locations.length; j++) {
						const a = locations[i], b = locations[j];
						const dist = haversineDistance(
							a.location.coordinates[1], a.location.coordinates[0],
							b.location.coordinates[1], b.location.coordinates[0]
						);
						distances.push({ from: a.name, to: b.name, distanceKm: parseFloat(dist.toFixed(2)) });
					}
				}

				return { packageId: ctx.params.packageId, locations, distances };
			},
		},

		/**
		 * Increment the view count for a tour package.
		 * Public action.
		 */
		incrementViewCount: {
			auth: undefined,
			params: { packageId: "string" },
			async handler(ctx) {
				return ctx.call("tourPackage.model.incrementField", { id: ctx.params.packageId, field: "viewCount" }, { meta: ctx.meta });
			},
		},
	},

	methods: {
		/**
		 * Apply sorting to search results based on sortBy parameter.
		 * For "rating" sort, fetches review stats per package (post-query).
		 *
		 * @param {Context} ctx
		 * @param {Array} results - array of tour package objects
		 * @param {String} sortBy - one of: price_low, price_high, rating, popularity, newest
		 * @returns {Promise<Array>} sorted results
		 */
		async applySortBy(ctx, results, sortBy) {
			if (sortBy === "newest") {
				return results.slice().sort((a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
				);
			}

			if (sortBy === "popularity") {
				return results.slice().sort((a, b) =>
					(b.bookingCount || 0) - (a.bookingCount || 0)
				);
			}

			if (sortBy === "price_low" || sortBy === "price_high") {
				// Ensure each result has pricing data attached
				const withPrices = await Promise.all(
					results.map(async (pkg) => {
						if (pkg.pricingTiers) return pkg;
						const pricingTiers = await ctx.call(
							"packagePricing.model.find",
							{ query: { packageId: pkg._id.toString(), isActive: true } },
							{ meta: ctx.meta }
						);
						return { ...pkg, pricingTiers };
					})
				);

				return withPrices.sort((a, b) => {
					const aPrices = (a.pricingTiers || []).map((t) => t.pricePerPerson);
					const bPrices = (b.pricingTiers || []).map((t) => t.pricePerPerson);
					const aPrice = aPrices.length > 0
						? (sortBy === "price_low" ? Math.min(...aPrices) : Math.max(...aPrices))
						: Infinity;
					const bPrice = bPrices.length > 0
						? (sortBy === "price_low" ? Math.min(...bPrices) : Math.max(...bPrices))
						: Infinity;

					return sortBy === "price_low" ? aPrice - bPrice : bPrice - aPrice;
				});
			}

			if (sortBy === "rating") {
				// Fetch weighted review stats per package (post-query on paginated set)
				const withRatings = await Promise.all(
					results.map(async (pkg) => {
						const stats = await ctx.call(
							"review.getStats",
							{ tourPackageId: pkg._id.toString() },
							{ meta: ctx.meta }
						).catch(() => ({ weightedAverageRating: 0 }));
						return { ...pkg, _weightedRating: stats.weightedAverageRating || 0 };
					})
				);

				return withRatings.sort((a, b) => b._weightedRating - a._weightedRating);
			}

			return results;
		},
	},

	events: {
		"tourPackage.created"(payload) {
			this.logger.info("Tour package created:", payload.tourPackage?.title || payload);
		},
	},
};
