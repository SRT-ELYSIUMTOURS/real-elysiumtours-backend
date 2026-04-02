"use strict";

const { ServiceBroker } = require("moleculer");
const ReviewService = require("../../../services/review.service");
const { ERROR_CODES, BOOKING_STATUSES } = require("../../../utils/constants");

// ---- Test helpers ----

let modelCallResults = {};

function createBroker() {
	const broker = new ServiceBroker({
		logger: false,
		validator: true,
	});

	// Mock review.model service
	broker.createService({
		name: "review.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["review.model.find"] === "function"
						? modelCallResults["review.model.find"](ctx.params)
						: modelCallResults["review.model.find"] || [];
				},
			},
			create: {
				handler(ctx) {
					return typeof modelCallResults["review.model.create"] === "function"
						? modelCallResults["review.model.create"](ctx.params)
						: modelCallResults["review.model.create"] || { _id: "rev1", ...ctx.params };
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["review.model.update"] === "function"
						? modelCallResults["review.model.update"](ctx.params)
						: modelCallResults["review.model.update"] || { _id: ctx.params.id, ...ctx.params };
				},
			},
			get: {
				handler(ctx) {
					return typeof modelCallResults["review.model.get"] === "function"
						? modelCallResults["review.model.get"](ctx.params)
						: modelCallResults["review.model.get"] || null;
				},
			},
			remove: {
				handler(ctx) {
					return typeof modelCallResults["review.model.remove"] === "function"
						? modelCallResults["review.model.remove"](ctx.params)
						: modelCallResults["review.model.remove"] || { _id: ctx.params.id };
				},
			},
		},
	});

	// Mock tourPackage.model service
	broker.createService({
		name: "tourPackage.model",
		actions: {
			get: {
				handler(ctx) {
					return typeof modelCallResults["tourPackage.model.get"] === "function"
						? modelCallResults["tourPackage.model.get"](ctx.params)
						: modelCallResults["tourPackage.model.get"] || null;
				},
			},
		},
	});

	// Mock booking.model service
	broker.createService({
		name: "booking.model",
		actions: {
			get: {
				handler(ctx) {
					return typeof modelCallResults["booking.model.get"] === "function"
						? modelCallResults["booking.model.get"](ctx.params)
						: modelCallResults["booking.model.get"] || null;
				},
			},
		},
	});

	broker.createService(ReviewService);
	return broker;
}

// ---- Tests ----

describe("review.service", () => {
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

	// ── listByTour ──

	describe("listByTour", () => {
		it("returns reviews with rating breakdown", async () => {
			const mockReviews = [
				{ _id: "r1", rating: 5, comment: "Great!", isPublished: true, tourPackageId: "pkg1" },
				{ _id: "r2", rating: 4, comment: "Good", isPublished: true, tourPackageId: "pkg1" },
				{ _id: "r3", rating: 5, comment: "Amazing", isPublished: true, tourPackageId: "pkg1" },
			];

			modelCallResults["review.model.find"] = (params) => {
				// Return all for stats query (no limit/offset), filtered for paginated query
				if (params.limit) return mockReviews;
				return mockReviews;
			};

			const result = await broker.call("review.listByTour", {
				tourPackageId: "pkg1",
			});

			expect(result.reviews).toHaveLength(3);
			expect(result.averageRating).toBeCloseTo(4.7, 1);
			expect(result.totalReviews).toBe(3);
			expect(result.ratingBreakdown).toEqual({ 5: 2, 4: 1, 3: 0, 2: 0, 1: 0 });
		});
	});

	// ── create ──

	describe("create", () => {
		it("creates review with customerId from meta", async () => {
			modelCallResults["tourPackage.model.get"] = () => ({ _id: "pkg1", name: "Test Package" });
			modelCallResults["review.model.create"] = (params) => ({
				_id: "rev1",
				...params,
			});

			const result = await broker.call(
				"review.create",
				{
					tourPackageId: "pkg1",
					rating: 5,
					comment: "Excellent tour!",
				},
				{ meta: { user: { id: "user1", role: "customer" } } }
			);

			expect(result._id).toBe("rev1");
			expect(result.customerId).toBe("user1");
			expect(result.rating).toBe(5);
			expect(result.isVerified).toBe(false);
		});

		it("sets isVerified when bookingId provided and booking is completed", async () => {
			modelCallResults["tourPackage.model.get"] = () => ({ _id: "pkg1", name: "Test Package" });
			modelCallResults["booking.model.get"] = () => ({
				_id: "bk1",
				customerId: "user1",
				status: BOOKING_STATUSES.TOUR_COMPLETED,
			});
			modelCallResults["review.model.create"] = (params) => ({
				_id: "rev1",
				...params,
			});

			const result = await broker.call(
				"review.create",
				{
					tourPackageId: "pkg1",
					bookingId: "bk1",
					rating: 5,
					comment: "Verified review!",
				},
				{ meta: { user: { id: "user1", role: "customer" } } }
			);

			expect(result.isVerified).toBe(true);
			expect(result.bookingId).toBe("bk1");
		});

		it("throws error when tour package not found", async () => {
			modelCallResults["tourPackage.model.get"] = () => { throw new Error("Not found"); };

			await expect(
				broker.call(
					"review.create",
					{ tourPackageId: "invalid", rating: 5, comment: "Test" },
					{ meta: { user: { id: "user1", role: "customer" } } }
				)
			).rejects.toThrow("Tour package not found.");
		});
	});

	// ── update ──

	describe("update", () => {
		it("updates own review", async () => {
			modelCallResults["review.model.get"] = () => ({
				_id: "rev1",
				customerId: "user1",
				rating: 4,
				comment: "Good",
			});
			modelCallResults["review.model.update"] = (params) => ({
				_id: "rev1",
				...params,
			});

			const result = await broker.call(
				"review.update",
				{ id: "rev1", rating: 5, comment: "Updated!" },
				{ meta: { user: { id: "user1", role: "customer" } } }
			);

			expect(result.rating).toBe(5);
			expect(result.comment).toBe("Updated!");
		});

		it("throws error when not owner", async () => {
			modelCallResults["review.model.get"] = () => ({
				_id: "rev1",
				customerId: "user2",
				rating: 4,
				comment: "Good",
			});

			await expect(
				broker.call(
					"review.update",
					{ id: "rev1", rating: 5 },
					{ meta: { user: { id: "user1", role: "customer" } } }
				)
			).rejects.toThrow("You can only update your own reviews.");
		});
	});

	// ── delete ──

	describe("delete", () => {
		it("deletes own review", async () => {
			modelCallResults["review.model.get"] = () => ({
				_id: "rev1",
				customerId: "user1",
			});
			modelCallResults["review.model.remove"] = () => ({ _id: "rev1" });

			const result = await broker.call(
				"review.delete",
				{ id: "rev1" },
				{ meta: { user: { id: "user1", role: "customer" } } }
			);

			expect(result._id).toBe("rev1");
		});

		it("allows admin to delete any review", async () => {
			modelCallResults["review.model.get"] = () => ({
				_id: "rev1",
				customerId: "user2",
			});
			modelCallResults["review.model.remove"] = () => ({ _id: "rev1" });

			const result = await broker.call(
				"review.delete",
				{ id: "rev1" },
				{ meta: { user: { id: "admin1", role: "admin" } } }
			);

			expect(result._id).toBe("rev1");
		});

		it("throws error when not owner and not admin", async () => {
			modelCallResults["review.model.get"] = () => ({
				_id: "rev1",
				customerId: "user2",
			});

			await expect(
				broker.call(
					"review.delete",
					{ id: "rev1" },
					{ meta: { user: { id: "user1", role: "customer" } } }
				)
			).rejects.toThrow("You can only delete your own reviews.");
		});
	});

	// ── addResponse ──

	describe("addResponse", () => {
		it("admin adds response to review", async () => {
			modelCallResults["review.model.get"] = () => ({
				_id: "rev1",
				customerId: "user1",
				comment: "Great!",
			});
			modelCallResults["review.model.update"] = (params) => ({
				_id: "rev1",
				response: params.response,
			});

			const result = await broker.call(
				"review.addResponse",
				{ reviewId: "rev1", text: "Thank you for your review!" },
				{ meta: { user: { id: "admin1", role: "admin" } } }
			);

			expect(result.response.text).toBe("Thank you for your review!");
			expect(result.response.respondedBy).toBe("admin1");
			expect(result.response.respondedAt).toBeInstanceOf(Date);
		});

		it("throws error when review not found", async () => {
			modelCallResults["review.model.get"] = () => { throw new Error("Not found"); };

			await expect(
				broker.call(
					"review.addResponse",
					{ reviewId: "invalid", text: "Thanks!" },
					{ meta: { user: { id: "admin1", role: "admin" } } }
				)
			).rejects.toThrow("Review not found.");
		});
	});

	// ── getStats ──

	describe("getStats", () => {
		it("returns correct average and breakdown", async () => {
			modelCallResults["review.model.find"] = () => [
				{ rating: 5 },
				{ rating: 5 },
				{ rating: 4 },
				{ rating: 3 },
				{ rating: 1 },
			];

			const result = await broker.call("review.getStats", {
				tourPackageId: "pkg1",
			});

			expect(result.averageRating).toBe(3.6);
			expect(result.totalReviews).toBe(5);
			expect(result.ratingBreakdown).toEqual({ 5: 2, 4: 1, 3: 1, 2: 0, 1: 1 });
		});

		it("returns zero stats for package with no reviews", async () => {
			modelCallResults["review.model.find"] = () => [];

			const result = await broker.call("review.getStats", {
				tourPackageId: "pkg1",
			});

			expect(result.averageRating).toBe(0);
			expect(result.totalReviews).toBe(0);
			expect(result.ratingBreakdown).toEqual({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
		});

		it("returns weightedAverageRating that weights recent reviews higher", async () => {
			const mockReviews = [
				{ rating: 5, createdAt: new Date(), isVerified: true },                        // today: weight 3.0
				{ rating: 5, createdAt: new Date(Date.now() - 30 * 86400000), isVerified: false },  // 30 days ago: weight 3.0
				{ rating: 3, createdAt: new Date(Date.now() - 200 * 86400000), isVerified: false }, // 200 days ago: weight 1.0
				{ rating: 2, createdAt: new Date(Date.now() - 800 * 86400000), isVerified: false }, // 800 days ago: weight 0.2
			];
			modelCallResults["review.model.find"] = () => mockReviews;

			const result = await broker.call("review.getStats", {
				tourPackageId: "pkg1",
			});

			// Weighted: (5*3 + 5*3 + 3*1 + 2*0.2) / (3+3+1+0.2) = 33.4/7.2 ≈ 4.6
			expect(result.weightedAverageRating).toBeCloseTo(4.6, 1);
			// Simple: (5+5+3+2)/4 = 3.75 → rounds to 3.8
			expect(result.simpleAverageRating).toBe(3.8);
			// Backwards compat alias
			expect(result.averageRating).toBe(result.simpleAverageRating);
		});

		it("returns trendIndicator 'improving' when recent reviews are better", async () => {
			const mockReviews = [
				{ rating: 5, createdAt: new Date(), isVerified: false },                         // today: weight 3.0
				{ rating: 5, createdAt: new Date(Date.now() - 10 * 86400000), isVerified: false }, // 10 days ago: weight 3.0
				{ rating: 2, createdAt: new Date(Date.now() - 400 * 86400000), isVerified: false }, // 400 days ago: weight 0.5
				{ rating: 2, createdAt: new Date(Date.now() - 500 * 86400000), isVerified: false }, // 500 days ago: weight 0.5
			];
			modelCallResults["review.model.find"] = () => mockReviews;

			const result = await broker.call("review.getStats", {
				tourPackageId: "pkg1",
			});

			expect(result.trendIndicator).toBe("improving");
		});

		it("returns trendIndicator 'declining' when recent reviews are worse", async () => {
			const mockReviews = [
				{ rating: 1, createdAt: new Date(), isVerified: false },                         // today: weight 3.0
				{ rating: 1, createdAt: new Date(Date.now() - 10 * 86400000), isVerified: false }, // 10 days ago: weight 3.0
				{ rating: 5, createdAt: new Date(Date.now() - 200 * 86400000), isVerified: false }, // 200 days: weight 1.0
				{ rating: 5, createdAt: new Date(Date.now() - 300 * 86400000), isVerified: false }, // 300 days: weight 1.0
			];
			modelCallResults["review.model.find"] = () => mockReviews;

			const result = await broker.call("review.getStats", {
				tourPackageId: "pkg1",
			});

			expect(result.trendIndicator).toBe("declining");
		});

		it("returns recentReviewCount for last 90 days", async () => {
			const mockReviews = [
				{ rating: 5, createdAt: new Date(), isVerified: false },                          // today
				{ rating: 4, createdAt: new Date(Date.now() - 60 * 86400000), isVerified: false },  // 60 days ago
				{ rating: 3, createdAt: new Date(Date.now() - 200 * 86400000), isVerified: false }, // 200 days ago
				{ rating: 2, createdAt: new Date(Date.now() - 800 * 86400000), isVerified: false }, // 800 days ago
			];
			modelCallResults["review.model.find"] = () => mockReviews;

			const result = await broker.call("review.getStats", {
				tourPackageId: "pkg1",
			});

			expect(result.recentReviewCount).toBe(2);
		});

		it("returns verifiedReviewCount", async () => {
			const mockReviews = [
				{ rating: 5, createdAt: new Date(), isVerified: true },
				{ rating: 4, createdAt: new Date(), isVerified: true },
				{ rating: 3, createdAt: new Date(), isVerified: false },
			];
			modelCallResults["review.model.find"] = () => mockReviews;

			const result = await broker.call("review.getStats", {
				tourPackageId: "pkg1",
			});

			expect(result.verifiedReviewCount).toBe(2);
		});

		it("returns trendIndicator 'stable' when no recent reviews exist", async () => {
			const mockReviews = [
				{ rating: 5, createdAt: new Date(Date.now() - 200 * 86400000), isVerified: false },
				{ rating: 3, createdAt: new Date(Date.now() - 400 * 86400000), isVerified: false },
			];
			modelCallResults["review.model.find"] = () => mockReviews;

			const result = await broker.call("review.getStats", {
				tourPackageId: "pkg1",
			});

			expect(result.trendIndicator).toBe("stable");
		});
	});
});
