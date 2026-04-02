"use strict";

const crypto = require("crypto");
const Handlebars = require("handlebars");
const { MoleculerClientError } = require("moleculer").Errors;
const { ERROR_CODES, CONTRACT_STATUSES } = require("../utils/constants");
const { CONTRACT_TRANSITIONS, isValidTransition } = require("../config/bookingStates.config");

module.exports = {
	name: "contract",

	dependencies: ["contract.model", "contractTemplate.model", "booking.model"],

	actions: {
		/**
		 * Create a new contract template.
		 * Requires admin role.
		 */
		createTemplate: {
			auth: "required",
			role: "admin",
			params: {
				name: "string",
				title: "string",
				body: "string",
				variables: { type: "array", optional: true, items: "string" },
				cancellationClause: { type: "string", optional: true },
				availabilityClause: { type: "string", optional: true },
			},
			async handler(ctx) {
				const { name, title, body, variables, cancellationClause, availabilityClause } = ctx.params;

				const existing = await ctx.call("contractTemplate.model.find", {
					query: { name },
				});
				if (existing && existing.length > 0) {
					throw new MoleculerClientError(
						`Contract template "${name}" already exists.`,
						409,
						ERROR_CODES.VALIDATION_ERROR,
						{ name }
					);
				}

				return ctx.call("contractTemplate.model.create", {
					name,
					title,
					body,
					variables: variables || [],
					cancellationClause: cancellationClause || undefined,
					availabilityClause: availabilityClause || undefined,
				});
			},
		},

		/**
		 * Update a contract template.
		 * Increments version on update.
		 * Requires admin role.
		 */
		updateTemplate: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
				name: { type: "string", optional: true },
				title: { type: "string", optional: true },
				body: { type: "string", optional: true },
				variables: { type: "array", optional: true, items: "string" },
				cancellationClause: { type: "string", optional: true },
				availabilityClause: { type: "string", optional: true },
				isActive: { type: "boolean", optional: true },
			},
			async handler(ctx) {
				const { id, ...updates } = ctx.params;

				const template = await ctx.call("contractTemplate.model.get", { id }).catch(() => null);
				if (!template) {
					throw new MoleculerClientError(
						"Contract template not found.",
						404,
						ERROR_CODES.TEMPLATE_NOT_FOUND,
						{ id }
					);
				}

				const cleanUpdates = {};
				Object.keys(updates).forEach((key) => {
					if (updates[key] !== undefined) {
						cleanUpdates[key] = updates[key];
					}
				});

				// Increment version
				cleanUpdates.version = (template.version || 1) + 1;

				return ctx.call("contractTemplate.model.update", { id, ...cleanUpdates });
			},
		},

		/**
		 * List all contract templates.
		 * Requires admin role.
		 */
		listTemplates: {
			auth: "required",
			role: "admin",
			async handler(ctx) {
				return ctx.call("contractTemplate.model.find", { query: {} });
			},
		},

		/**
		 * Get a contract template by ID.
		 * Requires staff role.
		 */
		getTemplate: {
			auth: "required",
			role: "staff",
			params: {
				id: "string",
			},
			async handler(ctx) {
				const template = await ctx.call("contractTemplate.model.get", { id: ctx.params.id }).catch(() => null);
				if (!template) {
					throw new MoleculerClientError(
						"Contract template not found.",
						404,
						ERROR_CODES.TEMPLATE_NOT_FOUND,
						{ id: ctx.params.id }
					);
				}
				return template;
			},
		},

		/**
		 * Generate a contract from a booking.
		 * Internal action — called when a booking is created or confirmed.
		 */
		generateFromBooking: {
			auth: undefined,
			params: {
				bookingId: "string",
				templateName: { type: "string", optional: true },
			},
			async handler(ctx) {
				const { bookingId, templateName } = ctx.params;

				// Fetch booking
				const booking = await ctx.call("booking.model.get", { id: bookingId }).catch(() => null);
				if (!booking) {
					throw new MoleculerClientError(
						"Booking not found.",
						404,
						ERROR_CODES.BOOKING_NOT_FOUND,
						{ bookingId }
					);
				}

				// Find contract template
				const tmplName = templateName || "standard_tour_contract";
				const templates = await ctx.call("contractTemplate.model.find", {
					query: { name: tmplName, isActive: true },
					limit: 1,
				});

				if (!templates || templates.length === 0) {
					throw new MoleculerClientError(
						"Contract template not found.",
						404,
						ERROR_CODES.TEMPLATE_NOT_FOUND,
						{ templateName: tmplName }
					);
				}

				const template = templates[0];

				// Resolve customer name
				const customerId = booking.customerId?._id
					? booking.customerId._id.toString()
					: booking.customerId.toString();

				// Derive tour name from package or booking ref
				let tourName = "Tour";
				if (booking.packageId) {
					const pkg = await ctx.call("tourPackage.model.get", {
						id: booking.packageId._id
							? booking.packageId._id.toString()
							: booking.packageId.toString(),
					}).catch(() => null);
					if (pkg) {
						tourName = pkg.name || pkg.title || "Tour Package";
					}
				}

				// Build template data
				const templateData = {
					customerName: booking.customerName || "Valued Customer",
					bookingRef: booking.bookingRef,
					tourName,
					totalAmount: booking.totalAmount,
					currency: booking.currency || "GHS",
					groupSize: booking.groupSize,
					tourDate: booking.tourDate
						? new Date(booking.tourDate).toLocaleDateString("en-GB", {
							day: "numeric",
							month: "long",
							year: "numeric",
						})
						: "To be confirmed",
					cancellationPolicy: template.cancellationClause || "Standard cancellation terms apply.",
					availabilityClause: template.availabilityClause || "",
					today: new Date().toLocaleDateString("en-GB", {
						day: "numeric",
						month: "long",
						year: "numeric",
					}),
				};

				// Compile template
				const renderedTitle = this.compileTemplate(template.title, templateData);
				const renderedBody = this.compileTemplate(template.body, templateData);

				// Generate unique signature token
				const signatureToken = crypto.randomBytes(32).toString("hex");

				// Create contract
				const contract = await ctx.call("contract.model.create", {
					templateId: template._id.toString(),
					bookingId,
					customerId,
					renderedTitle,
					renderedBody,
					status: CONTRACT_STATUSES.DRAFT,
					signatureToken,
				});

				return contract;
			},
		},

		/**
		 * Send a contract to the customer.
		 * Transitions from draft to sent.
		 * Requires staff role.
		 */
		sendToCustomer: {
			auth: "required",
			role: "staff",
			params: {
				contractId: "string",
			},
			async handler(ctx) {
				const { contractId } = ctx.params;

				const contract = await ctx.call("contract.model.get", { id: contractId }).catch(() => null);
				if (!contract) {
					throw new MoleculerClientError(
						"Contract not found.",
						404,
						ERROR_CODES.CONTRACT_NOT_FOUND,
						{ contractId }
					);
				}

				if (contract.status !== CONTRACT_STATUSES.DRAFT) {
					throw new MoleculerClientError(
						`Cannot send contract. Current status is "${contract.status}", expected "draft".`,
						422,
						ERROR_CODES.VALIDATION_ERROR,
						{ contractId, currentStatus: contract.status }
					);
				}

				// Validate transition
				if (!isValidTransition(CONTRACT_TRANSITIONS, contract.status, CONTRACT_STATUSES.SENT)) {
					throw new MoleculerClientError(
						"Invalid contract status transition.",
						422,
						ERROR_CODES.VALIDATION_ERROR,
						{ from: contract.status, to: CONTRACT_STATUSES.SENT }
					);
				}

				const now = new Date();
				const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

				const updated = await ctx.call("contract.model.update", {
					id: contractId,
					status: CONTRACT_STATUSES.SENT,
					sentAt: now.toISOString(),
					expiresAt: expiresAt.toISOString(),
				});

				ctx.emit("contract.sent", {
					contractId,
					bookingId: contract.bookingId?._id
						? contract.bookingId._id.toString()
						: contract.bookingId.toString(),
					customerId: contract.customerId?._id
						? contract.customerId._id.toString()
						: contract.customerId.toString(),
					signatureToken: contract.signatureToken,
				});

				return updated;
			},
		},

		/**
		 * Customer accepts the contract.
		 * Requires authentication.
		 */
		customerAccept: {
			auth: "required",
			params: {
				signatureToken: "string",
			},
			async handler(ctx) {
				const { signatureToken } = ctx.params;

				const contracts = await ctx.call("contract.model.find", {
					query: { signatureToken },
					limit: 1,
				});

				if (!contracts || contracts.length === 0) {
					throw new MoleculerClientError(
						"Contract not found.",
						404,
						ERROR_CODES.CONTRACT_NOT_FOUND,
						{ signatureToken }
					);
				}

				const contract = contracts[0];

				// Validate status
				if (contract.status !== CONTRACT_STATUSES.SENT) {
					throw new MoleculerClientError(
						`Cannot accept contract. Current status is "${contract.status}", expected "sent".`,
						422,
						ERROR_CODES.VALIDATION_ERROR,
						{ currentStatus: contract.status }
					);
				}

				// Validate not expired
				if (contract.expiresAt && new Date(contract.expiresAt) < new Date()) {
					throw new MoleculerClientError(
						"Contract has expired.",
						422,
						ERROR_CODES.VALIDATION_ERROR,
						{ expiresAt: contract.expiresAt }
					);
				}

				// Validate ownership
				const contractCustomerId = contract.customerId?._id
					? contract.customerId._id.toString()
					: contract.customerId.toString();

				if (contractCustomerId !== ctx.meta.user.id) {
					throw new MoleculerClientError(
						"You do not have permission to accept this contract.",
						403,
						ERROR_CODES.FORBIDDEN
					);
				}

				const now = new Date();
				const acceptedByIp = ctx.meta.clientIp || ctx.meta.ip || "unknown";

				const updated = await ctx.call("contract.model.update", {
					id: contract._id.toString(),
					status: CONTRACT_STATUSES.ACCEPTED,
					acceptedAt: now.toISOString(),
					acceptedByIp,
				});

				const bookingId = contract.bookingId?._id
					? contract.bookingId._id.toString()
					: contract.bookingId.toString();

				ctx.emit("contract.accepted", {
					bookingId,
					contractId: contract._id.toString(),
				});

				return {
					contract: updated,
					message: "Contract accepted successfully.",
				};
			},
		},

		/**
		 * Customer rejects the contract.
		 * Requires authentication.
		 */
		customerReject: {
			auth: "required",
			params: {
				contractId: "string",
				reason: { type: "string", optional: true },
			},
			async handler(ctx) {
				const { contractId, reason } = ctx.params;

				const contract = await ctx.call("contract.model.get", { id: contractId }).catch(() => null);
				if (!contract) {
					throw new MoleculerClientError(
						"Contract not found.",
						404,
						ERROR_CODES.CONTRACT_NOT_FOUND,
						{ contractId }
					);
				}

				// Validate ownership
				const contractCustomerId = contract.customerId?._id
					? contract.customerId._id.toString()
					: contract.customerId.toString();

				if (contractCustomerId !== ctx.meta.user.id) {
					throw new MoleculerClientError(
						"You do not have permission to reject this contract.",
						403,
						ERROR_CODES.FORBIDDEN
					);
				}

				// Validate transition
				if (!isValidTransition(CONTRACT_TRANSITIONS, contract.status, CONTRACT_STATUSES.REJECTED)) {
					throw new MoleculerClientError(
						`Cannot reject contract. Current status is "${contract.status}".`,
						422,
						ERROR_CODES.VALIDATION_ERROR,
						{ currentStatus: contract.status }
					);
				}

				const now = new Date();
				const updated = await ctx.call("contract.model.update", {
					id: contractId,
					status: CONTRACT_STATUSES.REJECTED,
					rejectedAt: now.toISOString(),
					rejectionReason: reason || undefined,
				});

				ctx.emit("contract.rejected", {
					contractId,
					bookingId: contract.bookingId?._id
						? contract.bookingId._id.toString()
						: contract.bookingId.toString(),
					reason,
				});

				return updated;
			},
		},

		/**
		 * Get contract by booking ID.
		 * Validates customer ownership or staff/admin access.
		 */
		getByBooking: {
			auth: "required",
			params: {
				bookingId: "string",
			},
			async handler(ctx) {
				const { bookingId } = ctx.params;

				const contracts = await ctx.call("contract.model.find", {
					query: { bookingId },
					limit: 1,
				});

				if (!contracts || contracts.length === 0) {
					throw new MoleculerClientError(
						"Contract not found for this booking.",
						404,
						ERROR_CODES.CONTRACT_NOT_FOUND,
						{ bookingId }
					);
				}

				const contract = contracts[0];
				const user = ctx.meta.user;

				// Customer can only see their own contracts
				if (user.role === "customer") {
					const contractCustomerId = contract.customerId?._id
						? contract.customerId._id.toString()
						: contract.customerId.toString();

					if (contractCustomerId !== user.id) {
						throw new MoleculerClientError(
							"You do not have access to this contract.",
							403,
							ERROR_CODES.FORBIDDEN,
							{ bookingId }
						);
					}
				}

				return contract;
			},
		},

		/**
		 * Verify that a contract has been accepted for a booking.
		 * Internal action — called by booking service before confirming.
		 */
		verifyAcceptance: {
			auth: undefined,
			params: {
				bookingId: "string",
			},
			async handler(ctx) {
				const { bookingId } = ctx.params;

				const contracts = await ctx.call("contract.model.find", {
					query: { bookingId },
					limit: 1,
				});

				if (!contracts || contracts.length === 0) {
					return { accepted: false, contract: null };
				}

				const contract = contracts[0];
				return {
					accepted: contract.status === CONTRACT_STATUSES.ACCEPTED,
					contract,
				};
			},
		},

		/**
		 * List contracts with optional filters (admin).
		 */
		listContracts: {
			auth: "required",
			role: "admin",
			params: {
				status: { type: "string", optional: true },
				page: { type: "number", integer: true, positive: true, optional: true },
				pageSize: { type: "number", integer: true, positive: true, optional: true },
			},
			async handler(ctx) {
				const { status, page = 1, pageSize = 10 } = ctx.params;
				const query = {};

				if (status) query.status = status;

				const total = await ctx.call("contract.model.count", { query });

				const contracts = await ctx.call("contract.model.find", {
					query,
					sort: "-createdAt",
					offset: (page - 1) * pageSize,
					limit: pageSize,
				});

				return { contracts, total, page, pageSize };
			},
		},

		/**
		 * Seed default contract templates.
		 * Requires admin role.
		 */
		seedDefaultTemplates: {
			auth: "required",
			role: "admin",
			async handler(ctx) {
				const defaults = this.getDefaultContractTemplates();
				const results = [];

				for (const tmpl of defaults) {
					const existing = await ctx.call("contractTemplate.model.find", {
						query: { name: tmpl.name },
					});

					if (existing && existing.length > 0) {
						await ctx.call("contractTemplate.model.update", {
							id: existing[0]._id.toString(),
							title: tmpl.title,
							body: tmpl.body,
							variables: tmpl.variables,
							cancellationClause: tmpl.cancellationClause,
							availabilityClause: tmpl.availabilityClause,
							version: (existing[0].version || 1) + 1,
						});
						results.push({ name: tmpl.name, action: "updated" });
					} else {
						await ctx.call("contractTemplate.model.create", tmpl);
						results.push({ name: tmpl.name, action: "created" });
					}
				}

				this.logger.info(`Seeded ${results.length} default contract templates.`);
				return { seeded: results };
			},
		},
	},

	events: {
		/**
		 * Auto-generate a contract when a booking is created.
		 */
		async "booking.created"(payload) {
			const bookingId = payload.bookingId?._id
				? payload.bookingId._id.toString()
				: payload.bookingId.toString();

			try {
				const templateName = payload.bookingType === "dynamic"
					? "dynamic_tour_contract"
					: "standard_tour_contract";

				await this.broker.call("contract.generateFromBooking", {
					bookingId,
					templateName,
				});

				this.logger.info(`Contract auto-generated for booking ${bookingId}`);
			} catch (err) {
				this.logger.warn(`Failed to auto-generate contract for booking ${bookingId}: ${err.message}`);
			}
		},
	},

	methods: {
		/**
		 * Compile a Handlebars template string with provided data.
		 *
		 * @param {String} templateStr - Handlebars template string
		 * @param {Object} data - Data to inject into the template
		 * @returns {String} Rendered string
		 */
		compileTemplate(templateStr, data) {
			const compiled = Handlebars.compile(templateStr);
			return compiled(data || {});
		},

		/**
		 * Returns default contract template definitions.
		 *
		 * @returns {Array<Object>}
		 */
		getDefaultContractTemplates() {
			const standardCancellation =
				"Cancellation more than 30 days before departure: full refund less 10% administrative fee. " +
				"Cancellation 15-30 days before departure: 50% refund. " +
				"Cancellation less than 15 days before departure: no refund. " +
				"All cancellations must be submitted in writing.";

			const groupCancellation =
				"Group cancellation more than 45 days before departure: full refund less 10% administrative fee. " +
				"Group cancellation 30-45 days before departure: 50% refund. " +
				"Group cancellation 15-30 days before departure: 25% refund. " +
				"Group cancellation less than 15 days before departure: no refund. " +
				"Individual withdrawals from a group booking may incur supplementary charges for remaining members. " +
				"All cancellations must be submitted in writing.";

			const availabilityClause =
				"Services described herein are subject to availability at the time of confirmation. " +
				"Elysium Tours reserves the right to offer suitable alternatives of equal or greater value " +
				"should any component become unavailable. The customer will be notified promptly of any changes.";

			return [
				{
					name: "standard_tour_contract",
					title: "Elysium Tours \u2014 Tour Booking Contract",
					body: `<div style="font-family: 'Georgia', serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333;">
  <div style="text-align: center; border-bottom: 2px solid #2c3e50; padding-bottom: 20px; margin-bottom: 30px;">
    <h1 style="color: #2c3e50; margin: 0;">Elysium Tours</h1>
    <h2 style="color: #7f8c8d; font-weight: normal; margin: 5px 0 0 0;">Tour Booking Contract</h2>
  </div>

  <p style="text-align: right; color: #7f8c8d;">Date: {{today}}</p>

  <h3 style="color: #2c3e50;">1. Parties</h3>
  <p>This contract is entered into between <strong>Elysium Tours Ltd.</strong> ("the Operator") and <strong>{{customerName}}</strong> ("the Customer") for the provision of tour services as described below.</p>

  <h3 style="color: #2c3e50;">2. Tour Details</h3>
  <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Booking Reference</td><td style="padding: 8px; border: 1px solid #ddd;">{{bookingRef}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Tour</td><td style="padding: 8px; border: 1px solid #ddd;">{{tourName}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Travel Date</td><td style="padding: 8px; border: 1px solid #ddd;">{{tourDate}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Group Size</td><td style="padding: 8px; border: 1px solid #ddd;">{{groupSize}} person(s)</td></tr>
  </table>

  <h3 style="color: #2c3e50;">3. Financial Terms</h3>
  <p>The total cost of the tour is <strong>{{currency}} {{totalAmount}}</strong>. Payment is due in accordance with the payment schedule provided separately. A commitment fee of 15% of the total amount is required to secure the booking.</p>

  <h3 style="color: #2c3e50;">4. Cancellation Policy</h3>
  <p>{{cancellationPolicy}}</p>

  <h3 style="color: #2c3e50;">5. General Terms</h3>
  <p>The Operator reserves the right to modify itineraries due to unforeseen circumstances including but not limited to weather, safety concerns, or local regulations. The Operator will make every reasonable effort to provide equivalent alternatives.</p>

  <h3 style="color: #2c3e50;">6. Acceptance</h3>
  <p>By accepting this contract, the Customer acknowledges that they have read, understood, and agreed to all terms and conditions set forth herein. Digital acceptance is legally binding and the acceptance timestamp and IP address are recorded for verification.</p>

  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd;">
    <p><strong>Elysium Tours Ltd.</strong></p>
    <p>Accra, Ghana</p>
  </div>
</div>`,
					variables: [
						"customerName",
						"bookingRef",
						"tourName",
						"tourDate",
						"groupSize",
						"totalAmount",
						"currency",
						"cancellationPolicy",
						"today",
					],
					cancellationClause: standardCancellation,
					availabilityClause: "",
				},
				{
					name: "dynamic_tour_contract",
					title: "Elysium Tours \u2014 Custom Tour Booking Contract",
					body: `<div style="font-family: 'Georgia', serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333;">
  <div style="text-align: center; border-bottom: 2px solid #2c3e50; padding-bottom: 20px; margin-bottom: 30px;">
    <h1 style="color: #2c3e50; margin: 0;">Elysium Tours</h1>
    <h2 style="color: #7f8c8d; font-weight: normal; margin: 5px 0 0 0;">Custom Tour Booking Contract</h2>
  </div>

  <p style="text-align: right; color: #7f8c8d;">Date: {{today}}</p>

  <h3 style="color: #2c3e50;">1. Parties</h3>
  <p>This contract is entered into between <strong>Elysium Tours Ltd.</strong> ("the Operator") and <strong>{{customerName}}</strong> ("the Customer") for the provision of custom tour services as described below.</p>

  <h3 style="color: #2c3e50;">2. Tour Details</h3>
  <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Booking Reference</td><td style="padding: 8px; border: 1px solid #ddd;">{{bookingRef}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Tour</td><td style="padding: 8px; border: 1px solid #ddd;">{{tourName}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Travel Date</td><td style="padding: 8px; border: 1px solid #ddd;">{{tourDate}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Group Size</td><td style="padding: 8px; border: 1px solid #ddd;">{{groupSize}} person(s)</td></tr>
  </table>

  <h3 style="color: #2c3e50;">3. Financial Terms</h3>
  <p>The total cost of the tour is <strong>{{currency}} {{totalAmount}}</strong>. Payment is due in accordance with the payment schedule provided separately. A commitment fee of 15% of the total amount is required to secure the booking.</p>

  <h3 style="color: #2c3e50;">4. Subject to Availability</h3>
  <p>{{availabilityClause}}</p>

  <h3 style="color: #2c3e50;">5. Cancellation Policy</h3>
  <p>{{cancellationPolicy}}</p>

  <h3 style="color: #2c3e50;">6. Custom Tour Terms</h3>
  <p>This is a custom-designed tour itinerary. The final itinerary, accommodation, and transport arrangements are subject to confirmation by the Operator. Any modifications to the agreed itinerary requested by the Customer after contract acceptance may incur additional charges.</p>

  <h3 style="color: #2c3e50;">7. General Terms</h3>
  <p>The Operator reserves the right to modify itineraries due to unforeseen circumstances including but not limited to weather, safety concerns, or local regulations. The Operator will make every reasonable effort to provide equivalent alternatives.</p>

  <h3 style="color: #2c3e50;">8. Acceptance</h3>
  <p>By accepting this contract, the Customer acknowledges that they have read, understood, and agreed to all terms and conditions set forth herein. Digital acceptance is legally binding and the acceptance timestamp and IP address are recorded for verification.</p>

  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd;">
    <p><strong>Elysium Tours Ltd.</strong></p>
    <p>Accra, Ghana</p>
  </div>
</div>`,
					variables: [
						"customerName",
						"bookingRef",
						"tourName",
						"tourDate",
						"groupSize",
						"totalAmount",
						"currency",
						"cancellationPolicy",
						"availabilityClause",
						"today",
					],
					cancellationClause: standardCancellation,
					availabilityClause,
				},
				{
					name: "group_tour_contract",
					title: "Elysium Tours \u2014 Group Tour Booking Contract",
					body: `<div style="font-family: 'Georgia', serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333;">
  <div style="text-align: center; border-bottom: 2px solid #2c3e50; padding-bottom: 20px; margin-bottom: 30px;">
    <h1 style="color: #2c3e50; margin: 0;">Elysium Tours</h1>
    <h2 style="color: #7f8c8d; font-weight: normal; margin: 5px 0 0 0;">Group Tour Booking Contract</h2>
  </div>

  <p style="text-align: right; color: #7f8c8d;">Date: {{today}}</p>

  <h3 style="color: #2c3e50;">1. Parties</h3>
  <p>This contract is entered into between <strong>Elysium Tours Ltd.</strong> ("the Operator") and <strong>{{customerName}}</strong> ("the Group Leader / Customer") for the provision of group tour services as described below.</p>

  <h3 style="color: #2c3e50;">2. Tour Details</h3>
  <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Booking Reference</td><td style="padding: 8px; border: 1px solid #ddd;">{{bookingRef}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Tour</td><td style="padding: 8px; border: 1px solid #ddd;">{{tourName}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Travel Date</td><td style="padding: 8px; border: 1px solid #ddd;">{{tourDate}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Group Size</td><td style="padding: 8px; border: 1px solid #ddd;">{{groupSize}} person(s)</td></tr>
  </table>

  <h3 style="color: #2c3e50;">3. Financial Terms</h3>
  <p>The total cost of the group tour is <strong>{{currency}} {{totalAmount}}</strong>. Payment is due in accordance with the payment schedule provided separately. A commitment fee of 15% of the total amount is required to secure the group booking. The Group Leader is responsible for collecting and remitting payments from all group members.</p>

  <h3 style="color: #2c3e50;">4. Group-Specific Terms</h3>
  <p>The minimum group size must be maintained for the quoted price to remain valid. Should the group size fall below the minimum, the Operator reserves the right to adjust pricing accordingly. The Group Leader is the primary point of contact and is responsible for communicating all tour information to group members.</p>

  <h3 style="color: #2c3e50;">5. Cancellation Policy</h3>
  <p>{{cancellationPolicy}}</p>

  <h3 style="color: #2c3e50;">6. General Terms</h3>
  <p>The Operator reserves the right to modify itineraries due to unforeseen circumstances including but not limited to weather, safety concerns, or local regulations. The Operator will make every reasonable effort to provide equivalent alternatives.</p>

  <h3 style="color: #2c3e50;">7. Acceptance</h3>
  <p>By accepting this contract, the Customer acknowledges that they have read, understood, and agreed to all terms and conditions set forth herein on behalf of the entire group. Digital acceptance is legally binding and the acceptance timestamp and IP address are recorded for verification.</p>

  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd;">
    <p><strong>Elysium Tours Ltd.</strong></p>
    <p>Accra, Ghana</p>
  </div>
</div>`,
					variables: [
						"customerName",
						"bookingRef",
						"tourName",
						"tourDate",
						"groupSize",
						"totalAmount",
						"currency",
						"cancellationPolicy",
						"today",
					],
					cancellationClause: groupCancellation,
					availabilityClause: "",
				},
			];
		},
	},
};
