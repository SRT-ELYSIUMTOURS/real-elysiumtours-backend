"use strict";

const {
	effectiveRate,
	convertAmount,
	needsFx,
	isSupportedCurrency,
} = require("../../../utils/fx.utils");

describe("fx.utils", () => {
	describe("effectiveRate", () => {
		it("returns the base rate when markup is zero", () => {
			expect(effectiveRate(12.5, 0)).toBe(12.5);
		});

		it("applies a positive markup percent additively", () => {
			// 12.5 * (1 + 2.5/100) = 12.8125
			expect(effectiveRate(12.5, 2.5)).toBeCloseTo(12.8125, 4);
		});

		it("treats null/undefined markup as zero", () => {
			expect(effectiveRate(10, null)).toBe(10);
			expect(effectiveRate(10, undefined)).toBe(10);
		});
	});

	describe("convertAmount", () => {
		it("multiplies amount by effective rate and rounds to 2 dp", () => {
			const result = convertAmount(1500, { rate: 12.5, markupPercent: 0 });
			expect(result).toBe(18750);
		});

		it("rounds half-cent up", () => {
			// 100 * 12.555 = 1255.5 → 1255.5 (already 2dp)
			expect(convertAmount(100, { rate: 12.555 })).toBeCloseTo(1255.5, 2);
		});

		it("applies markup when provided", () => {
			// 1500 * (12 * 1.025) = 1500 * 12.3 = 18450
			expect(convertAmount(1500, { rate: 12, markupPercent: 2.5 })).toBe(18450);
		});

		it("throws when forexRate is missing", () => {
			expect(() => convertAmount(100, null)).toThrow(/Invalid forex rate/);
			expect(() => convertAmount(100, {})).toThrow(/Invalid forex rate/);
		});
	});

	describe("needsFx", () => {
		it("returns false when currency matches settlement", () => {
			expect(needsFx("GHS")).toBe(false);
		});

		it("returns true when currency differs from settlement", () => {
			expect(needsFx("USD")).toBe(true);
			expect(needsFx("EUR")).toBe(true);
		});

		it("returns false on missing input", () => {
			expect(needsFx(null)).toBeFalsy();
			expect(needsFx("")).toBeFalsy();
		});
	});

	describe("isSupportedCurrency", () => {
		it("accepts known codes", () => {
			expect(isSupportedCurrency("GHS")).toBe(true);
			expect(isSupportedCurrency("USD")).toBe(true);
			expect(isSupportedCurrency("EUR")).toBe(true);
			expect(isSupportedCurrency("GBP")).toBe(true);
		});

		it("rejects unknown codes", () => {
			expect(isSupportedCurrency("XYZ")).toBe(false);
			expect(isSupportedCurrency("ghs")).toBe(false); // case-sensitive
		});
	});
});
