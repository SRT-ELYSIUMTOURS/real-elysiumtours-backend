"use strict";

const path = require("path");
const ApiService = require("../../../services/api.service");

// ─── Route ↔ action param contract ────────────────────────────────────────────
// moleculer-web maps a URL placeholder `:foo` to ctx.params.foo. If an action
// declares a REQUIRED param that the route never supplies — because the alias
// spells the placeholder differently — every call 422s at the validator before
// the handler runs.
//
// This is exactly how `POST /:id/confirm-partner` → booking.confirmPartner
// (which declares `bookingId`) stayed silently dead. These tests make that
// class of bug fail here instead of in production.

// Params that identify the resource addressed by the path. These MUST be
// supplied by a URL placeholder — a query string or body can't be relied on,
// and a placeholder spelled differently (`:id` for an action wanting
// `bookingId`) is the exact failure this suite exists to catch.
//
// Non-id params (`lat`, `lng`, `query`, `period`, `password`, …) legitimately
// arrive via query string or request body, so they are out of scope here.
const isResourceIdParam = (name) => /^[a-z][A-Za-z0-9]*Id$/.test(name);

// Sub-resource ids that address a nested entity supplied in the body of a
// write, rather than the path (e.g. which partner to confirm on a booking).
const BODY_SUPPLIED_IDS = new Set([
	"partnerId",
	"oldPartnerId",
	"newPartnerId",
	"packageId",
	"quoteId",
	// paymentPlan.payMilestone: the milestone is addressed by the path, while
	// paymentId references the separate Payment record settling it.
	"paymentId",
]);

function loadService(serviceName) {
	// Model services live under services/models/<domain>/, regular ones flat.
	const candidates = [
		path.join(__dirname, "../../../services", `${serviceName}.service.js`),
	];
	for (const p of candidates) {
		try {
			return require(p);
		} catch (err) {
			if (err.code !== "MODULE_NOT_FOUND") throw err;
		}
	}
	return null;
}

/** Extract `:param` names from an alias path, e.g. "/:bookingId/x/:partnerId". */
function urlParams(aliasPath) {
	return (aliasPath.match(/:([A-Za-z0-9_]+)/g) || []).map((s) => s.slice(1));
}

/** Required (non-optional) param names declared by an action definition. */
function requiredParams(actionDef) {
	const params = actionDef && actionDef.params;
	if (!params || typeof params !== "object") return [];

	return Object.entries(params)
		.filter(([key]) => !key.startsWith("$$"))
		.filter(([, spec]) => {
			if (typeof spec === "string") return !spec.includes("optional");
			if (spec && typeof spec === "object") return spec.optional !== true;
			return false;
		})
		.map(([key]) => key);
}

/** Flatten every alias across every route into a comparable list. */
function collectAliases() {
	const rows = [];
	for (const route of ApiService.settings.routes || []) {
		for (const [alias, target] of Object.entries(route.aliases || {})) {
			if (typeof target !== "string") continue; // skip custom handlers
			const spaceIdx = alias.indexOf(" ");
			const method = spaceIdx === -1 ? "GET" : alias.slice(0, spaceIdx);
			const aliasPath = spaceIdx === -1 ? alias : alias.slice(spaceIdx + 1);
			// moleculer-web supports handler prefixes, e.g. "stream:media.upload".
			const action = target.includes(":") ? target.slice(target.indexOf(":") + 1) : target;
			const dotIdx = action.lastIndexOf(".");
			rows.push({
				route: route.path,
				method,
				aliasPath,
				target,
				serviceName: action.slice(0, dotIdx),
				actionName: action.slice(dotIdx + 1),
			});
		}
	}
	return rows;
}

const aliases = collectAliases();

describe("api.service route ↔ action param contract", () => {
	it("collects aliases from the route table", () => {
		expect(aliases.length).toBeGreaterThan(50);
	});

	it("every alias targets an action that exists on its service", () => {
		const missing = [];
		for (const row of aliases) {
			// Model services aren't routed directly; skip anything dotted deeper.
			if (row.serviceName.includes(".")) continue;
			const svc = loadService(row.serviceName);
			if (!svc) {
				missing.push(`${row.target} — service file not found`);
				continue;
			}
			if (!svc.actions || !svc.actions[row.actionName]) {
				missing.push(
					`${row.method} ${row.route}${row.aliasPath} → ${row.target} — action not defined`
				);
			}
		}
		expect(missing).toEqual([]);
	});

	// The core contract: when a route has placeholders at all, any required
	// resource-id param the action declares must be spelled the same way in the
	// path. Catches `:id` → action wanting `bookingId`/`organizationId`.
	it("every required resource-id param matches a URL placeholder on its route", () => {
		const violations = [];

		for (const row of aliases) {
			if (row.serviceName.includes(".")) continue;
			const svc = loadService(row.serviceName);
			if (!svc || !svc.actions || !svc.actions[row.actionName]) continue;

			const fromUrl = new Set(urlParams(row.aliasPath));
			// Collection-level routes (no placeholder) address no single resource.
			if (fromUrl.size === 0) continue;

			for (const param of requiredParams(svc.actions[row.actionName])) {
				if (!isResourceIdParam(param)) continue;
				if (BODY_SUPPLIED_IDS.has(param)) continue;
				if (fromUrl.has(param)) continue;

				violations.push(
					`${row.method} ${row.route}${row.aliasPath} → ${row.target}: ` +
						`requires '${param}' but URL provides [${[...fromUrl].join(", ")}]`
				);
			}
		}

		expect(violations).toEqual([]);
	});

	// Explicit regression pins for the four booking endpoints that were dead.
	describe("booking partner/substitution aliases (regression)", () => {
		const bookingRows = aliases.filter((r) => r.serviceName === "booking");

		it.each([
			["booking.confirmPartner", "bookingId"],
			["booking.rejectPartner", "bookingId"],
			["booking.suggestSubstitution", "bookingId"],
			["booking.acceptSubstitution", "bookingId"],
			["booking.getTransitions", "bookingId"],
		])("%s alias supplies :%s from the URL", (target, expectedParam) => {
			const rows = bookingRows.filter((r) => r.target === target);
			expect(rows.length).toBeGreaterThan(0);

			for (const row of rows) {
				expect(urlParams(row.aliasPath)).toContain(expectedParam);
			}
		});

		it("updateStatus and cancelBooking still use :id (they declare `id`)", () => {
			for (const target of ["booking.updateStatus", "booking.cancelBooking"]) {
				const rows = bookingRows.filter((r) => r.target === target);
				expect(rows.length).toBeGreaterThan(0);
				for (const row of rows) {
					expect(urlParams(row.aliasPath)).toContain("id");
				}
			}
		});
	});
});
