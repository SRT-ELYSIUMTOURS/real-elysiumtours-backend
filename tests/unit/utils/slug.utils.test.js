"use strict";

const { generateSlug, generateUniqueSlug } = require("../../../utils/slug.utils");

describe("Slug Utils", () => {
	describe("generateSlug", () => {
		it("should convert text to lowercase kebab-case", () => {
			expect(generateSlug("Cape Coast Adventure")).toBe("cape-coast-adventure");
			expect(generateSlug("Accra City Tour")).toBe("accra-city-tour");
			expect(generateSlug("Hello World")).toBe("hello-world");
		});

		it("should remove special characters", () => {
			expect(generateSlug("Tour #1: Best & Greatest!")).toBe("tour-1-best-and-greatest");
			expect(generateSlug("Hello @World!")).toBe("hello-world");
			expect(generateSlug("Cape Coast (Premium)")).toBe("cape-coast-premium");
		});
	});

	describe("generateUniqueSlug", () => {
		it("should append suffix when slug exists in the list", () => {
			const existingSlugs = ["cape-coast-adventure", "accra-city-tour"];
			const result = generateUniqueSlug("Cape Coast Adventure", existingSlugs);

			expect(result).not.toBe("cape-coast-adventure");
			expect(result).toMatch(/^cape-coast-adventure-[a-z0-9]{4}$/);
		});

		it("should return original slug when no collision", () => {
			const existingSlugs = ["accra-city-tour"];
			const result = generateUniqueSlug("Cape Coast Adventure", existingSlugs);

			expect(result).toBe("cape-coast-adventure");
		});

		it("should return original slug when existingSlugs is empty", () => {
			const result = generateUniqueSlug("Cape Coast Adventure", []);

			expect(result).toBe("cape-coast-adventure");
		});

		it("should return original slug when existingSlugs is undefined", () => {
			const result = generateUniqueSlug("Cape Coast Adventure");

			expect(result).toBe("cape-coast-adventure");
		});
	});
});
