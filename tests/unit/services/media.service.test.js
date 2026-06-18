"use strict";

const { ServiceBroker } = require("moleculer");
const MediaService = require("../../../services/media.service");
const { ERROR_CODES } = require("../../../utils/constants");
const { Readable } = require("stream");

// ---- Mock cloudinary utils ----

jest.mock("../../../utils/cloudinary.utils", () => ({
	uploadStream: jest.fn().mockResolvedValue({
		secure_url: "https://res.cloudinary.com/demo/image/upload/test/123.jpg",
		public_id: "test/123",
		width: 800,
		height: 600,
		format: "jpg",
		bytes: 12345,
	}),
	uploadFromUrl: jest.fn().mockResolvedValue({
		secure_url: "https://res.cloudinary.com/demo/image/upload/test/456.jpg",
		public_id: "test/456",
		width: 1024,
		height: 768,
		format: "png",
		bytes: 54321,
	}),
	deleteFile: jest.fn().mockResolvedValue({ result: "ok" }),
	listResources: jest.fn().mockResolvedValue({
		resources: [
			{ public_id: "elysium-tours/img1", format: "jpg", bytes: 1000 },
			{ public_id: "elysium-tours/img2", format: "png", bytes: 2000 },
		],
	}),
	generateSignedUrl: jest.fn().mockReturnValue("https://res.cloudinary.com/demo/image/authenticated/s--abc123--/test/123.jpg"),
}));

const cloudinaryUtils = require("../../../utils/cloudinary.utils");

// ---- Helper: create a mock readable stream ----

function createMockStream() {
	const stream = new Readable({
		read() {
			this.push(Buffer.from("fake-file-content"));
			this.push(null);
		},
	});
	return stream;
}

// ---- Broker setup ----

function createBroker() {
	const broker = new ServiceBroker({
		logger: false,
		validator: true,
	});

	broker.createService(MediaService);

	return broker;
}

// ---- Tests ----

describe("Media Service", () => {
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

	// ========== upload ==========

	describe("upload", () => {
		it("should upload a stream and return URL and metadata", async () => {
			const stream = createMockStream();

			const result = await broker.call("media.upload", stream, {
				meta: {
					$multipart: { folder: "tours", entityType: "package", entityId: "pkg-1" },
				},
			});

			expect(result.success).toBe(true);
			expect(result.url).toBe("https://res.cloudinary.com/demo/image/upload/test/123.jpg");
			expect(result.publicId).toBe("test/123");
			expect(result.width).toBe(800);
			expect(result.height).toBe(600);
			expect(result.format).toBe("jpg");
			expect(result.bytes).toBe(12345);
			expect(cloudinaryUtils.uploadStream).toHaveBeenCalledTimes(1);
		});

		it("should throw UPLOAD_FAILED when uploadStream rejects", async () => {
			// Service retries with resourceType "auto" on first failure — reject both attempts
			cloudinaryUtils.uploadStream
				.mockRejectedValueOnce(new Error("Cloud error"))
				.mockRejectedValueOnce(new Error("Cloud error"));

			const stream = createMockStream();

			await expect(
				broker.call("media.upload", stream, {
					meta: { $multipart: {} },
				})
			).rejects.toMatchObject({
				code: 400,
				type: ERROR_CODES.UPLOAD_FAILED,
			});
		});
	});

	// ========== uploadFromUrl ==========

	describe("uploadFromUrl", () => {
		it("should upload from a URL and return result", async () => {
			const result = await broker.call("media.uploadFromUrl", {
				url: "https://example.com/image.jpg",
				folder: "destinations",
			});

			expect(result.success).toBe(true);
			expect(result.url).toBe("https://res.cloudinary.com/demo/image/upload/test/456.jpg");
			expect(result.publicId).toBe("test/456");
			expect(result.width).toBe(1024);
			expect(result.height).toBe(768);
			expect(cloudinaryUtils.uploadFromUrl).toHaveBeenCalledWith(
				"https://example.com/image.jpg",
				{ folder: "destinations" }
			);
		});

		it("should throw UPLOAD_FAILED when uploadFromUrl rejects", async () => {
			cloudinaryUtils.uploadFromUrl.mockRejectedValueOnce(new Error("Invalid URL"));

			await expect(
				broker.call("media.uploadFromUrl", { url: "https://bad-url.com/x" })
			).rejects.toMatchObject({
				code: 400,
				type: ERROR_CODES.UPLOAD_FAILED,
			});
		});

		it("should throw validation error when url is missing", async () => {
			await expect(
				broker.call("media.uploadFromUrl", {})
			).rejects.toThrow();
		});
	});

	// ========== delete ==========

	describe("delete", () => {
		it("should delete a file by publicId", async () => {
			const result = await broker.call("media.delete", { publicId: "test/123" });

			expect(result.success).toBe(true);
			expect(result.result).toEqual({ result: "ok" });
			expect(cloudinaryUtils.deleteFile).toHaveBeenCalledWith("test/123", "image");
		});

		it("should pass resourceType when provided", async () => {
			await broker.call("media.delete", { publicId: "test/video1", resourceType: "video" });

			expect(cloudinaryUtils.deleteFile).toHaveBeenCalledWith("test/video1", "video");
		});

		it("should throw DELETE_FAILED when deleteFile rejects", async () => {
			cloudinaryUtils.deleteFile.mockRejectedValueOnce(new Error("Not found"));

			await expect(
				broker.call("media.delete", { publicId: "bad-id" })
			).rejects.toMatchObject({
				code: 400,
				type: ERROR_CODES.DELETE_FAILED,
			});
		});

		it("should throw validation error when publicId is missing", async () => {
			await expect(
				broker.call("media.delete", {})
			).rejects.toThrow();
		});
	});

	// ========== list ==========

	describe("list", () => {
		it("should return a list of resources", async () => {
			const result = await broker.call("media.list", {});

			expect(result.resources).toBeDefined();
			expect(result.resources.length).toBe(2);
			expect(cloudinaryUtils.listResources).toHaveBeenCalledTimes(1);
		});

		it("should pass folder and maxResults options", async () => {
			await broker.call("media.list", { folder: "tours", maxResults: 10 });

			expect(cloudinaryUtils.listResources).toHaveBeenCalledWith("tours", { maxResults: 10 });
		});
	});

	// ========== getSignedUrl ==========

	describe("getSignedUrl", () => {
		it("should generate a signed URL for a publicId", async () => {
			const result = await broker.call("media.getSignedUrl", { publicId: "test/123" });

			expect(result.url).toBe(
				"https://res.cloudinary.com/demo/image/authenticated/s--abc123--/test/123.jpg"
			);
			expect(cloudinaryUtils.generateSignedUrl).toHaveBeenCalledWith("test/123");
		});

		it("should throw validation error when publicId is missing", async () => {
			await expect(
				broker.call("media.getSignedUrl", {})
			).rejects.toThrow();
		});
	});
});
