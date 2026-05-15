"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const { ERROR_CODES, CURRENCIES, SETTLEMENT_CURRENCY } = require("../utils/constants");
const { effectiveRate, convertAmount, isSupportedCurrency } = require("../utils/fx.utils");

const MAX_RATE_AGE_DAYS = parseInt(process.env.FOREX_RATE_MAX_AGE_DAYS, 10) || 7;

module.exports = {
	name: "forexRate",

	dependencies: ["forexRate.model"],

	actions: {
		/**
		 * Create a new exchange rate (admin only).
		 * Old rates for the same pair stay active — getCurrent picks the most recent.
		 */
		create: {
			auth: "required",
			role: "admin",
			params: {
				fromCurrency: "string",
				toCurrency: "string",
				rate: { type: "number", positive: true, convert: true },
				markupPercent: { type: "number", optional: true, convert: true },
				effectiveDate: "string|optional",
				expiresAt: "string|optional",
				source: "string|optional",
				note: "string|optional",
			},
			async handler(ctx) {
				const {
					fromCurrency,
					toCurrency,
					rate,
					markupPercent,
					effectiveDate,
					expiresAt,
					source,
					note,
				} = ctx.params;

				if (!isSupportedCurrency(fromCurrency) || !isSupportedCurrency(toCurrency)) {
					throw new MoleculerClientError(
						"Unsupported currency.",
						422,
						ERROR_CODES.UNSUPPORTED_CURRENCY,
						{ fromCurrency, toCurrency }
					);
				}

				if (fromCurrency === toCurrency) {
					throw new MoleculerClientError(
						"fromCurrency and toCurrency must differ.",
						422,
						ERROR_CODES.VALIDATION_ERROR,
						{ fromCurrency, toCurrency }
					);
				}

				const created = await ctx.call(
					"forexRate.model.create",
					{
						fromCurrency,
						toCurrency,
						rate,
						markupPercent: markupPercent || 0,
						effectiveDate: effectiveDate || new Date().toISOString(),
						expiresAt,
						source: source || "manual",
						note,
						createdBy: ctx.meta.user && ctx.meta.user.id,
						isActive: true,
					},
					{ meta: ctx.meta }
				);

				return created;
			},
		},

		/**
		 * Update an existing rate (admin only).
		 */
		update: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
				rate: { type: "number", optional: true, convert: true },
				markupPercent: { type: "number", optional: true, convert: true },
				expiresAt: "string|optional",
				note: "string|optional",
				isActive: "boolean|optional",
			},
			async handler(ctx) {
				const { id, ...rest } = ctx.params;

				const existing = await ctx.call(
					"forexRate.model.get",
					{ id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Forex rate not found.",
						404,
						ERROR_CODES.FOREX_RATE_NOT_FOUND,
						{ id }
					);
				}

				return ctx.call(
					"forexRate.model.update",
					{ id, ...rest },
					{ meta: ctx.meta }
				);
			},
		},

		/**
		 * List rates with optional filters (admin only).
		 */
		list: {
			auth: "required",
			role: "admin",
			params: {
				fromCurrency: "string|optional",
				toCurrency: "string|optional",
				isActive: "boolean|optional",
				page: { type: "number", optional: true, convert: true },
				pageSize: { type: "number", optional: true, convert: true },
			},
			async handler(ctx) {
				const { fromCurrency, toCurrency, isActive, page, pageSize } = ctx.params;

				const query = {};
				if (fromCurrency) query.fromCurrency = fromCurrency;
				if (toCurrency) query.toCurrency = toCurrency;
				if (typeof isActive === "boolean") query.isActive = isActive;

				const params = { query, sort: "-effectiveDate" };
				if (page) params.page = page;
				if (pageSize) params.pageSize = pageSize;

				return ctx.call("forexRate.model.find", params, { meta: ctx.meta });
			},
		},

		/**
		 * Get the most recent active rate for a currency pair.
		 * Internal action — used by payment.service at FX-lock time.
		 *
		 * Returns null if currencies are identical (1:1, no conversion needed).
		 * Throws if no usable rate found.
		 */
		getCurrent: {
			auth: undefined,
			params: {
				fromCurrency: "string",
				toCurrency: { type: "string", optional: true, default: SETTLEMENT_CURRENCY },
			},
			async handler(ctx) {
				const { fromCurrency } = ctx.params;
				const toCurrency = ctx.params.toCurrency || SETTLEMENT_CURRENCY;

				if (!isSupportedCurrency(fromCurrency) || !isSupportedCurrency(toCurrency)) {
					throw new MoleculerClientError(
						"Unsupported currency.",
						422,
						ERROR_CODES.UNSUPPORTED_CURRENCY,
						{ fromCurrency, toCurrency }
					);
				}

				if (fromCurrency === toCurrency) {
					return null;
				}

				const now = new Date();

				const rates = await ctx.call(
					"forexRate.model.find",
					{
						query: {
							fromCurrency,
							toCurrency,
							isActive: true,
							effectiveDate: { $lte: now.toISOString() },
						},
						sort: "-effectiveDate",
						limit: 1,
					},
					{ meta: ctx.meta }
				);

				const rate = rates && rates.length > 0 ? rates[0] : null;

				if (!rate) {
					throw new MoleculerClientError(
						`No active forex rate found for ${fromCurrency} -> ${toCurrency}.`,
						422,
						ERROR_CODES.FOREX_RATE_NOT_FOUND,
						{ fromCurrency, toCurrency }
					);
				}

				if (rate.expiresAt && new Date(rate.expiresAt) < now) {
					throw new MoleculerClientError(
						`Latest ${fromCurrency} -> ${toCurrency} rate has expired.`,
						422,
						ERROR_CODES.FOREX_RATE_STALE,
						{ rateId: rate._id, expiresAt: rate.expiresAt }
					);
				}

				const ageDays = (now - new Date(rate.effectiveDate)) / (1000 * 60 * 60 * 24);
				if (ageDays > MAX_RATE_AGE_DAYS) {
					this.logger.warn(
						`Forex rate ${fromCurrency} -> ${toCurrency} is ${ageDays.toFixed(1)} days old.`
					);
				}

				return rate;
			},
		},

		/**
		 * Convert an amount between two currencies using the most recent active rate.
		 * Returns { amount, fromCurrency, toCurrency, rate, fxRate (the doc), effectiveRate }.
		 * If currencies match, returns the input amount with rate=1.
		 */
		convert: {
			auth: undefined,
			params: {
				amount: { type: "number", positive: true, convert: true },
				fromCurrency: "string",
				toCurrency: { type: "string", optional: true, default: SETTLEMENT_CURRENCY },
			},
			async handler(ctx) {
				const { amount, fromCurrency } = ctx.params;
				const toCurrency = ctx.params.toCurrency || SETTLEMENT_CURRENCY;

				if (fromCurrency === toCurrency) {
					return {
						amount,
						fromCurrency,
						toCurrency,
						rate: 1,
						effectiveRate: 1,
						fxRate: null,
					};
				}

				const rateDoc = await ctx.call(
					"forexRate.getCurrent",
					{ fromCurrency, toCurrency },
					{ meta: ctx.meta }
				);

				if (!rateDoc) {
					return {
						amount,
						fromCurrency,
						toCurrency,
						rate: 1,
						effectiveRate: 1,
						fxRate: null,
					};
				}

				const eff = effectiveRate(rateDoc.rate, rateDoc.markupPercent);
				const converted = convertAmount(amount, rateDoc);

				return {
					amount: converted,
					fromCurrency,
					toCurrency,
					rate: rateDoc.rate,
					effectiveRate: eff,
					fxRate: rateDoc,
				};
			},
		},

		/**
		 * Deactivate a rate (soft delete; admin only).
		 */
		deactivate: {
			auth: "required",
			role: "admin",
			params: {
				id: "string",
			},
			async handler(ctx) {
				const existing = await ctx.call(
					"forexRate.model.get",
					{ id: ctx.params.id },
					{ meta: ctx.meta }
				).catch(() => null);

				if (!existing) {
					throw new MoleculerClientError(
						"Forex rate not found.",
						404,
						ERROR_CODES.FOREX_RATE_NOT_FOUND,
						{ id: ctx.params.id }
					);
				}

				return ctx.call(
					"forexRate.model.update",
					{ id: ctx.params.id, isActive: false },
					{ meta: ctx.meta }
				);
			},
		},
	},
};
