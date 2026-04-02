"use strict";

const { createClient } = require("@sanity/client");
const sanityConfig = require("../config/sanity.config");

let client = null;

function getSanityClient() {
	if (!client) {
		if (!sanityConfig.projectId) {
			console.warn("[Sanity] No SANITY_PROJECT_ID configured — CMS features disabled");
			return null;
		}
		client = createClient({
			projectId: sanityConfig.projectId,
			dataset: sanityConfig.dataset,
			apiVersion: sanityConfig.apiVersion,
			token: sanityConfig.token,
			useCdn: sanityConfig.useCdn,
		});
	}
	return client;
}

module.exports = { getSanityClient };
