"use strict";

const https = require("https");
const crypto = require("crypto");
const paystackConfig = require("../../config/paystack.config");

/**
 * Paystack API mixin for Moleculer services.
 * Wraps Paystack HTTPS calls using the native `https` module.
 */
module.exports = {
	methods: {
		/**
		 * Make an HTTPS request to the Paystack API.
		 * @param {string} method - HTTP method (GET, POST, etc.)
		 * @param {string} path - API path (e.g. "/transaction/initialize")
		 * @param {Object} [data] - Request body for POST/PUT requests
		 * @returns {Promise<Object>} Parsed JSON response
		 */
		paystackRequest(method, path, data) {
			return new Promise((resolve, reject) => {
				const url = new URL(path, paystackConfig.baseUrl);

				const options = {
					hostname: url.hostname,
					port: 443,
					path: url.pathname,
					method: method.toUpperCase(),
					headers: {
						Authorization: `Bearer ${paystackConfig.secretKey}`,
						"Content-Type": "application/json",
						Accept: "application/json",
					},
				};

				const req = https.request(options, (res) => {
					let body = "";

					res.on("data", (chunk) => {
						body += chunk;
					});

					res.on("end", () => {
						try {
							const parsed = JSON.parse(body);
							if (res.statusCode >= 200 && res.statusCode < 300) {
								resolve(parsed);
							} else {
								const err = new Error(parsed.message || "Paystack API error");
								err.statusCode = res.statusCode;
								err.response = parsed;
								reject(err);
							}
						} catch (parseErr) {
							reject(new Error(`Failed to parse Paystack response: ${body}`));
						}
					});
				});

				req.on("error", (err) => {
					reject(err);
				});

				if (data && method.toUpperCase() !== "GET") {
					req.write(JSON.stringify(data));
				}

				req.end();
			});
		},

		/**
		 * Initialize a Paystack transaction.
		 * POST /transaction/initialize
		 *
		 * @param {Object} params
		 * @param {string} params.email - Customer email
		 * @param {number} params.amount - Amount in major currency unit (GHS). Will be converted to pesewas.
		 * @param {string} [params.currency] - Currency code (default: GHS)
		 * @param {string} [params.reference] - Unique transaction reference
		 * @param {string} [params.callbackUrl] - Callback URL after payment
		 * @param {Object} [params.metadata] - Extra metadata
		 * @returns {Promise<{authorization_url: string, access_code: string, reference: string}>}
		 */
		async initializeTransaction({ email, amount, currency, reference, callbackUrl, metadata }) {
			const payload = {
				email,
				amount: Math.round(amount * 100), // Convert to pesewas (smallest unit)
				currency: currency || paystackConfig.currency,
				channels: paystackConfig.channels,
			};

			if (reference) payload.reference = reference;
			if (callbackUrl) payload.callback_url = callbackUrl;
			if (metadata) payload.metadata = metadata;

			const response = await this.paystackRequest("POST", "/transaction/initialize", payload);
			return response.data;
		},

		/**
		 * Verify a Paystack transaction.
		 * GET /transaction/verify/:reference
		 *
		 * @param {string} reference - Transaction reference
		 * @returns {Promise<Object>} Transaction data including status
		 */
		async verifyTransaction(reference) {
			const response = await this.paystackRequest("GET", `/transaction/verify/${encodeURIComponent(reference)}`);
			return response.data;
		},

		/**
		 * Create a Paystack refund.
		 * POST /refund
		 *
		 * @param {Object} params
		 * @param {string} params.transaction - Transaction reference or ID
		 * @param {number} [params.amount] - Amount to refund in major currency unit. Will be converted to pesewas.
		 * @param {string} [params.reason] - Reason for refund
		 * @returns {Promise<Object>} Refund data
		 */
		async createRefund({ transaction, amount, reason }) {
			const payload = { transaction };

			if (amount) {
				payload.amount = Math.round(amount * 100); // Convert to pesewas
			}
			if (reason) {
				payload.customer_note = reason;
				payload.merchant_note = reason;
			}

			const response = await this.paystackRequest("POST", "/refund", payload);
			return response.data;
		},

		/**
		 * Validate a Paystack webhook signature using HMAC-SHA512.
		 * @param {string} body - Raw request body string
		 * @param {string} signature - x-paystack-signature header value
		 * @returns {boolean}
		 */
		validateWebhookSignature(body, signature) {
			const hash = crypto
				.createHmac("sha512", paystackConfig.webhookSecret)
				.update(body)
				.digest("hex");
			return hash === signature;
		},
	},
};
