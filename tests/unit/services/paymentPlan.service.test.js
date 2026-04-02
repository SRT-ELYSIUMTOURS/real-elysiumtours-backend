"use strict";

const { ServiceBroker } = require("moleculer");
const PaymentPlanService = require("../../../services/paymentPlan.service");
const { ERROR_CODES, PAYMENT_PLAN_STATUSES, MILESTONE_STATUSES } = require("../../../utils/constants");

// ---- Test data ----

const mockBooking = {
	_id: "booking-1",
	customerId: "customer-1",
	bookingType: "packaged",
	bookingRef: "ELY-20260401-AB12",
	groupSize: 4,
	totalAmount: 1000,
	currency: "GHS",
	status: "pending_payment",
	createdAt: "2026-04-01T10:00:00.000Z",
};

const mockPaymentPlan = {
	_id: "plan-1",
	bookingId: "booking-1",
	customerId: "customer-1",
	totalAmount: 1000,
	paidAmount: 0,
	remainingAmount: 1000,
	currency: "GHS",
	commitmentFeePercent: 15,
	commitmentFeeAmount: 150,
	numberOfMilestones: 3,
	status: PAYMENT_PLAN_STATUSES.ACTIVE,
};

const mockMilestones = [
	{
		_id: "ms-1",
		paymentPlanId: "plan-1",
		bookingId: "booking-1",
		milestoneNumber: 1,
		label: "Commitment Fee",
		amount: 150,
		currency: "GHS",
		dueDate: "2026-04-01T10:00:00.000Z",
		status: MILESTONE_STATUSES.PENDING,
		isOverdue: false,
	},
	{
		_id: "ms-2",
		paymentPlanId: "plan-1",
		bookingId: "booking-1",
		milestoneNumber: 2,
		label: "Second Payment",
		amount: 425,
		currency: "GHS",
		dueDate: "2026-05-01T10:00:00.000Z",
		status: MILESTONE_STATUSES.PENDING,
		isOverdue: false,
	},
	{
		_id: "ms-3",
		paymentPlanId: "plan-1",
		bookingId: "booking-1",
		milestoneNumber: 3,
		label: "Final Payment",
		amount: 425,
		currency: "GHS",
		dueDate: "2026-05-31T10:00:00.000Z",
		status: MILESTONE_STATUSES.PENDING,
		isOverdue: false,
	},
];

// Model call results -- keyed by action name
let modelCallResults = {};

// Track emitted events
let emittedEvents = [];

function customerMeta(id = "customer-1") {
	return { user: { id, role: "customer" } };
}

function createBroker() {
	const broker = new ServiceBroker({
		logger: false,
		validator: true,
	});

	// Mock booking.model service
	broker.createService({
		name: "booking.model",
		actions: {
			get: {
				handler(ctx) {
					if (typeof modelCallResults["booking.model.get"] === "function") {
						return modelCallResults["booking.model.get"](ctx.params);
					}
					return modelCallResults["booking.model.get"] || null;
				},
			},
			find: {
				handler(ctx) {
					return typeof modelCallResults["booking.model.find"] === "function"
						? modelCallResults["booking.model.find"](ctx.params)
						: modelCallResults["booking.model.find"] || [];
				},
			},
		},
	});

	// Mock payment.model service
	broker.createService({
		name: "payment.model",
		actions: {
			get: {
				handler(ctx) {
					if (typeof modelCallResults["payment.model.get"] === "function") {
						return modelCallResults["payment.model.get"](ctx.params);
					}
					return modelCallResults["payment.model.get"] || null;
				},
			},
			find: {
				handler(ctx) {
					return typeof modelCallResults["payment.model.find"] === "function"
						? modelCallResults["payment.model.find"](ctx.params)
						: modelCallResults["payment.model.find"] || [];
				},
			},
		},
	});

	// Mock paymentPlan.model service
	broker.createService({
		name: "paymentPlan.model",
		actions: {
			create: {
				handler(ctx) {
					return typeof modelCallResults["paymentPlan.model.create"] === "function"
						? modelCallResults["paymentPlan.model.create"](ctx.params)
						: modelCallResults["paymentPlan.model.create"] || {};
				},
			},
			get: {
				handler(ctx) {
					if (typeof modelCallResults["paymentPlan.model.get"] === "function") {
						return modelCallResults["paymentPlan.model.get"](ctx.params);
					}
					return modelCallResults["paymentPlan.model.get"] || null;
				},
			},
			find: {
				handler(ctx) {
					return typeof modelCallResults["paymentPlan.model.find"] === "function"
						? modelCallResults["paymentPlan.model.find"](ctx.params)
						: modelCallResults["paymentPlan.model.find"] || [];
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["paymentPlan.model.update"] === "function"
						? modelCallResults["paymentPlan.model.update"](ctx.params)
						: modelCallResults["paymentPlan.model.update"] || {};
				},
			},
		},
	});

	// Mock milestone.model service
	broker.createService({
		name: "milestone.model",
		actions: {
			create: {
				handler(ctx) {
					return typeof modelCallResults["milestone.model.create"] === "function"
						? modelCallResults["milestone.model.create"](ctx.params)
						: modelCallResults["milestone.model.create"] || {};
				},
			},
			get: {
				handler(ctx) {
					if (typeof modelCallResults["milestone.model.get"] === "function") {
						return modelCallResults["milestone.model.get"](ctx.params);
					}
					return modelCallResults["milestone.model.get"] || null;
				},
			},
			find: {
				handler(ctx) {
					return typeof modelCallResults["milestone.model.find"] === "function"
						? modelCallResults["milestone.model.find"](ctx.params)
						: modelCallResults["milestone.model.find"] || [];
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["milestone.model.update"] === "function"
						? modelCallResults["milestone.model.update"](ctx.params)
						: modelCallResults["milestone.model.update"] || {};
				},
			},
		},
	});

	// Load real paymentPlan service
	broker.createService(PaymentPlanService);

	return broker;
}

// ---- Tests ----

describe("PaymentPlan Service", () => {
	let broker;
	const originalEmit = null;

	beforeAll(async () => {
		broker = createBroker();
		await broker.start();
	});

	afterAll(async () => {
		await broker.stop();
	});

	beforeEach(() => {
		modelCallResults = {};
		emittedEvents = [];

		// Spy on broker.emit to capture emitted events
		jest.spyOn(broker, "emit").mockImplementation((event, payload) => {
			emittedEvents.push({ event, payload });
			return Promise.resolve();
		});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	// ========== createPlan ==========

	describe("createPlan", () => {
		it("should create a plan with correct milestones (3 milestones, amounts sum to total)", async () => {
			modelCallResults["booking.model.get"] = () => ({ ...mockBooking });

			const createdMilestones = [];
			modelCallResults["paymentPlan.model.create"] = (params) => ({
				_id: "plan-new",
				...params,
			});
			modelCallResults["milestone.model.create"] = (params) => {
				const ms = { _id: `ms-${createdMilestones.length + 1}`, ...params };
				createdMilestones.push(ms);
				return ms;
			};

			const result = await broker.call("paymentPlan.createPlan", {
				bookingId: "booking-1",
				totalAmount: 1000,
			});

			expect(result.paymentPlan).toBeDefined();
			expect(result.milestones).toHaveLength(3);

			// Amounts should sum to total
			const totalMilestoneAmount = result.milestones.reduce((sum, m) => sum + m.amount, 0);
			expect(totalMilestoneAmount).toBe(1000);

			// Plan fields
			expect(result.paymentPlan.totalAmount).toBe(1000);
			expect(result.paymentPlan.commitmentFeePercent).toBe(15);
			expect(result.paymentPlan.numberOfMilestones).toBe(3);
		});

		it("should set the first milestone as commitment fee with correct amount", async () => {
			modelCallResults["booking.model.get"] = () => ({ ...mockBooking });
			modelCallResults["paymentPlan.model.create"] = (params) => ({
				_id: "plan-new",
				...params,
			});
			modelCallResults["milestone.model.create"] = (params) => ({
				_id: `ms-${params.milestoneNumber}`,
				...params,
			});

			const result = await broker.call("paymentPlan.createPlan", {
				bookingId: "booking-1",
				totalAmount: 1000,
				commitmentFeePercent: 15,
			});

			const firstMilestone = result.milestones[0];
			expect(firstMilestone.label).toBe("Commitment Fee");
			expect(firstMilestone.amount).toBe(150);
			expect(firstMilestone.milestoneNumber).toBe(1);
		});

		it("should space milestone due dates 30 days apart", async () => {
			modelCallResults["booking.model.get"] = () => ({ ...mockBooking });
			modelCallResults["paymentPlan.model.create"] = (params) => ({
				_id: "plan-new",
				...params,
			});
			modelCallResults["milestone.model.create"] = (params) => ({
				_id: `ms-${params.milestoneNumber}`,
				...params,
			});

			const result = await broker.call("paymentPlan.createPlan", {
				bookingId: "booking-1",
				totalAmount: 1000,
				numberOfMilestones: 3,
			});

			const dueDates = result.milestones.map((m) => new Date(m.dueDate).getTime());

			// M2 should be ~30 days after M1
			const diffMs1to2 = dueDates[1] - dueDates[0];
			const diffDays1to2 = Math.round(diffMs1to2 / (24 * 60 * 60 * 1000));
			expect(diffDays1to2).toBe(30);

			// M3 should be ~30 days after M2
			const diffMs2to3 = dueDates[2] - dueDates[1];
			const diffDays2to3 = Math.round(diffMs2to3 / (24 * 60 * 60 * 1000));
			expect(diffDays2to3).toBe(30);
		});
	});

	// ========== getPlan ==========

	describe("getPlan", () => {
		it("should return plan with milestones for booking", async () => {
			modelCallResults["paymentPlan.model.find"] = () => [{ ...mockPaymentPlan }];
			modelCallResults["milestone.model.find"] = () => [...mockMilestones];

			const result = await broker.call(
				"paymentPlan.getPlan",
				{ bookingId: "booking-1" },
				{ meta: customerMeta() }
			);

			expect(result.paymentPlan._id).toBe("plan-1");
			expect(result.milestones).toHaveLength(3);
			expect(result.milestones[0].label).toBe("Commitment Fee");
		});

		it("should throw error if plan not found", async () => {
			modelCallResults["paymentPlan.model.find"] = () => [];

			await expect(
				broker.call(
					"paymentPlan.getPlan",
					{ bookingId: "nonexistent" },
					{ meta: customerMeta() }
				)
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.NOT_FOUND,
			});
		});
	});

	// ========== payMilestone ==========

	describe("payMilestone", () => {
		it("should mark milestone paid and update plan amounts", async () => {
			modelCallResults["milestone.model.get"] = () => ({ ...mockMilestones[0] });
			modelCallResults["milestone.model.update"] = (params) => ({
				...mockMilestones[0],
				status: params.status || mockMilestones[0].status,
				paidAt: params.paidAt,
				paymentId: params.paymentId,
			});
			modelCallResults["paymentPlan.model.get"] = () => ({ ...mockPaymentPlan });
			// Return milestones where ms-1 is being paid, others still pending
			modelCallResults["milestone.model.find"] = () => [
				{ ...mockMilestones[0], status: MILESTONE_STATUSES.PENDING },
				{ ...mockMilestones[1] },
				{ ...mockMilestones[2] },
			];
			modelCallResults["paymentPlan.model.update"] = (params) => ({
				...mockPaymentPlan,
				paidAmount: params.paidAmount,
				remainingAmount: params.remainingAmount,
				status: params.status || mockPaymentPlan.status,
			});

			const result = await broker.call(
				"paymentPlan.payMilestone",
				{ milestoneId: "ms-1", paymentId: "pay-1" },
				{ meta: customerMeta() }
			);

			expect(result.milestone.status).toBe(MILESTONE_STATUSES.PAID);
			expect(result.milestone.paymentId).toBe("pay-1");
			expect(result.paymentPlan.paidAmount).toBe(150);
			expect(result.paymentPlan.remainingAmount).toBe(850);
		});

		it("should complete plan when all milestones are paid", async () => {
			// Last milestone being paid
			modelCallResults["milestone.model.get"] = () => ({ ...mockMilestones[2] });
			modelCallResults["milestone.model.update"] = (params) => ({
				...mockMilestones[2],
				status: params.status || mockMilestones[2].status,
				paidAt: params.paidAt,
				paymentId: params.paymentId,
			});
			modelCallResults["paymentPlan.model.get"] = () => ({
				...mockPaymentPlan,
				paidAmount: 575, // first two already paid (150 + 425)
				remainingAmount: 425,
			});
			// All other milestones already paid
			modelCallResults["milestone.model.find"] = () => [
				{ ...mockMilestones[0], status: MILESTONE_STATUSES.PAID },
				{ ...mockMilestones[1], status: MILESTONE_STATUSES.PAID },
				{ ...mockMilestones[2], status: MILESTONE_STATUSES.PENDING }, // will match milestoneId
			];
			modelCallResults["paymentPlan.model.update"] = (params) => ({
				...mockPaymentPlan,
				paidAmount: params.paidAmount,
				remainingAmount: params.remainingAmount,
				status: params.status || mockPaymentPlan.status,
				completedAt: params.completedAt,
			});

			const result = await broker.call(
				"paymentPlan.payMilestone",
				{ milestoneId: "ms-3", paymentId: "pay-3" },
				{ meta: customerMeta() }
			);

			expect(result.paymentPlan.status).toBe(PAYMENT_PLAN_STATUSES.COMPLETED);
			expect(result.paymentPlan.completedAt).toBeDefined();
			expect(result.paymentPlan.paidAmount).toBe(1000);
			expect(result.paymentPlan.remainingAmount).toBe(0);
		});

		it("should throw MILESTONE_NOT_FOUND for invalid id", async () => {
			modelCallResults["milestone.model.get"] = () => {
				throw new Error("not found");
			};

			await expect(
				broker.call(
					"paymentPlan.payMilestone",
					{ milestoneId: "invalid-ms", paymentId: "pay-1" },
					{ meta: customerMeta() }
				)
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.MILESTONE_NOT_FOUND,
			});
		});

		it("should throw MILESTONE_ALREADY_PAID for already paid milestone", async () => {
			modelCallResults["milestone.model.get"] = () => ({
				...mockMilestones[0],
				status: MILESTONE_STATUSES.PAID,
				paidAt: "2026-04-01T12:00:00.000Z",
			});

			await expect(
				broker.call(
					"paymentPlan.payMilestone",
					{ milestoneId: "ms-1", paymentId: "pay-1" },
					{ meta: customerMeta() }
				)
			).rejects.toMatchObject({
				code: 422,
				type: ERROR_CODES.MILESTONE_ALREADY_PAID,
			});
		});
	});

	// ========== getNextDueMilestone ==========

	describe("getNextDueMilestone", () => {
		it("should return the next unpaid milestone", async () => {
			modelCallResults["milestone.model.find"] = () => [{ ...mockMilestones[1] }];

			const result = await broker.call(
				"paymentPlan.getNextDueMilestone",
				{ bookingId: "booking-1" },
				{ meta: customerMeta() }
			);

			expect(result).toBeDefined();
			expect(result._id).toBe("ms-2");
			expect(result.milestoneNumber).toBe(2);
		});
	});

	// ========== checkOverdue ==========

	describe("checkOverdue", () => {
		it("should mark past-due milestones as overdue", async () => {
			const pastDueMilestone = {
				...mockMilestones[0],
				dueDate: "2026-03-01T10:00:00.000Z", // past due
			};

			modelCallResults["milestone.model.find"] = () => [pastDueMilestone];
			modelCallResults["milestone.model.update"] = (params) => ({
				...pastDueMilestone,
				status: params.status,
				isOverdue: params.isOverdue,
			});

			const result = await broker.call("paymentPlan.checkOverdue");

			expect(result.updatedCount).toBe(1);

			// Verify the overdue event was emitted
			const overdueEvent = emittedEvents.find((e) => e.event === "paymentPlan.milestoneOverdue");
			expect(overdueEvent).toBeDefined();
			expect(overdueEvent.payload.milestoneId).toBe("ms-1");
		});
	});

	// ========== sendReminders ==========

	describe("sendReminders", () => {
		it("should emit reminder events for upcoming milestones", async () => {
			const upcomingMilestone = {
				...mockMilestones[1],
				dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
			};

			modelCallResults["milestone.model.find"] = () => [upcomingMilestone];
			modelCallResults["milestone.model.update"] = (params) => ({
				...upcomingMilestone,
				reminderSentAt: params.reminderSentAt,
			});

			const result = await broker.call("paymentPlan.sendReminders");

			expect(result.sentCount).toBe(1);

			// Verify the reminder event was emitted
			const reminderEvent = emittedEvents.find((e) => e.event === "paymentPlan.reminderDue");
			expect(reminderEvent).toBeDefined();
			expect(reminderEvent.payload.milestoneId).toBe("ms-2");
			expect(reminderEvent.payload.label).toBe("Second Payment");
		});
	});
});
