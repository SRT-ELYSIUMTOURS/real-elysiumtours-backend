"use strict";

const { ServiceBroker } = require("moleculer");
const NotificationService = require("../../../services/notification.service");
const { ERROR_CODES, NOTIFICATION_CHANNELS } = require("../../../utils/constants");

// ---- Test helpers ----

let modelCallResults = {};
let emailSendCalls = [];

function createBroker() {
	const broker = new ServiceBroker({
		logger: false,
		validator: true,
	});

	// Mock notification.model service
	broker.createService({
		name: "notification.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["notification.model.find"] === "function"
						? modelCallResults["notification.model.find"](ctx.params)
						: modelCallResults["notification.model.find"] || [];
				},
			},
			create: {
				handler(ctx) {
					return typeof modelCallResults["notification.model.create"] === "function"
						? modelCallResults["notification.model.create"](ctx.params)
						: modelCallResults["notification.model.create"] || {};
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["notification.model.update"] === "function"
						? modelCallResults["notification.model.update"](ctx.params)
						: modelCallResults["notification.model.update"] || {};
				},
			},
			get: {
				handler(ctx) {
					return typeof modelCallResults["notification.model.get"] === "function"
						? modelCallResults["notification.model.get"](ctx.params)
						: modelCallResults["notification.model.get"] || null;
				},
			},
		},
	});

	// Mock template.model service (dependency)
	broker.createService({
		name: "template.model",
		actions: {
			find: { handler() { return []; } },
			get: { handler() { return null; } },
		},
	});

	// Mock template service (for sendTemplated)
	broker.createService({
		name: "template",
		actions: {
			render: {
				handler(ctx) {
					return typeof modelCallResults["template.render"] === "function"
						? modelCallResults["template.render"](ctx.params)
						: modelCallResults["template.render"] || {
							subject: "Rendered Subject",
							body: "<p>Rendered Body</p>",
							channel: "email",
						};
				},
			},
		},
	});

	// Mock email service
	broker.createService({
		name: "email",
		actions: {
			send: {
				handler(ctx) {
					emailSendCalls.push(ctx.params);
					return { success: true, messageId: "msg-001" };
				},
			},
		},
	});

	// Load the real notification service
	const notificationSvc = broker.createService(NotificationService);

	return { broker, notificationSvc };
}

// ---- Tests ----

describe("Notification Service", () => {
	let broker;
	let notificationSvc;

	beforeAll(async () => {
		({ broker, notificationSvc } = createBroker());
		await broker.start();
	});

	afterAll(async () => {
		await broker.stop();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		modelCallResults = {};
		emailSendCalls = [];
	});

	// ========== send (in_app) ==========

	describe("send (in_app)", () => {
		it("should create notification with delivered status for in_app channel", async () => {
			const createdNotif = {
				_id: "notif-001",
				recipientId: "user-001",
				type: "booking_confirmation",
				channel: NOTIFICATION_CHANNELS.IN_APP,
				title: "Booking Created",
				message: "Your booking BK-001 has been created.",
				data: { bookingRef: "BK-001" },
				deliveryStatus: "pending",
			};

			modelCallResults["notification.model.create"] = (params) => ({
				_id: "notif-001",
				...params,
			});

			modelCallResults["notification.model.update"] = (params) => ({
				...createdNotif,
				...params,
			});

			const result = await broker.call("notification.send", {
				recipientId: "user-001",
				type: "booking_confirmation",
				channel: NOTIFICATION_CHANNELS.IN_APP,
				title: "Booking Created",
				message: "Your booking BK-001 has been created.",
				data: { bookingRef: "BK-001" },
			});

			expect(result.deliveryStatus).toBe("delivered");
			expect(result.sentAt).toBeDefined();
		});
	});

	// ========== send (email) ==========

	describe("send (email)", () => {
		it("should create notification and call email.send for email channel", async () => {
			const createdNotif = {
				_id: "notif-002",
				recipientId: "user-001",
				type: "quote_sent",
				channel: NOTIFICATION_CHANNELS.EMAIL,
				title: "Your Quote is Ready",
				message: "<p>Your quote is ready.</p>",
				data: { email: "user@example.com", quoteId: "q-001" },
				deliveryStatus: "pending",
			};

			modelCallResults["notification.model.create"] = (params) => ({
				_id: "notif-002",
				...params,
			});

			modelCallResults["notification.model.update"] = (params) => ({
				...createdNotif,
				...params,
			});

			const result = await broker.call("notification.send", {
				recipientId: "user-001",
				type: "quote_sent",
				channel: NOTIFICATION_CHANNELS.EMAIL,
				title: "Your Quote is Ready",
				message: "<p>Your quote is ready.</p>",
				data: { email: "user@example.com", quoteId: "q-001" },
			});

			expect(result.deliveryStatus).toBe("sent");
			expect(result.sentAt).toBeDefined();
			expect(emailSendCalls).toHaveLength(1);
			expect(emailSendCalls[0].to).toBe("user@example.com");
			expect(emailSendCalls[0].subject).toBe("Your Quote is Ready");
		});
	});

	// ========== send — delivery failure ==========

	describe("send (failure)", () => {
		it("should handle delivery failure gracefully", async () => {
			const createdNotif = {
				_id: "notif-003",
				recipientId: "user-001",
				type: "quote_sent",
				channel: NOTIFICATION_CHANNELS.EMAIL,
				title: "Your Quote is Ready",
				message: "<p>Your quote is ready.</p>",
				data: { email: "bad@example.com" },
				deliveryStatus: "pending",
			};

			modelCallResults["notification.model.create"] = (params) => ({
				_id: "notif-003",
				...params,
			});

			modelCallResults["notification.model.update"] = (params) => ({
				...createdNotif,
				...params,
			});

			// Override email service to fail — destroy and recreate
			// Instead we swap the model update to track the failure
			// We need to make email.send throw. Use a broker-level override.
			const origCall = broker.call.bind(broker);
			const callSpy = jest.spyOn(broker, "call").mockImplementation(async function (action, params, opts) {
				if (action === "email.send") {
					throw new Error("SMTP connection refused");
				}
				return origCall(action, params, opts);
			});

			const result = await broker.call("notification.send", {
				recipientId: "user-001",
				type: "quote_sent",
				channel: NOTIFICATION_CHANNELS.EMAIL,
				title: "Your Quote is Ready",
				message: "<p>Your quote is ready.</p>",
				data: { email: "bad@example.com" },
			});

			expect(result.deliveryStatus).toBe("failed");
			expect(result.failureReason).toBe("SMTP connection refused");

			callSpy.mockRestore();
		});
	});

	// ========== listForUser ==========

	describe("listForUser", () => {
		it("should return notifications for current user", async () => {
			const notifications = [
				{ _id: "notif-001", recipientId: "user-001", title: "Notif 1", isRead: false },
				{ _id: "notif-002", recipientId: "user-001", title: "Notif 2", isRead: true },
			];

			modelCallResults["notification.model.find"] = (params) => {
				if (params.query && params.query.recipientId === "user-001") {
					return notifications;
				}
				return [];
			};

			const result = await broker.call(
				"notification.listForUser",
				{},
				{ meta: { user: { id: "user-001", role: "customer" } } }
			);

			expect(Array.isArray(result)).toBe(true);
			expect(result).toHaveLength(2);
		});

		it("should filter unread only when unreadOnly is true", async () => {
			const unreadNotifications = [
				{ _id: "notif-001", recipientId: "user-001", title: "Notif 1", isRead: false },
			];

			modelCallResults["notification.model.find"] = (params) => {
				if (
					params.query &&
					params.query.recipientId === "user-001" &&
					params.query.isRead === false
				) {
					return unreadNotifications;
				}
				return [];
			};

			const result = await broker.call(
				"notification.listForUser",
				{ unreadOnly: true },
				{ meta: { user: { id: "user-001", role: "customer" } } }
			);

			expect(Array.isArray(result)).toBe(true);
			expect(result).toHaveLength(1);
			expect(result[0].isRead).toBe(false);
		});
	});

	// ========== markRead ==========

	describe("markRead", () => {
		it("should mark notification as read", async () => {
			const notification = {
				_id: "notif-001",
				recipientId: "user-001",
				title: "Booking Created",
				isRead: false,
			};

			modelCallResults["notification.model.get"] = (params) => {
				if (params.id === "notif-001") return notification;
				return null;
			};

			modelCallResults["notification.model.update"] = (params) => ({
				...notification,
				...params,
			});

			const result = await broker.call(
				"notification.markRead",
				{ id: "notif-001" },
				{ meta: { user: { id: "user-001", role: "customer" } } }
			);

			expect(result.isRead).toBe(true);
			expect(result.readAt).toBeDefined();
		});

		it("should throw error if notification does not belong to user", async () => {
			const notification = {
				_id: "notif-001",
				recipientId: "user-002",
				title: "Booking Created",
				isRead: false,
			};

			modelCallResults["notification.model.get"] = () => notification;

			await expect(
				broker.call(
					"notification.markRead",
					{ id: "notif-001" },
					{ meta: { user: { id: "user-001", role: "customer" } } }
				)
			).rejects.toMatchObject({
				code: 403,
				type: ERROR_CODES.NOTIFICATION_ACCESS_DENIED,
			});
		});
	});

	// ========== markAllRead ==========

	describe("markAllRead", () => {
		it("should mark all unread notifications as read", async () => {
			const unread = [
				{ _id: "notif-001", recipientId: "user-001", isRead: false },
				{ _id: "notif-002", recipientId: "user-001", isRead: false },
				{ _id: "notif-003", recipientId: "user-001", isRead: false },
			];

			modelCallResults["notification.model.find"] = (params) => {
				if (
					params.query &&
					params.query.recipientId === "user-001" &&
					params.query.isRead === false
				) {
					return unread;
				}
				return [];
			};

			modelCallResults["notification.model.update"] = (params) => ({
				...unread.find((n) => n._id === params.id),
				isRead: true,
				readAt: params.readAt,
			});

			const result = await broker.call(
				"notification.markAllRead",
				{},
				{ meta: { user: { id: "user-001", role: "customer" } } }
			);

			expect(result.updated).toBe(3);
		});
	});

	// ========== getUnreadCount ==========

	describe("getUnreadCount", () => {
		it("should return count of unread notifications", async () => {
			const unread = [
				{ _id: "notif-001", recipientId: "user-001", isRead: false },
				{ _id: "notif-002", recipientId: "user-001", isRead: false },
			];

			modelCallResults["notification.model.find"] = (params) => {
				if (
					params.query &&
					params.query.recipientId === "user-001" &&
					params.query.isRead === false
				) {
					return unread;
				}
				return [];
			};

			const result = await broker.call(
				"notification.getUnreadCount",
				{},
				{ meta: { user: { id: "user-001", role: "customer" } } }
			);

			expect(result.count).toBe(2);
		});
	});

	// ========== bulkSend ==========

	describe("bulkSend", () => {
		it("should send to multiple recipients and return summary", async () => {
			modelCallResults["notification.model.create"] = (params) => ({
				_id: `notif-${params.recipientId}`,
				...params,
			});

			modelCallResults["notification.model.update"] = (params) => ({
				_id: params.id,
				...params,
				deliveryStatus: params.deliveryStatus || "delivered",
			});

			const result = await broker.call(
				"notification.bulkSend",
				{
					recipientIds: ["user-001", "user-002", "user-003"],
					type: "booking_confirmation",
					channel: NOTIFICATION_CHANNELS.IN_APP,
					title: "System Announcement",
					message: "There is an important update.",
				},
				{ meta: { user: { id: "admin-001", role: "admin" } } }
			);

			expect(result.total).toBe(3);
			expect(result.sent).toBe(3);
			expect(result.failed).toBe(0);
		});
	});
});
