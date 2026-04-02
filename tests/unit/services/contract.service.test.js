"use strict";

const { ServiceBroker } = require("moleculer");
const ContractService = require("../../../services/contract.service");
const { ERROR_CODES, CONTRACT_STATUSES } = require("../../../utils/constants");

// ---- Test helpers ----

let modelCallResults = {};

function createBroker() {
	const broker = new ServiceBroker({
		logger: false,
		validator: true,
	});

	// Mock contract.model service
	broker.createService({
		name: "contract.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["contract.model.find"] === "function"
						? modelCallResults["contract.model.find"](ctx.params)
						: modelCallResults["contract.model.find"] || [];
				},
			},
			create: {
				handler(ctx) {
					return typeof modelCallResults["contract.model.create"] === "function"
						? modelCallResults["contract.model.create"](ctx.params)
						: modelCallResults["contract.model.create"] || {};
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["contract.model.update"] === "function"
						? modelCallResults["contract.model.update"](ctx.params)
						: modelCallResults["contract.model.update"] || {};
				},
			},
			get: {
				handler(ctx) {
					return typeof modelCallResults["contract.model.get"] === "function"
						? modelCallResults["contract.model.get"](ctx.params)
						: modelCallResults["contract.model.get"] || null;
				},
			},
			count: {
				handler(ctx) {
					return typeof modelCallResults["contract.model.count"] === "function"
						? modelCallResults["contract.model.count"](ctx.params)
						: modelCallResults["contract.model.count"] || 0;
				},
			},
		},
	});

	// Mock contractTemplate.model service
	broker.createService({
		name: "contractTemplate.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["contractTemplate.model.find"] === "function"
						? modelCallResults["contractTemplate.model.find"](ctx.params)
						: modelCallResults["contractTemplate.model.find"] || [];
				},
			},
			create: {
				handler(ctx) {
					return typeof modelCallResults["contractTemplate.model.create"] === "function"
						? modelCallResults["contractTemplate.model.create"](ctx.params)
						: modelCallResults["contractTemplate.model.create"] || {};
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["contractTemplate.model.update"] === "function"
						? modelCallResults["contractTemplate.model.update"](ctx.params)
						: modelCallResults["contractTemplate.model.update"] || {};
				},
			},
			get: {
				handler(ctx) {
					return typeof modelCallResults["contractTemplate.model.get"] === "function"
						? modelCallResults["contractTemplate.model.get"](ctx.params)
						: modelCallResults["contractTemplate.model.get"] || null;
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

	// Mock tourPackage.model service (used in generateFromBooking)
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

	// Load the real contract service
	const contractSvc = broker.createService(ContractService);

	return { broker, contractSvc };
}

// ---- Shared fixtures ----

const MOCK_TEMPLATE = {
	_id: "tmpl-001",
	name: "standard_tour_contract",
	title: "Elysium Tours \u2014 Contract for {{customerName}}",
	body: "<h1>Contract for {{customerName}}</h1><p>Booking: {{bookingRef}}, Tour: {{tourName}}, Amount: {{currency}} {{totalAmount}}</p>",
	version: 1,
	variables: ["customerName", "bookingRef", "tourName", "totalAmount", "currency"],
	cancellationClause: "Standard cancellation terms apply.",
	availabilityClause: "",
	isActive: true,
};

const MOCK_BOOKING = {
	_id: "booking-001",
	customerId: "customer-001",
	bookingRef: "ELY-20260401-ABC1",
	tourDate: "2026-06-15T00:00:00.000Z",
	groupSize: 4,
	totalAmount: 5000,
	currency: "GHS",
	bookingType: "packaged",
	packageId: "pkg-001",
	status: "pending_payment",
};

const MOCK_CONTRACT = {
	_id: "contract-001",
	templateId: "tmpl-001",
	bookingId: "booking-001",
	customerId: "customer-001",
	renderedTitle: "Elysium Tours \u2014 Contract for Valued Customer",
	renderedBody: "<h1>Contract for Valued Customer</h1><p>Booking: ELY-20260401-ABC1</p>",
	status: CONTRACT_STATUSES.DRAFT,
	signatureToken: "abc123token",
	createdAt: "2026-04-01T00:00:00.000Z",
};

// ---- Tests ----

describe("Contract Service", () => {
	let broker;
	let contractSvc;

	beforeAll(async () => {
		({ broker, contractSvc } = createBroker());
		await broker.start();
	});

	afterAll(async () => {
		await broker.stop();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		modelCallResults = {};
	});

	// ========== generateFromBooking ==========

	describe("generateFromBooking", () => {
		it("should create contract with rendered content from template", async () => {
			modelCallResults["booking.model.get"] = () => ({ ...MOCK_BOOKING });

			modelCallResults["contractTemplate.model.find"] = (params) => {
				if (params.query && params.query.name === "standard_tour_contract") {
					return [{ ...MOCK_TEMPLATE }];
				}
				return [];
			};

			modelCallResults["tourPackage.model.get"] = () => ({
				_id: "pkg-001",
				name: "Cape Coast Heritage Tour",
			});

			modelCallResults["contract.model.create"] = (params) => ({
				_id: "contract-new",
				...params,
			});

			const result = await broker.call("contract.generateFromBooking", {
				bookingId: "booking-001",
			});

			expect(result._id).toBe("contract-new");
			expect(result.bookingId).toBe("booking-001");
			expect(result.customerId).toBe("customer-001");
			expect(result.status).toBe(CONTRACT_STATUSES.DRAFT);
			expect(result.signatureToken).toBeDefined();
			expect(result.signatureToken.length).toBe(64); // 32 bytes hex
			expect(result.renderedTitle).toContain("Valued Customer");
			expect(result.renderedBody).toContain("Cape Coast Heritage Tour");
			expect(result.renderedBody).toContain("ELY-20260401-ABC1");
		});

		it("should throw error if booking not found", async () => {
			modelCallResults["booking.model.get"] = () => {
				throw new Error("Not found");
			};

			await expect(
				broker.call("contract.generateFromBooking", {
					bookingId: "nonexistent",
				})
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.BOOKING_NOT_FOUND,
			});
		});

		it("should throw TEMPLATE_NOT_FOUND if template does not exist", async () => {
			modelCallResults["booking.model.get"] = () => ({ ...MOCK_BOOKING });
			modelCallResults["contractTemplate.model.find"] = () => [];

			await expect(
				broker.call("contract.generateFromBooking", {
					bookingId: "booking-001",
					templateName: "nonexistent_template",
				})
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.TEMPLATE_NOT_FOUND,
			});
		});
	});

	// ========== sendToCustomer ==========

	describe("sendToCustomer", () => {
		it("should transition to sent with sentAt and expiresAt", async () => {
			modelCallResults["contract.model.get"] = () => ({
				...MOCK_CONTRACT,
				status: CONTRACT_STATUSES.DRAFT,
			});

			modelCallResults["contract.model.update"] = (params) => ({
				...MOCK_CONTRACT,
				...params,
				status: CONTRACT_STATUSES.SENT,
			});

			const result = await broker.call(
				"contract.sendToCustomer",
				{ contractId: "contract-001" },
				{ meta: { user: { id: "staff-001", role: "staff" } } }
			);

			expect(result.status).toBe(CONTRACT_STATUSES.SENT);
			expect(result.sentAt).toBeDefined();
			expect(result.expiresAt).toBeDefined();

			// expiresAt should be ~7 days after sentAt
			const sentAt = new Date(result.sentAt);
			const expiresAt = new Date(result.expiresAt);
			const diffDays = (expiresAt - sentAt) / (1000 * 60 * 60 * 24);
			expect(diffDays).toBeCloseTo(7, 0);
		});

		it("should throw error if contract not in draft status", async () => {
			modelCallResults["contract.model.get"] = () => ({
				...MOCK_CONTRACT,
				status: CONTRACT_STATUSES.SENT,
			});

			await expect(
				broker.call(
					"contract.sendToCustomer",
					{ contractId: "contract-001" },
					{ meta: { user: { id: "staff-001", role: "staff" } } }
				)
			).rejects.toMatchObject({
				code: 422,
				type: ERROR_CODES.VALIDATION_ERROR,
			});
		});
	});

	// ========== customerAccept ==========

	describe("customerAccept", () => {
		it("should accept contract and record IP + timestamp", async () => {
			const sentContract = {
				...MOCK_CONTRACT,
				status: CONTRACT_STATUSES.SENT,
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
			};

			modelCallResults["contract.model.find"] = (params) => {
				if (params.query && params.query.signatureToken === "abc123token") {
					return [sentContract];
				}
				return [];
			};

			modelCallResults["contract.model.update"] = (params) => ({
				...sentContract,
				...params,
				status: CONTRACT_STATUSES.ACCEPTED,
			});

			const result = await broker.call(
				"contract.customerAccept",
				{ signatureToken: "abc123token" },
				{ meta: { user: { id: "customer-001", role: "customer" }, clientIp: "192.168.1.100" } }
			);

			expect(result.message).toBe("Contract accepted successfully.");
			expect(result.contract.status).toBe(CONTRACT_STATUSES.ACCEPTED);
			expect(result.contract.acceptedAt).toBeDefined();
			expect(result.contract.acceptedByIp).toBe("192.168.1.100");
		});

		it("should throw error if contract expired", async () => {
			const expiredContract = {
				...MOCK_CONTRACT,
				status: CONTRACT_STATUSES.SENT,
				expiresAt: new Date(Date.now() - 1000).toISOString(), // expired 1 second ago
			};

			modelCallResults["contract.model.find"] = () => [expiredContract];

			await expect(
				broker.call(
					"contract.customerAccept",
					{ signatureToken: "abc123token" },
					{ meta: { user: { id: "customer-001", role: "customer" } } }
				)
			).rejects.toMatchObject({
				code: 422,
				type: ERROR_CODES.VALIDATION_ERROR,
			});
		});

		it("should throw error if customer does not own the contract", async () => {
			const sentContract = {
				...MOCK_CONTRACT,
				status: CONTRACT_STATUSES.SENT,
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
			};

			modelCallResults["contract.model.find"] = () => [sentContract];

			await expect(
				broker.call(
					"contract.customerAccept",
					{ signatureToken: "abc123token" },
					{ meta: { user: { id: "other-customer-999", role: "customer" } } }
				)
			).rejects.toMatchObject({
				code: 403,
				type: ERROR_CODES.FORBIDDEN,
			});
		});
	});

	// ========== customerReject ==========

	describe("customerReject", () => {
		it("should reject with reason", async () => {
			const sentContract = {
				...MOCK_CONTRACT,
				status: CONTRACT_STATUSES.SENT,
			};

			modelCallResults["contract.model.get"] = () => sentContract;

			modelCallResults["contract.model.update"] = (params) => ({
				...sentContract,
				...params,
				status: CONTRACT_STATUSES.REJECTED,
			});

			const result = await broker.call(
				"contract.customerReject",
				{ contractId: "contract-001", reason: "Terms are not acceptable." },
				{ meta: { user: { id: "customer-001", role: "customer" } } }
			);

			expect(result.status).toBe(CONTRACT_STATUSES.REJECTED);
			expect(result.rejectedAt).toBeDefined();
			expect(result.rejectionReason).toBe("Terms are not acceptable.");
		});
	});

	// ========== verifyAcceptance ==========

	describe("verifyAcceptance", () => {
		it("should return true when contract is accepted", async () => {
			modelCallResults["contract.model.find"] = (params) => {
				if (params.query && params.query.bookingId === "booking-001") {
					return [{ ...MOCK_CONTRACT, status: CONTRACT_STATUSES.ACCEPTED }];
				}
				return [];
			};

			const result = await broker.call("contract.verifyAcceptance", {
				bookingId: "booking-001",
			});

			expect(result.accepted).toBe(true);
			expect(result.contract).toBeDefined();
			expect(result.contract.status).toBe(CONTRACT_STATUSES.ACCEPTED);
		});

		it("should return false when no accepted contract exists", async () => {
			modelCallResults["contract.model.find"] = () => [];

			const result = await broker.call("contract.verifyAcceptance", {
				bookingId: "booking-999",
			});

			expect(result.accepted).toBe(false);
			expect(result.contract).toBeNull();
		});
	});

	// ========== getByBooking ==========

	describe("getByBooking", () => {
		it("should return contract for booking", async () => {
			modelCallResults["contract.model.find"] = (params) => {
				if (params.query && params.query.bookingId === "booking-001") {
					return [{ ...MOCK_CONTRACT }];
				}
				return [];
			};

			const result = await broker.call(
				"contract.getByBooking",
				{ bookingId: "booking-001" },
				{ meta: { user: { id: "customer-001", role: "customer" } } }
			);

			expect(result._id).toBe("contract-001");
			expect(result.bookingId).toBe("booking-001");
		});
	});

	// ========== listContracts ==========

	describe("listContracts", () => {
		it("should return paginated contracts (admin)", async () => {
			const contracts = [
				{ ...MOCK_CONTRACT, _id: "contract-001" },
				{ ...MOCK_CONTRACT, _id: "contract-002", bookingId: "booking-002" },
			];

			modelCallResults["contract.model.count"] = () => 2;
			modelCallResults["contract.model.find"] = () => contracts;

			const result = await broker.call(
				"contract.listContracts",
				{ page: 1, pageSize: 10 },
				{ meta: { user: { id: "admin-001", role: "admin" } } }
			);

			expect(result.contracts).toHaveLength(2);
			expect(result.total).toBe(2);
			expect(result.page).toBe(1);
			expect(result.pageSize).toBe(10);
		});
	});
});
