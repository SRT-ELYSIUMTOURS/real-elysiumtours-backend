"use strict";

const mongoose = require("mongoose");
const DbService = require("../../../mixins/db.mixin");

const CountrySchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},
		slug: {
			type: String,
			unique: true,
			lowercase: true,
		},
		flagColors: {
			type: [String],
			default: [],
		},
		currency: { type: String },
		languages: { type: String },
		mainAirport: { type: String },
		timeZone: { type: String },
		// Hero section — optional editorial
		heroTitle: { type: String },
		heroSubtitle: { type: String },
		// "Why [Country]" section — optional editorial
		whyTitle: { type: String },
		whyParagraphs: {
			type: [String],
			default: [],
		},
		whyStats: {
			type: [
				{
					label: { type: String },
					value: { type: String },
				},
			],
			default: [],
		},
		whyImage: { type: String },
		whyImageTitle: { type: String },
		whyImageSubtitle: { type: String },
		isActive: {
			type: Boolean,
			default: true,
		},
	},
	{
		timestamps: true,
		collection: "countries",
	}
);

CountrySchema.index({ slug: 1 });
CountrySchema.index({ isActive: 1 });
CountrySchema.index({ name: "text" }, { weights: { name: 10 }, name: "country_text_search" });

module.exports = {
	name: "country.model",
	mixins: [DbService("countries")],
	model: CountrySchema,

	settings: {
		fields: [
			"_id",
			"name",
			"slug",
			"flagColors",
			"currency",
			"languages",
			"mainAirport",
			"timeZone",
			"heroTitle",
			"heroSubtitle",
			"whyTitle",
			"whyParagraphs",
			"whyStats",
			"whyImage",
			"whyImageTitle",
			"whyImageSubtitle",
			"isActive",
			"createdAt",
			"updatedAt",
		],
		entityValidator: {
			name: "string",
			slug: "string|optional",
			flagColors: "array|optional",
			currency: "string|optional",
			languages: "string|optional",
			mainAirport: "string|optional",
			timeZone: "string|optional",
			heroTitle: "string|optional",
			heroSubtitle: "string|optional",
			whyTitle: "string|optional",
			whyParagraphs: "array|optional",
			whyStats: "array|optional",
			whyImage: "string|optional",
			whyImageTitle: "string|optional",
			whyImageSubtitle: "string|optional",
			isActive: "boolean|optional",
		},
	},

	afterConnected() {
		this.logger.info("Country model service connected to database");
	},
};
