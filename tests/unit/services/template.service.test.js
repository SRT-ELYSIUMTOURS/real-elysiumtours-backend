"use strict";

const { ServiceBroker } = require("moleculer");
const TemplateService = require("../../../services/template.service");
const { ERROR_CODES } = require("../../../utils/constants");

// ---- Test helpers ----

let modelCallResults = {};

function createBroker() {
	const broker = new ServiceBroker({
		logger: false,
		validator: true,
	});

	// Mock template.model service
	broker.createService({
		name: "template.model",
		actions: {
			find: {
				handler(ctx) {
					return typeof modelCallResults["template.model.find"] === "function"
						? modelCallResults["template.model.find"](ctx.params)
						: modelCallResults["template.model.find"] || [];
				},
			},
			create: {
				handler(ctx) {
					return typeof modelCallResults["template.model.create"] === "function"
						? modelCallResults["template.model.create"](ctx.params)
						: modelCallResults["template.model.create"] || {};
				},
			},
			update: {
				handler(ctx) {
					return typeof modelCallResults["template.model.update"] === "function"
						? modelCallResults["template.model.update"](ctx.params)
						: modelCallResults["template.model.update"] || {};
				},
			},
			get: {
				handler(ctx) {
					return typeof modelCallResults["template.model.get"] === "function"
						? modelCallResults["template.model.get"](ctx.params)
						: modelCallResults["template.model.get"] || null;
				},
			},
		},
	});

	// Load the real template service
	const templateSvc = broker.createService(TemplateService);

	return { broker, templateSvc };
}

// ---- Tests ----

describe("Template Service", () => {
	let broker;
	let templateSvc;

	beforeAll(async () => {
		({ broker, templateSvc } = createBroker());
		await broker.start();
	});

	afterAll(async () => {
		await broker.stop();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		modelCallResults = {};
	});

	// ========== create ==========

	describe("create", () => {
		it("should create a template on happy path", async () => {
			// No existing template with that name
			modelCallResults["template.model.find"] = () => [];

			const createdDoc = {
				_id: "tmpl-001",
				name: "test_template",
				subject: "Hello {{name}}",
				body: "<p>Welcome, {{name}}!</p>",
				channel: "email",
				variables: ["name"],
			};
			modelCallResults["template.model.create"] = (params) => ({
				_id: "tmpl-001",
				...params,
			});

			const result = await broker.call(
				"template.create",
				{
					name: "test_template",
					subject: "Hello {{name}}",
					body: "<p>Welcome, {{name}}!</p>",
					variables: ["name"],
				},
				{ meta: { user: { id: "admin1", role: "admin" } } }
			);

			expect(result._id).toBe("tmpl-001");
			expect(result.name).toBe("test_template");
			expect(result.subject).toBe("Hello {{name}}");
			expect(result.channel).toBe("email");
		});
	});

	// ========== getByName ==========

	describe("getByName", () => {
		it("should return a template by name", async () => {
			const tmpl = {
				_id: "tmpl-001",
				name: "otp_verification",
				subject: "Your Verification Code",
				body: "<p>Your OTP is {{otp}}</p>",
				channel: "email",
			};

			modelCallResults["template.model.find"] = (params) => {
				if (params.query && params.query.name === "otp_verification") {
					return [tmpl];
				}
				return [];
			};

			const result = await broker.call("template.getByName", {
				name: "otp_verification",
			});

			expect(result._id).toBe("tmpl-001");
			expect(result.name).toBe("otp_verification");
		});

		it("should throw TEMPLATE_NOT_FOUND for unknown name", async () => {
			modelCallResults["template.model.find"] = () => [];

			await expect(
				broker.call("template.getByName", { name: "nonexistent_template" })
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.TEMPLATE_NOT_FOUND,
			});
		});
	});

	// ========== render ==========

	describe("render", () => {
		it("should render Handlebars template with data (subject and body)", async () => {
			const tmpl = {
				_id: "tmpl-002",
				name: "welcome_email",
				subject: "Welcome, {{firstName}}!",
				body: "<h1>Hello {{firstName}} {{lastName}}</h1>",
				channel: "email",
			};

			modelCallResults["template.model.find"] = (params) => {
				if (params.query && params.query.name === "welcome_email") {
					return [tmpl];
				}
				return [];
			};

			const result = await broker.call("template.render", {
				templateName: "welcome_email",
				data: { firstName: "Jane", lastName: "Doe" },
			});

			expect(result.subject).toBe("Welcome, Jane!");
			expect(result.body).toBe("<h1>Hello Jane Doe</h1>");
			expect(result.channel).toBe("email");
		});

		it("should throw TEMPLATE_NOT_FOUND if template does not exist", async () => {
			modelCallResults["template.model.find"] = () => [];

			await expect(
				broker.call("template.render", {
					templateName: "nonexistent_template",
					data: { foo: "bar" },
				})
			).rejects.toMatchObject({
				code: 404,
				type: ERROR_CODES.TEMPLATE_NOT_FOUND,
			});
		});
	});

	// ========== list ==========

	describe("list", () => {
		it("should return an array of templates", async () => {
			const templates = [
				{ _id: "tmpl-001", name: "welcome_email", channel: "email" },
				{ _id: "tmpl-002", name: "otp_verification", channel: "email" },
			];

			modelCallResults["template.model.find"] = () => templates;

			const result = await broker.call(
				"template.list",
				{},
				{ meta: { user: { id: "admin1", role: "admin" } } }
			);

			expect(Array.isArray(result)).toBe(true);
			expect(result).toHaveLength(2);
			expect(result[0].name).toBe("welcome_email");
			expect(result[1].name).toBe("otp_verification");
		});
	});

	// ========== seedDefaults ==========

	describe("seedDefaults", () => {
		it("should create default templates when none exist", async () => {
			const createdNames = [];

			// No existing templates
			modelCallResults["template.model.find"] = () => [];

			modelCallResults["template.model.create"] = (params) => {
				createdNames.push(params.name);
				return { _id: `tmpl-${createdNames.length}`, ...params };
			};

			const result = await broker.call(
				"template.seedDefaults",
				{},
				{ meta: { user: { id: "admin1", role: "admin" } } }
			);

			expect(result.seeded).toBeDefined();
			expect(Array.isArray(result.seeded)).toBe(true);
			expect(result.seeded.length).toBeGreaterThan(0);

			// All should be "created" since none exist
			result.seeded.forEach((entry) => {
				expect(entry.action).toBe("created");
			});

			// Verify known default template names were created
			const seededNames = result.seeded.map((e) => e.name);
			expect(seededNames).toContain("welcome_email");
			expect(seededNames).toContain("otp_verification");
			expect(seededNames).toContain("password_reset");
		});
	});
});
