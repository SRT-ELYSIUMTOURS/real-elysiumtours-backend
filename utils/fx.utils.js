"use strict";

const { CURRENCIES, SETTLEMENT_CURRENCY } = require("./constants");

/**
 * Compute the effective rate accounting for an admin-entered markup.
 * `markupPercent` is in percentage points (e.g. 2.5 means +2.5%).
 */
function effectiveRate(rate, markupPercent) {
	const m = Number(markupPercent) || 0;
	return Number(rate) * (1 + m / 100);
}

/**
 * Convert a major-unit amount between currencies using a ForexRate document.
 * @param {number} amount - amount in fromCurrency (major unit, e.g. 1500 USD)
 * @param {{ rate: number, markupPercent?: number }} forexRate
 * @returns {number} amount in toCurrency, rounded to 2 dp
 */
function convertAmount(amount, forexRate) {
	if (!forexRate || typeof forexRate.rate !== "number") {
		throw new Error("Invalid forex rate.");
	}
	const eff = effectiveRate(forexRate.rate, forexRate.markupPercent);
	const converted = Number(amount) * eff;
	return Math.round(converted * 100) / 100;
}

/**
 * Decide whether FX conversion is needed for a given display currency.
 * Settlement is always SETTLEMENT_CURRENCY (GHS) — no-op if same.
 */
function needsFx(displayCurrency, settlementCurrency = SETTLEMENT_CURRENCY) {
	return displayCurrency && displayCurrency !== settlementCurrency;
}

/**
 * Whether a currency string is one we recognise.
 */
function isSupportedCurrency(currency) {
	return Object.values(CURRENCIES).includes(currency);
}

module.exports = {
	effectiveRate,
	convertAmount,
	needsFx,
	isSupportedCurrency,
};
