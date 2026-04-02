"use strict";

module.exports = {
	projectId: process.env.SANITY_PROJECT_ID,
	dataset: process.env.SANITY_DATASET || "production",
	apiVersion: process.env.SANITY_API_VERSION || "2024-01-01",
	token: process.env.SANITY_API_TOKEN,
	useCdn: process.env.NODE_ENV === "production",
};
