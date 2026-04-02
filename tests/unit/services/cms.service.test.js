"use strict";

const { ServiceBroker } = require("moleculer");
const { ERROR_CODES } = require("../../../utils/constants");

// ---- Mock Sanity client ----

const mockFetch = jest.fn();

jest.mock("../../../utils/sanity.client", () => ({
	getSanityClient: jest.fn(() => ({
		fetch: mockFetch,
	})),
}));

const { getSanityClient } = require("../../../utils/sanity.client");
const CmsService = require("../../../services/cms.service");

// ---- Test data ----

const mockPost = {
	_id: "post-1",
	title: "Exploring Cape Coast",
	slug: { current: "exploring-cape-coast" },
	excerpt: "A journey through history.",
	publishedAt: "2024-06-15T10:00:00Z",
	category: "travel",
	author: { name: "Kofi Mensah", image: null },
	mainImage: "https://cdn.sanity.io/images/test/image1.jpg",
	body: [{ _type: "block", children: [{ text: "Content here" }] }],
};

const mockPost2 = {
	_id: "post-2",
	title: "Kakum National Park",
	slug: { current: "kakum-national-park" },
	excerpt: "Adventure in the canopy.",
	publishedAt: "2024-06-10T10:00:00Z",
	category: "adventure",
	author: { name: "Ama Adjei", image: null },
	mainImage: "https://cdn.sanity.io/images/test/image2.jpg",
	body: [],
};

const mockFaq = {
	_id: "faq-1",
	question: "What is included in the tour?",
	answer: "All meals, transport, and accommodation.",
	category: "general",
};

const mockTestimonial = {
	_id: "testimonial-1",
	name: "Jane Doe",
	location: "Accra",
	quote: "Amazing experience!",
	rating: 5,
	image: "https://cdn.sanity.io/images/test/person.jpg",
};

const mockGalleryItem = {
	_id: "gallery-1",
	title: "Sunset at Busua Beach",
	caption: "Beautiful sunset view",
	category: "beaches",
	imageUrl: "https://cdn.sanity.io/images/test/gallery1.jpg",
};

// ---- Helpers ----

function createBroker() {
	const broker = new ServiceBroker({
		logger: false,
		validator: true,
	});

	broker.createService(CmsService);
	return broker;
}

// ---- Tests ----

describe("CMS Service", () => {
	let broker;

	beforeAll(async () => {
		broker = createBroker();
		await broker.start();
	});

	afterAll(async () => {
		await broker.stop();
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	// ─── listBlogPosts ───

	describe("cms.listBlogPosts", () => {
		it("should return blog posts from Sanity", async () => {
			mockFetch
				.mockResolvedValueOnce([mockPost, mockPost2]) // posts query
				.mockResolvedValueOnce(2); // count query

			const result = await broker.call("cms.listBlogPosts", {});

			expect(result.posts).toHaveLength(2);
			expect(result.total).toBe(2);
			expect(result.page).toBe(1);
			expect(result.pageSize).toBe(10);
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it("should filter by category", async () => {
			mockFetch
				.mockResolvedValueOnce([mockPost])
				.mockResolvedValueOnce(1);

			const result = await broker.call("cms.listBlogPosts", { category: "travel" });

			expect(result.posts).toHaveLength(1);
			expect(result.total).toBe(1);
			// Verify category param was passed to Sanity
			const fetchCall = mockFetch.mock.calls[0];
			expect(fetchCall[1]).toHaveProperty("category", "travel");
		});

		it("should handle pagination", async () => {
			mockFetch
				.mockResolvedValueOnce([mockPost2])
				.mockResolvedValueOnce(2);

			const result = await broker.call("cms.listBlogPosts", { page: 2, pageSize: 1 });

			expect(result.posts).toHaveLength(1);
			expect(result.page).toBe(2);
			expect(result.pageSize).toBe(1);
		});

		it("should return stub when Sanity is not configured", async () => {
			getSanityClient.mockReturnValueOnce(null);

			const result = await broker.call("cms.listBlogPosts", {});

			expect(result.posts).toEqual([]);
			expect(result.total).toBe(0);
			expect(result.message).toContain("CMS not configured");
		});

		it("should filter by featured flag", async () => {
			mockFetch
				.mockResolvedValueOnce([mockPost])
				.mockResolvedValueOnce(1);

			const result = await broker.call("cms.listBlogPosts", { featured: true });

			expect(result.posts).toHaveLength(1);
			const fetchCall = mockFetch.mock.calls[0];
			expect(fetchCall[1]).toHaveProperty("featured", true);
		});
	});

	// ─── getBlogPost ───

	describe("cms.getBlogPost", () => {
		it("should return a single post by slug", async () => {
			mockFetch.mockResolvedValueOnce(mockPost);

			const result = await broker.call("cms.getBlogPost", { slug: "exploring-cape-coast" });

			expect(result._id).toBe("post-1");
			expect(result.title).toBe("Exploring Cape Coast");
			expect(mockFetch).toHaveBeenCalledTimes(1);
			const fetchCall = mockFetch.mock.calls[0];
			expect(fetchCall[1]).toHaveProperty("slug", "exploring-cape-coast");
		});

		it("should throw NOT_FOUND for invalid slug", async () => {
			mockFetch.mockResolvedValueOnce(null);

			await expect(
				broker.call("cms.getBlogPost", { slug: "nonexistent-post" })
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.NOT_FOUND,
			});
		});

		it("should throw when Sanity is not configured", async () => {
			getSanityClient.mockReturnValueOnce(null);

			await expect(
				broker.call("cms.getBlogPost", { slug: "test" })
			).rejects.toMatchObject({
				code: 503,
			});
		});
	});

	// ─── listFAQs ───

	describe("cms.listFAQs", () => {
		it("should return FAQs from Sanity", async () => {
			mockFetch.mockResolvedValueOnce([mockFaq]);

			const result = await broker.call("cms.listFAQs", {});

			expect(result.faqs).toHaveLength(1);
			expect(result.faqs[0].question).toBe("What is included in the tour?");
		});

		it("should filter FAQs by category", async () => {
			mockFetch.mockResolvedValueOnce([mockFaq]);

			const result = await broker.call("cms.listFAQs", { category: "general" });

			expect(result.faqs).toHaveLength(1);
			const fetchCall = mockFetch.mock.calls[0];
			expect(fetchCall[1]).toHaveProperty("category", "general");
		});

		it("should return stub when Sanity is not configured", async () => {
			getSanityClient.mockReturnValueOnce(null);

			const result = await broker.call("cms.listFAQs", {});

			expect(result.faqs).toEqual([]);
			expect(result.message).toContain("CMS not configured");
		});
	});

	// ─── listTestimonials ───

	describe("cms.listTestimonials", () => {
		it("should return testimonials from Sanity", async () => {
			mockFetch.mockResolvedValueOnce([mockTestimonial]);

			const result = await broker.call("cms.listTestimonials", {});

			expect(result.testimonials).toHaveLength(1);
			expect(result.testimonials[0].name).toBe("Jane Doe");
			expect(result.testimonials[0].rating).toBe(5);
		});

		it("should respect limit parameter", async () => {
			mockFetch.mockResolvedValueOnce([mockTestimonial]);

			const result = await broker.call("cms.listTestimonials", { limit: 5 });

			expect(result.testimonials).toHaveLength(1);
			const fetchCall = mockFetch.mock.calls[0];
			expect(fetchCall[1]).toHaveProperty("limit", 5);
		});

		it("should return stub when Sanity is not configured", async () => {
			getSanityClient.mockReturnValueOnce(null);

			const result = await broker.call("cms.listTestimonials", {});

			expect(result.testimonials).toEqual([]);
			expect(result.message).toContain("CMS not configured");
		});
	});

	// ─── listGallery ───

	describe("cms.listGallery", () => {
		it("should return gallery items from Sanity", async () => {
			mockFetch
				.mockResolvedValueOnce([mockGalleryItem])
				.mockResolvedValueOnce(1);

			const result = await broker.call("cms.listGallery", {});

			expect(result.items).toHaveLength(1);
			expect(result.items[0].title).toBe("Sunset at Busua Beach");
			expect(result.total).toBe(1);
		});

		it("should filter gallery by category", async () => {
			mockFetch
				.mockResolvedValueOnce([mockGalleryItem])
				.mockResolvedValueOnce(1);

			const result = await broker.call("cms.listGallery", { category: "beaches" });

			expect(result.items).toHaveLength(1);
			const fetchCall = mockFetch.mock.calls[0];
			expect(fetchCall[1]).toHaveProperty("category", "beaches");
		});

		it("should handle pagination", async () => {
			mockFetch
				.mockResolvedValueOnce([mockGalleryItem])
				.mockResolvedValueOnce(5);

			const result = await broker.call("cms.listGallery", { page: 2, pageSize: 1 });

			expect(result.page).toBe(2);
			expect(result.pageSize).toBe(1);
			expect(result.total).toBe(5);
		});

		it("should return stub when Sanity is not configured", async () => {
			getSanityClient.mockReturnValueOnce(null);

			const result = await broker.call("cms.listGallery", {});

			expect(result.items).toEqual([]);
			expect(result.message).toContain("CMS not configured");
		});
	});

	// ─── getAboutContent ───

	describe("cms.getAboutContent", () => {
		it("should return about page content", async () => {
			const mockAbout = { _id: "about-1", title: "About Us", body: "Our story..." };
			mockFetch.mockResolvedValueOnce(mockAbout);

			const result = await broker.call("cms.getAboutContent", {});

			expect(result.content).toBeDefined();
			expect(result.content._id).toBe("about-1");
		});

		it("should return null content when no about page exists", async () => {
			mockFetch.mockResolvedValueOnce(null);

			const result = await broker.call("cms.getAboutContent", {});

			expect(result.content).toBeNull();
		});

		it("should return stub when Sanity is not configured", async () => {
			getSanityClient.mockReturnValueOnce(null);

			const result = await broker.call("cms.getAboutContent", {});

			expect(result.content).toBeNull();
			expect(result.message).toContain("CMS not configured");
		});
	});

	// ─── getSiteSettings ───

	describe("cms.getSiteSettings", () => {
		it("should return site settings", async () => {
			const mockSettings = {
				_id: "settings-1",
				siteName: "Elysium Tours",
				logo: "https://cdn.sanity.io/images/test/logo.png",
				socialLinks: { twitter: "https://twitter.com/elysium" },
			};
			mockFetch.mockResolvedValueOnce(mockSettings);

			const result = await broker.call("cms.getSiteSettings", {});

			expect(result.settings).toBeDefined();
			expect(result.settings.siteName).toBe("Elysium Tours");
		});

		it("should return null settings when none exist", async () => {
			mockFetch.mockResolvedValueOnce(null);

			const result = await broker.call("cms.getSiteSettings", {});

			expect(result.settings).toBeNull();
		});

		it("should return stub when Sanity is not configured", async () => {
			getSanityClient.mockReturnValueOnce(null);

			const result = await broker.call("cms.getSiteSettings", {});

			expect(result.settings).toBeNull();
			expect(result.message).toContain("CMS not configured");
		});
	});

	// ─── Error handling ───

	describe("error handling", () => {
		it("should throw 502 when Sanity query fails", async () => {
			mockFetch.mockRejectedValueOnce(new Error("Network error"));

			await expect(
				broker.call("cms.listFAQs", {})
			).rejects.toMatchObject({
				code: 502,
				type: ERROR_CODES.INTERNAL_ERROR,
			});
		});
	});
});
