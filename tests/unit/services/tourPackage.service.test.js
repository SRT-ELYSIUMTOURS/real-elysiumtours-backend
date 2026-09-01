"use strict";

const { ServiceBroker } = require("moleculer");
const TourPackageService = require("../../../services/tourPackage.service");
const { ERROR_CODES, SELLING_MODES } = require("../../../utils/constants");

// ---- Test data ----

const mockPackage = {
	_id: "pkg-1",
	title: "Cape Coast Adventure",
	slug: "cape-coast-adventure",
	description: "An exciting tour",
	destinationId: "dest-1",
	hotelPartnerId: "hotel-1",
	attractionIds: [],
	diningIds: [],
	sellingMode: SELLING_MODES.GROUP_BUY,
	durationDays: 3,
	isActive: true,
	status: "published",
	images: [],
	highlights: [],
	inclusions: [],
	exclusions: [],
	itinerary: [],
};

const mockPackageIndividual = {
	_id: "pkg-2",
	title: "Accra City Tour",
	slug: "accra-city-tour",
	destinationId: "dest-1",
	sellingMode: SELLING_MODES.INDIVIDUAL_SEATS,
	totalCapacity: 20,
	remainingCapacity: 10,
	durationDays: 1,
	isActive: true,
	status: "published",
};

const mockDestination = {
	_id: "dest-1",
	name: "Cape Coast",
	slug: "cape-coast",
	region: "Central",
	isActive: true,
};

const mockHotel = {
	_id: "hotel-1",
	name: "Beach Resort",
	destinationId: "dest-1",
	isActive: true,
};

const mockPricingTier = {
	_id: "tier-1",
	packageId: "pkg-1",
	minGroupSize: 5,
	maxGroupSize: 10,
	pricePerPerson: 500,
	isActive: true,
	label: "Small Group",
};

const mockPricingTier2 = {
	_id: "tier-2",
	packageId: "pkg-1",
	minGroupSize: 11,
	maxGroupSize: 20,
	pricePerPerson: 400,
	isActive: true,
	label: "Medium Group",
};

// Model call results — keyed by action name
let modelCallResults = {};

function createBroker() {
	const broker = new ServiceBroker({
		logger: false,
		validator: true,
	});

	// Mock tourPackage.model service
	broker.createService({
		name: "tourPackage.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["tourPackage.model.find"] === "function"
						? modelCallResults["tourPackage.model.find"](ctx.params)
						: modelCallResults["tourPackage.model.find"] || [];
				},
			},
			get: {
				handler(ctx) {
					if (typeof modelCallResults["tourPackage.model.get"] === "function") {
						return modelCallResults["tourPackage.model.get"](ctx.params);
					}
					return modelCallResults["tourPackage.model.get"] || null;
				},
			},
			create: {
				handler(ctx) {
					return typeof modelCallResults["tourPackage.model.create"] === "function"
						? modelCallResults["tourPackage.model.create"](ctx.params)
						: modelCallResults["tourPackage.model.create"] || {};
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["tourPackage.model.update"] === "function"
						? modelCallResults["tourPackage.model.update"](ctx.params)
						: modelCallResults["tourPackage.model.update"] || {};
				},
			},
		},
	});

	// Mock packagePricing.model service
	broker.createService({
		name: "packagePricing.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["packagePricing.model.find"] === "function"
						? modelCallResults["packagePricing.model.find"](ctx.params)
						: modelCallResults["packagePricing.model.find"] || [];
				},
			},
			get: {
				handler(ctx) {
					if (typeof modelCallResults["packagePricing.model.get"] === "function") {
						return modelCallResults["packagePricing.model.get"](ctx.params);
					}
					return modelCallResults["packagePricing.model.get"] || null;
				},
			},
			create: {
				handler(ctx) {
					return typeof modelCallResults["packagePricing.model.create"] === "function"
						? modelCallResults["packagePricing.model.create"](ctx.params)
						: modelCallResults["packagePricing.model.create"] || {};
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["packagePricing.model.update"] === "function"
						? modelCallResults["packagePricing.model.update"](ctx.params)
						: modelCallResults["packagePricing.model.update"] || {};
				},
			},
			remove: {
				handler(ctx) {
					return typeof modelCallResults["packagePricing.model.remove"] === "function"
						? modelCallResults["packagePricing.model.remove"](ctx.params)
						: modelCallResults["packagePricing.model.remove"] || {};
				},
			},
		},
	});

	// Mock destination.model service
	broker.createService({
		name: "destination.model",
		actions: {
			get: {
				handler(ctx) {
					if (typeof modelCallResults["destination.model.get"] === "function") {
						return modelCallResults["destination.model.get"](ctx.params);
					}
					return modelCallResults["destination.model.get"] || null;
				},
			},
		},
	});

	// Mock hotelPartner.model service
	broker.createService({
		name: "hotelPartner.model",
		actions: {
			get: {
				handler(ctx) {
					if (typeof modelCallResults["hotelPartner.model.get"] === "function") {
						return modelCallResults["hotelPartner.model.get"](ctx.params);
					}
					return modelCallResults["hotelPartner.model.get"] || null;
				},
			},
		},
	});

	// Mock attraction.model service
	broker.createService({
		name: "attraction.model",
		actions: {
			get: {
				handler(ctx) {
					if (typeof modelCallResults["attraction.model.get"] === "function") {
						return modelCallResults["attraction.model.get"](ctx.params);
					}
					return modelCallResults["attraction.model.get"] || null;
				},
			},
		},
	});

	// Mock review.model service
	broker.createService({
		name: "review.model",
		actions: {
			find: { handler() { return []; } },
			get: { handler() { return null; } },
			count: { handler() { return 0; } },
		},
	});

	// Mock review service
	broker.createService({
		name: "review",
		actions: {
			getStats: { handler() { return { weightedAverageRating: 0, simpleAverageRating: 0, totalReviews: 0, ratingBreakdown: {} }; } },
		},
	});

	// Mock waitlistEntry.model service
	broker.createService({
		name: "waitlistEntry.model",
		actions: {
			find: { handler() { return []; } },
			get: { handler() { return null; } },
			create: { handler(ctx) { return { _id: "wl-1", ...ctx.params }; } },
			count: { handler() { return 0; } },
		},
	});

	// Load real tourPackage service
	broker.createService(TourPackageService);

	return broker;
}

// ---- Tests ----

describe("TourPackage Service", () => {
	let broker;

	beforeAll(async () => {
		broker = createBroker();
		await broker.start();
	});

	afterAll(async () => {
		await broker.stop();
	});

	beforeEach(() => {
		modelCallResults = {};
	});

	// ========== list ==========

	describe("list", () => {
		it("should return an array of published packages", async () => {
			modelCallResults["tourPackage.model.find"] = () => [mockPackage];
			modelCallResults["packagePricing.model.find"] = () => [mockPricingTier];

			const result = await broker.call("tourPackage.list", {});

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBe(1);
			expect(result[0].title).toBe("Cape Coast Adventure");
			expect(result[0].pricingTiers).toBeDefined();
			expect(result[0].pricingTiers.length).toBe(1);
		});
	});

	// ========== get ==========

	describe("get", () => {
		it("should return a package with pricing tiers on happy path", async () => {
			modelCallResults["tourPackage.model.get"] = () => mockPackage;
			modelCallResults["packagePricing.model.find"] = () => [mockPricingTier, mockPricingTier2];
			modelCallResults["destination.model.get"] = () => mockDestination;

			const result = await broker.call("tourPackage.get", { id: "pkg-1" });

			expect(result).toBeDefined();
			expect(result._id).toBe("pkg-1");
			expect(result.title).toBe("Cape Coast Adventure");
			expect(result.pricingTiers.length).toBe(2);
			expect(result.destination).toBeDefined();
			expect(result.destination.name).toBe("Cape Coast");
		});

		it("should throw PACKAGE_NOT_FOUND for invalid id", async () => {
			modelCallResults["tourPackage.model.get"] = () => {
				throw new Error("not found");
			};

			await expect(
				broker.call("tourPackage.get", { id: "invalid-id" })
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.PACKAGE_NOT_FOUND,
			});
		});
	});

	// ========== create ==========

	describe("create", () => {
		it("should create a package with slug and pricing tiers", async () => {
			modelCallResults["destination.model.get"] = () => mockDestination;
			modelCallResults["hotelPartner.model.get"] = () => mockHotel;
			modelCallResults["tourPackage.model.create"] = (params) => ({
				_id: "new-pkg",
				...params,
			});
			modelCallResults["packagePricing.model.create"] = (params) => ({
				_id: "new-tier",
				...params,
			});

			const result = await broker.call("tourPackage.create", {
				title: "Kumasi Cultural Tour",
				description: "Explore Ashanti heritage",
				destinationId: "dest-1",
				hotelPartnerId: "hotel-1",
				durationDays: 4,
				pricingTiers: [
					{ minGroupSize: 5, maxGroupSize: 15, pricePerPerson: 600, label: "Standard" },
				],
			});

			expect(result._id).toBe("new-pkg");
			expect(result.title).toBe("Kumasi Cultural Tour");
			expect(result.slug).toBe("kumasi-cultural-tour");
			expect(result.pricingTiers).toBeDefined();
			expect(result.pricingTiers.length).toBe(1);
			expect(result.pricingTiers[0].pricePerPerson).toBe(600);
		});

		it("should throw DESTINATION_NOT_FOUND for invalid destination", async () => {
			modelCallResults["destination.model.get"] = () => {
				throw new Error("not found");
			};

			await expect(
				broker.call("tourPackage.create", {
					title: "Bad Tour",
					destinationId: "invalid-dest",
					durationDays: 2,
				})
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.DESTINATION_NOT_FOUND,
			});
		});

		// durationDays is required and the admin form used to send `duration`,
		// which made every create fail. Pin the requirement.
		it("should reject a create without durationDays", async () => {
			modelCallResults["destination.model.get"] = () => mockDestination;

			await expect(
				broker.call("tourPackage.create", {
					title: "No Duration Tour",
					destinationId: "dest-1",
				})
			).rejects.toMatchObject({ code: 422 });
		});

		// The old handler destructured 21 named fields and dropped the rest, so
		// itinerary detail, add-ons, badges and booking rules never persisted.
		it("should forward the full admin payload to the model", async () => {
			modelCallResults["destination.model.get"] = () => mockDestination;
			let received = null;
			modelCallResults["tourPackage.model.create"] = (params) => {
				received = params;
				return { _id: "new-pkg", ...params };
			};

			await broker.call("tourPackage.create", {
				title: "Full Coverage Tour",
				destinationId: "dest-1",
				durationDays: 5,
				coverImage: "https://img/cover.jpg",
				basePrice: 1200,
				category: "leisure",
				featured: true,
				tags: ["Heritage"],
				country: "ghana",
				tourType: "multi_day",
				difficulty: "moderate",
				bestFor: ["Alumni"],
				route: "Accra to Kumasi",
				meetingPoint: { lat: 5.6, lng: -0.2 },
				meetingPointLabel: "Achimota School",
				pickupNote: "Depart 6am",
				statusBadge: { label: "Hot", color: "#f00" },
				availabilityBadge: "Limited Spots",
				bookingCutoffHours: 48,
				waitlistEnabled: true,
				maxWaitlistSize: 30,
				autoConfirmationHours: 24,
				tourHighlights: [{ title: "Kintampo Falls", image: "https://img/1.jpg" }],
				bookingAddOns: [{ id: "a1", label: "Photographer", priceGhc: 300 }],
				packingList: [{ text: "Sunscreen" }],
				categoryRatings: [{ label: "Value", score: 4.5 }],
				importantInformation: { blocks: [{ title: "Visa", body: "Bring ID" }], footerNote: "Thanks" },
				businessAmenities: { items: ["Wifi"] },
				accommodationOptions: [
					{
						label: "Option A",
						tier: "premium",
						pricing: [{ roomType: "single", pricePerPerson: 2500 }],
					},
				],
			});

			expect(received).toMatchObject({
				title: "Full Coverage Tour",
				coverImage: "https://img/cover.jpg",
				basePrice: 1200,
				category: "leisure",
				featured: true,
				meetingPointLabel: "Achimota School",
				bookingCutoffHours: 48,
				waitlistEnabled: true,
			});
			expect(received.tourHighlights).toHaveLength(1);
			expect(received.bookingAddOns[0].priceGhc).toBe(300);
			expect(received.packingList[0].text).toBe("Sunscreen");
			expect(received.importantInformation.footerNote).toBe("Thanks");
			expect(received.statusBadge.label).toBe("Hot");
			expect(received.accommodationOptions[0].pricing[0].pricePerPerson).toBe(2500);
			// Slug is always derived from the title, never client-supplied.
			expect(received.slug).toBe("full-coverage-tour");
		});

		// ── SECURITY: mass assignment ────────────────────────────────────────────
		it("should strip server-controlled and unknown fields on create", async () => {
			modelCallResults["destination.model.get"] = () => mockDestination;
			let received = null;
			modelCallResults["tourPackage.model.create"] = (params) => {
				received = params;
				return { _id: "new-pkg", ...params };
			};

			await broker.call("tourPackage.create", {
				title: "Sneaky Tour",
				destinationId: "dest-1",
				durationDays: 3,
				slug: "attacker-chosen-slug",
				rating: 5,
				reviewCount: 9999,
				viewCount: 12345,
				bookingCount: 777,
				bogusField: "nope",
			});

			expect(received.rating).toBeUndefined();
			expect(received.reviewCount).toBeUndefined();
			expect(received.viewCount).toBeUndefined();
			expect(received.bookingCount).toBeUndefined();
			expect(received.bogusField).toBeUndefined();
			// Client-supplied slug must be ignored in favour of the generated one.
			expect(received.slug).toBe("sneaky-tour");
		});

		it("should reject organizationId from a non-super_admin", async () => {
			modelCallResults["destination.model.get"] = () => mockDestination;
			modelCallResults["tourPackage.model.create"] = (params) => ({ _id: "p", ...params });

			await expect(
				broker.call(
					"tourPackage.create",
					{
						title: "Cross Tenant Tour",
						destinationId: "dest-1",
						durationDays: 3,
						organizationId: "another-org",
					},
					{ meta: { user: { _id: "admin-1", role: "admin" } } }
				)
			).rejects.toMatchObject({
				code: 403,
				type: ERROR_CODES.FORBIDDEN,
			});
		});

		it("should allow a super_admin to stamp organizationId", async () => {
			modelCallResults["destination.model.get"] = () => mockDestination;
			let received = null;
			modelCallResults["tourPackage.model.create"] = (params) => {
				received = params;
				return { _id: "p", ...params };
			};

			await broker.call(
				"tourPackage.create",
				{
					title: "Partner Org Tour",
					destinationId: "dest-1",
					durationDays: 3,
					organizationId: "oaa-org",
				},
				{ meta: { user: { _id: "su-1", role: "super_admin" } } }
			);

			expect(received.organizationId).toBe("oaa-org");
		});
	});

	// ========== update: field contract ==========

	describe("update field contract", () => {
		it("should strip server-controlled fields and refuse organizationId", async () => {
			modelCallResults["tourPackage.model.get"] = () => mockPackage;
			let received = null;
			modelCallResults["tourPackage.model.update"] = (params) => {
				received = params;
				return { ...mockPackage, ...params };
			};

			await broker.call("tourPackage.update", {
				id: "pkg-1",
				title: "Renamed Tour",
				rating: 5,
				viewCount: 999,
				bookingCount: 111,
				// .model.update is not tenant-scoped, so this must never pass through.
				organizationId: "another-org",
				bogusField: "nope",
			});

			expect(received.title).toBe("Renamed Tour");
			expect(received.rating).toBeUndefined();
			expect(received.viewCount).toBeUndefined();
			expect(received.bookingCount).toBeUndefined();
			expect(received.organizationId).toBeUndefined();
			expect(received.bogusField).toBeUndefined();
		});

		// ── Pricing tiers on update ──────────────────────────────────────────────
		// Tiers are the primary pricing model for the catalogue but live in their
		// own collection, so update() syncs them separately. Before this, tiers
		// could only be set at creation and were uneditable afterwards.
		describe("pricingTiers sync", () => {
			const tierA = {
				_id: "tier-a",
				packageId: "pkg-1",
				minGroupSize: 1,
				maxGroupSize: 4,
				pricePerPerson: 500,
				isActive: true,
			};
			const tierB = {
				_id: "tier-b",
				packageId: "pkg-1",
				minGroupSize: 5,
				maxGroupSize: 10,
				pricePerPerson: 450,
				isActive: true,
			};

			it("updates an existing tier in place, keeping its id", async () => {
				modelCallResults["tourPackage.model.get"] = () => mockPackage;
				modelCallResults["tourPackage.model.update"] = (p) => ({ ...mockPackage, ...p });
				modelCallResults["packagePricing.model.find"] = () => [tierA];

				const updates = [];
				modelCallResults["packagePricing.model.update"] = (p) => {
					updates.push(p);
					return { ...tierA, ...p };
				};
				const creates = [];
				modelCallResults["packagePricing.model.create"] = (p) => {
					creates.push(p);
					return { _id: "new", ...p };
				};
				const removes = [];
				modelCallResults["packagePricing.model.remove"] = (p) => {
					removes.push(p);
					return {};
				};

				await broker.call("tourPackage.update", {
					id: "pkg-1",
					pricingTiers: [{ _id: "tier-a", pricePerPerson: 600 }],
				});

				expect(updates).toHaveLength(1);
				expect(updates[0]).toMatchObject({ id: "tier-a", pricePerPerson: 600 });
				expect(creates).toHaveLength(0);
				expect(removes).toHaveLength(0);
			});

			it("creates tiers that arrive without an id", async () => {
				modelCallResults["tourPackage.model.get"] = () => mockPackage;
				modelCallResults["tourPackage.model.update"] = (p) => ({ ...mockPackage, ...p });
				modelCallResults["packagePricing.model.find"] = () => [];

				const creates = [];
				modelCallResults["packagePricing.model.create"] = (p) => {
					creates.push(p);
					return { _id: "brand-new", ...p };
				};
				modelCallResults["packagePricing.model.remove"] = () => ({});

				await broker.call("tourPackage.update", {
					id: "pkg-1",
					pricingTiers: [
						{ minGroupSize: 1, maxGroupSize: 4, pricePerPerson: 700, label: "Standard" },
					],
				});

				expect(creates).toHaveLength(1);
				expect(creates[0]).toMatchObject({
					packageId: "pkg-1",
					minGroupSize: 1,
					maxGroupSize: 4,
					pricePerPerson: 700,
					label: "Standard",
					isActive: true,
				});
			});

			it("removes tiers the admin dropped from the list", async () => {
				modelCallResults["tourPackage.model.get"] = () => mockPackage;
				modelCallResults["tourPackage.model.update"] = (p) => ({ ...mockPackage, ...p });
				modelCallResults["packagePricing.model.find"] = () => [tierA, tierB];
				modelCallResults["packagePricing.model.update"] = (p) => p;

				const removes = [];
				modelCallResults["packagePricing.model.remove"] = (p) => {
					removes.push(p.id);
					return {};
				};

				// Only tier-a is resubmitted, so tier-b must go.
				await broker.call("tourPackage.update", {
					id: "pkg-1",
					pricingTiers: [{ _id: "tier-a", pricePerPerson: 500 }],
				});

				expect(removes).toEqual(["tier-b"]);
			});

			it("clears all tiers when an empty array is submitted", async () => {
				modelCallResults["tourPackage.model.get"] = () => mockPackage;
				modelCallResults["tourPackage.model.update"] = (p) => ({ ...mockPackage, ...p });
				modelCallResults["packagePricing.model.find"] = () => [tierA, tierB];

				const removes = [];
				modelCallResults["packagePricing.model.remove"] = (p) => {
					removes.push(p.id);
					return {};
				};

				await broker.call("tourPackage.update", { id: "pkg-1", pricingTiers: [] });

				expect(removes.sort()).toEqual(["tier-a", "tier-b"]);
			});

			it("leaves tiers untouched when the key is omitted", async () => {
				modelCallResults["tourPackage.model.get"] = () => mockPackage;
				modelCallResults["tourPackage.model.update"] = (p) => ({ ...mockPackage, ...p });

				let findCalled = false;
				modelCallResults["packagePricing.model.find"] = () => {
					findCalled = true;
					return [tierA];
				};
				const removes = [];
				modelCallResults["packagePricing.model.remove"] = (p) => {
					removes.push(p.id);
					return {};
				};

				// A tour edit that doesn't touch pricing must not disturb the tiers.
				await broker.call("tourPackage.update", { id: "pkg-1", title: "Renamed" });

				expect(findCalled).toBe(false);
				expect(removes).toEqual([]);
			});

			it("does not blank stored values when a field is omitted from an edit", async () => {
				modelCallResults["tourPackage.model.get"] = () => mockPackage;
				modelCallResults["tourPackage.model.update"] = (p) => ({ ...mockPackage, ...p });
				modelCallResults["packagePricing.model.find"] = () => [tierA];

				let received = null;
				modelCallResults["packagePricing.model.update"] = (p) => {
					received = p;
					return p;
				};
				modelCallResults["packagePricing.model.remove"] = () => ({});

				await broker.call("tourPackage.update", {
					id: "pkg-1",
					pricingTiers: [{ _id: "tier-a", pricePerPerson: 550 }],
				});

				expect(received.pricePerPerson).toBe(550);
				// Fields absent from the submission must not be sent as undefined.
				expect("label" in received).toBe(false);
				expect("minGroupSize" in received).toBe(false);
			});
		});

		it("should persist the previously-unreachable content fields on update", async () => {
			modelCallResults["tourPackage.model.get"] = () => mockPackage;
			let received = null;
			modelCallResults["tourPackage.model.update"] = (params) => {
				received = params;
				return { ...mockPackage, ...params };
			};

			await broker.call("tourPackage.update", {
				id: "pkg-1",
				coverImage: "https://img/new.jpg",
				bookingAddOns: [{ id: "a1", label: "Guide", priceGhc: 150 }],
				meetingPoint: { lat: 1, lng: 2 },
				featured: true,
				basePrice: 900,
			});

			expect(received).toMatchObject({
				coverImage: "https://img/new.jpg",
				featured: true,
				basePrice: 900,
			});
			expect(received.bookingAddOns[0].label).toBe("Guide");
			expect(received.meetingPoint.lat).toBe(1);
		});
	});

	// ========== validatePackage ==========

	describe("validatePackage", () => {
		it("should return valid result for active published package with matching tier", async () => {
			modelCallResults["tourPackage.model.get"] = () => mockPackage;
			modelCallResults["packagePricing.model.find"] = () => [mockPricingTier, mockPricingTier2];

			const result = await broker.call("tourPackage.validatePackage", {
				packageId: "pkg-1",
				groupSize: 7,
			});

			expect(result.valid).toBe(true);
			expect(result.package._id).toBe("pkg-1");
			expect(result.pricingTier._id).toBe("tier-1");
			expect(result.pricePerPerson).toBe(500);
			expect(result.totalPrice).toBe(3500);
		});

		it("should throw PACKAGE_UNAVAILABLE for inactive package", async () => {
			modelCallResults["tourPackage.model.get"] = () => ({
				...mockPackage,
				isActive: false,
			});

			await expect(
				broker.call("tourPackage.validatePackage", {
					packageId: "pkg-1",
					groupSize: 7,
				})
			).rejects.toMatchObject({
				code: 422,
				type: ERROR_CODES.PACKAGE_UNAVAILABLE,
			});
		});

		it("should throw error when no pricing tier matches group size", async () => {
			modelCallResults["tourPackage.model.get"] = () => mockPackage;
			modelCallResults["packagePricing.model.find"] = () => [mockPricingTier];

			await expect(
				broker.call("tourPackage.validatePackage", {
					packageId: "pkg-1",
					groupSize: 50,
				})
			).rejects.toMatchObject({
				code: 422,
				type: ERROR_CODES.VALIDATION_ERROR,
			});
		});
	});

	// ========== decrementCapacity ==========

	describe("decrementCapacity", () => {
		it("should decrement remaining capacity", async () => {
			modelCallResults["tourPackage.model.get"] = () => ({ ...mockPackageIndividual });
			modelCallResults["tourPackage.model.update"] = (params) => ({
				...mockPackageIndividual,
				remainingCapacity: params.remainingCapacity,
			});

			const result = await broker.call("tourPackage.decrementCapacity", {
				packageId: "pkg-2",
				seats: 3,
			});

			expect(result.remainingCapacity).toBe(7);
		});

		it("should throw INSUFFICIENT_CAPACITY when not enough seats", async () => {
			modelCallResults["tourPackage.model.get"] = () => ({ ...mockPackageIndividual });

			await expect(
				broker.call("tourPackage.decrementCapacity", {
					packageId: "pkg-2",
					seats: 15,
				})
			).rejects.toMatchObject({
				code: 422,
				type: ERROR_CODES.INSUFFICIENT_CAPACITY,
			});
		});
	});

	// ========== toggleActive ==========

	describe("toggleActive", () => {
		it("should toggle isActive from true to false", async () => {
			modelCallResults["tourPackage.model.get"] = () => ({ ...mockPackage, isActive: true });
			modelCallResults["tourPackage.model.update"] = (params) => ({
				...mockPackage,
				isActive: params.isActive,
			});

			const result = await broker.call("tourPackage.toggleActive", { id: "pkg-1" });

			expect(result.isActive).toBe(false);
		});
	});

	// ========== publish ==========

	describe("publish", () => {
		it("should set status to published from draft", async () => {
			modelCallResults["tourPackage.model.get"] = () => ({ ...mockPackage, status: "draft" });
			modelCallResults["tourPackage.model.update"] = (params) => ({
				...mockPackage,
				status: params.status,
			});

			const result = await broker.call("tourPackage.publish", { id: "pkg-1" });

			expect(result.status).toBe("published");
		});
	});
});
