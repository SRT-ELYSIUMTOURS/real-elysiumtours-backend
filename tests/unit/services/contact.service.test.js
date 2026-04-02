"use strict";

const { ServiceBroker } = require("moleculer");
const ContactService = require("../../../services/contact.service");

// ---- Test helpers ----

let modelCallResults = {};
let emailSendCalls = [];

function createBroker() {
	const broker = new ServiceBroker({
		logger: false,
		validator: true,
	});

	// Mock email service
	broker.createService({
		name: "email",
		actions: {
			send: {
				handler(ctx) {
					emailSendCalls.push(ctx.params);
					return { success: true, messageId: "msg-" + Date.now() };
				},
			},
		},
	});

	// Mock subscriber.model service
	broker.createService({
		name: "subscriber.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["subscriber.model.find"] === "function"
						? modelCallResults["subscriber.model.find"](ctx.params)
						: modelCallResults["subscriber.model.find"] || [];
				},
			},
			create: {
				handler(ctx) {
					return typeof modelCallResults["subscriber.model.create"] === "function"
						? modelCallResults["subscriber.model.create"](ctx.params)
						: modelCallResults["subscriber.model.create"] || { _id: "sub1", ...ctx.params };
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["subscriber.model.update"] === "function"
						? modelCallResults["subscriber.model.update"](ctx.params)
						: modelCallResults["subscriber.model.update"] || { _id: ctx.params.id, ...ctx.params };
				},
			},
		},
	});

	broker.createService(ContactService);
	return broker;
}

// ---- Tests ----

describe("contact.service", () => {
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
		emailSendCalls = [];
	});

	// ── submit ──

	describe("submit", () => {
		it("sends email and returns success", async () => {
			const result = await broker.call("contact.submit", {
				firstName: "John",
				lastName: "Doe",
				email: "john@example.com",
				subject: "Trip Inquiry",
				message: "I want to book a tour to Accra.",
			});

			expect(result.success).toBe(true);
			expect(result.message).toBe("Your message has been sent. We'll get back to you shortly.");
			// Should have sent 2 emails: one to company, one confirmation to submitter
			expect(emailSendCalls.length).toBe(2);
			expect(emailSendCalls[1].to).toBe("john@example.com");
		});

		it("validates required fields", async () => {
			await expect(
				broker.call("contact.submit", {
					firstName: "John",
					// missing lastName, email, subject, message
				})
			).rejects.toThrow();
		});

		it("includes phone when provided", async () => {
			const result = await broker.call("contact.submit", {
				firstName: "Jane",
				lastName: "Smith",
				email: "jane@example.com",
				phone: "0241234567",
				phoneCode: "+233",
				subject: "Question",
				message: "What tours are available?",
			});

			expect(result.success).toBe(true);
			// Company email should contain phone info
			const companyEmail = emailSendCalls[0];
			expect(companyEmail.html).toContain("+2330241234567");
		});
	});

	// ── submitNewsletter ──

	describe("submitNewsletter", () => {
		it("creates subscriber", async () => {
			modelCallResults["subscriber.model.find"] = () => [];

			const result = await broker.call("contact.submitNewsletter", {
				email: "newuser@example.com",
			});

			expect(result.success).toBe(true);
			expect(result.message).toBe("You've been subscribed to our newsletter.");
		});

		it("handles duplicate gracefully", async () => {
			modelCallResults["subscriber.model.find"] = () => [
				{ _id: "sub1", email: "existing@example.com", status: "active" },
			];

			const result = await broker.call("contact.submitNewsletter", {
				email: "existing@example.com",
			});

			expect(result.success).toBe(true);
			expect(result.message).toBe("You've been subscribed to our newsletter.");
		});

		it("re-activates unsubscribed user", async () => {
			let updateCalled = false;
			modelCallResults["subscriber.model.find"] = () => [
				{ _id: "sub1", email: "unsub@example.com", status: "unsubscribed" },
			];
			modelCallResults["subscriber.model.update"] = (params) => {
				updateCalled = true;
				return { _id: "sub1", ...params, status: "active" };
			};

			const result = await broker.call("contact.submitNewsletter", {
				email: "unsub@example.com",
			});

			expect(result.success).toBe(true);
			expect(updateCalled).toBe(true);
		});
	});
});
