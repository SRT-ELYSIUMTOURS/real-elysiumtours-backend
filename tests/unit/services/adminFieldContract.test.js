"use strict";

const { ServiceBroker } = require("moleculer");

// ─── Admin field contract ─────────────────────────────────────────────────────
// The admin panel writes through these five create/update actions. Two rules
// must hold for every one of them, or the panel silently loses data or leaks
// privilege:
//
//   1. Every field the admin form sends MUST reach the model  (no silent drops)
//   2. Server-controlled fields MUST NOT reach the model      (no mass assignment)
//
// Rule 2 is enforced by `$$strict: "remove"` on each action's params. Note that
// Moleculer's validator does NOT strip undeclared params by default — without
// that flag these handlers' `...rest` spreads forward anything a client sends
// straight into Mongoose. That was the live vulnerability this suite pins shut.
//
// Rule 1 regressions look like "I filled the field in, saved, reopened, and it
// was blank" — the exact symptom that motivated this work.

const SERVICES = {
	destination: require("../../../services/destination.service"),
	attraction: require("../../../services/attraction.service"),
	dining: require("../../../services/dining.service"),
	hotelPartner: require("../../../services/hotelPartner.service"),
	tourPackage: require("../../../services/tourPackage.service"),
};

// Which model service each admin action writes through.
const WRITES_TO = {
	destination: "destination.model",
	attraction: "attraction.model",
	dining: "diningPartner.model",
	hotelPartner: "hotelPartner.model",
	tourPackage: "tourPackage.model",
};

// Fields the client must never be able to set. `slug` is generated from the
// name/title; the counters are maintained by their owning services;
// organizationId is stamped by tenantScope.middleware on create only.
const SERVER_CONTROLLED = [
	"rating",
	"reviewCount",
	"viewCount",
	"bookingCount",
	"tourCount",
	"location",
];

// Minimum valid payload per resource, plus the full set of fields the admin
// forms now collect (used for the passthrough assertions).
const FIXTURES = {
	destination: {
		required: { name: "Test Destination", region: "Volta Region" },
		full: {
			description: "A place",
			country: "Ghana",
			subtitle: "By the lake",
			coverImage: "https://img/cover.jpg",
			bestTimeToVisit: "December",
			aboutText: "Long form copy",
			travelTips: ["Bring water"],
			highlights: ["Waterfall"],
			images: ["https://img/1.jpg"],
			weather: { avgTemp: 30, bestMonths: ["January"] },
		},
	},
	attraction: {
		required: { name: "Test Attraction", destinationId: "dest-1" },
		full: {
			category: "museum",
			entryFee: 50,
			description: "Exhibits",
			coverImage: "https://img/cover.jpg",
			images: ["https://img/1.jpg"],
			duration: "2 hours",
			suitableFor: ["Families"],
			operatingHours: { open: "09:00", close: "17:00", weekdays: "Mon-Fri" },
			contactInfo: { phone: "0200000000", email: "a@b.com" },
		},
	},
	dining: {
		required: { name: "Test Restaurant", destinationId: "dest-1" },
		full: {
			cuisineType: "Ghanaian",
			// tier and priceRange are DISTINCT fields with different vocabularies.
			tier: "standard",
			priceRange: "moderate",
			commissionRate: 0.1,
			coverImage: "https://img/cover.jpg",
			images: ["https://img/1.jpg"],
			openingHours: { open: "10:00", close: "22:00", closedDays: ["Monday"] },
			contactInfo: { phone: "0200000000", contactPerson: "Kofi" },
			menuOptions: [{ name: "Jollof", description: "Rice", pricePerPerson: 60 }],
		},
	},
	hotelPartner: {
		required: { name: "Test Hotel", destinationId: "dest-1", tier: "standard" },
		full: {
			shortDescription: "Nice",
			priceRange: "premium",
			starRating: 4,
			coverImage: "https://img/cover.jpg",
			images: ["https://img/1.jpg"],
			amenities: ["wifi"],
			commissionRate: 0.12,
			inventoryModel: "free_sale",
			contractStatus: "active",
			availabilityStatus: "available",
			rateData: { standardRate: 400 },
			packages: [{ id: "p1", title: "Weekend", price: "500" }],
			contactInfo: { phone: "0200000000", address: "Accra" },
		},
	},
	tourPackage: {
		required: { title: "Test Tour", destinationId: "dest-1", durationDays: 3 },
		full: {
			description: "A tour",
			coverImage: "https://img/cover.jpg",
			images: ["https://img/1.jpg"],
			basePrice: 1000,
			category: "leisure",
			featured: true,
			tags: ["Heritage"],
			bestFor: ["Alumni"],
			route: "A to B",
			meetingPointLabel: "Achimota",
			meetingPoint: { lat: 5.6, lng: -0.2 },
			bookingCutoffHours: 48,
			waitlistEnabled: true,
			maxWaitlistSize: 30,
			tourHighlights: [{ title: "Falls", image: "https://img/h.jpg" }],
			bookingAddOns: [{ id: "a1", label: "Guide", priceGhc: 200 }],
			packingList: [{ text: "Hat" }],
			categoryRatings: [{ label: "Value", score: 4.5 }],
			importantInformation: { blocks: [{ title: "Visa", body: "ID" }] },
			businessAmenities: { items: ["Wifi"] },
			accommodationOptions: [
				{ label: "Option A", pricing: [{ roomType: "single", pricePerPerson: 900 }] },
			],
		},
	},
};

// Every model service any of the five depends on, stubbed so brokers start.
const ALL_MODELS = [
	"destination.model",
	"attraction.model",
	"diningPartner.model",
	"hotelPartner.model",
	"tourPackage.model",
	"packagePricing.model",
	"review.model",
	"waitlistEntry.model",
];

let captured = null;

function createBroker(serviceName) {
	const broker = new ServiceBroker({ logger: false, validator: true });
	const target = WRITES_TO[serviceName];

	for (const model of ALL_MODELS) {
		const isTarget = model === target;
		broker.createService({
			name: model,
			actions: {
				// destination.model.get must resolve for the partner services'
				// "does the destination exist" guard.
				get: {
					handler: () => ({ _id: "dest-1", name: "Existing", region: "Volta Region" }),
				},
				find: { handler: () => [] },
				count: { handler: () => 0 },
				create: {
					handler(ctx) {
						if (isTarget) captured = ctx.params;
						return { _id: "new-id", ...ctx.params };
					},
				},
				update: {
					handler(ctx) {
						if (isTarget) captured = ctx.params;
						return { _id: ctx.params.id, ...ctx.params };
					},
				},
			},
		});
	}

	broker.createService(SERVICES[serviceName]);
	return broker;
}

const adminMeta = { user: { _id: "admin-1", role: "admin" } };

describe("admin write contract", () => {
	const names = Object.keys(SERVICES);

	// ── Static: the whitelist must be authoritative ────────────────────────────
	describe.each(names)("%s params", (name) => {
		it.each(["create", "update"])("%s declares $$strict: 'remove'", (action) => {
			const def = SERVICES[name].actions[action];
			expect(def).toBeDefined();
			// Without this, undeclared params flow through to Mongoose untouched.
			expect(def.params.$$strict).toBe("remove");
		});

		it.each(["create", "update"])(
			"%s does not expose server-controlled fields",
			(action) => {
				const declared = Object.keys(SERVICES[name].actions[action].params);
				const leaked = declared.filter((k) => SERVER_CONTROLLED.includes(k));
				expect(leaked).toEqual([]);
			}
		);
	});

	// ── Behavioural: passthrough + strip ──────────────────────────────────────
	describe.each(names)("%s writes", (name) => {
		let broker;

		beforeAll(async () => {
			broker = createBroker(name);
			await broker.start();
		});

		afterAll(async () => {
			await broker.stop();
		});

		beforeEach(() => {
			captured = null;
		});

		it("forwards every admin-form field to the model on create", async () => {
			const { required, full } = FIXTURES[name];
			await broker.call(`${name}.create`, { ...required, ...full }, { meta: adminMeta });

			expect(captured).not.toBeNull();
			// Each key the form collects must survive to the model layer.
			for (const key of Object.keys(full)) {
				expect(captured[key]).toBeDefined();
			}
		});

		it("strips server-controlled and unknown fields on create", async () => {
			const { required } = FIXTURES[name];
			await broker.call(
				`${name}.create`,
				{
					...required,
					rating: 5,
					reviewCount: 9999,
					viewCount: 4242,
					bookingCount: 777,
					tourCount: 55,
					location: { type: "Point", coordinates: [0, 0] },
					totallyBogusField: "nope",
				},
				{ meta: adminMeta }
			);

			expect(captured).not.toBeNull();
			for (const key of [...SERVER_CONTROLLED, "totallyBogusField"]) {
				expect(captured[key]).toBeUndefined();
			}
		});

		it("strips server-controlled and unknown fields on update", async () => {
			await broker.call(
				`${name}.update`,
				{
					id: "existing-1",
					rating: 5,
					reviewCount: 9999,
					viewCount: 4242,
					bookingCount: 777,
					tourCount: 55,
					// *.model.update is NOT tenant-scoped, so this is the
					// cross-tenant reassignment vector.
					organizationId: "another-org",
					totallyBogusField: "nope",
				},
				{ meta: adminMeta }
			);

			expect(captured).not.toBeNull();
			for (const key of [
				...SERVER_CONTROLLED,
				"organizationId",
				"totallyBogusField",
			]) {
				expect(captured[key]).toBeUndefined();
			}
		});

		it("derives GeoJSON location from gpsCoords instead of accepting it raw", async () => {
			const { required } = FIXTURES[name];
			await broker.call(
				`${name}.create`,
				{ ...required, gpsCoords: { lat: 5.6037, lng: -0.187 } },
				{ meta: adminMeta }
			);

			// tourPackage has no location field — it uses meetingPoint instead.
			if (name === "tourPackage") return;

			// GeoJSON coordinate order is [lng, lat].
			expect(captured.location).toEqual({
				type: "Point",
				coordinates: [-0.187, 5.6037],
			});
		});
	});
});
