"use strict";

const SITE_URL = (process.env.SITE_URL || "https://elysiumtour.com").replace(/\/$/, "");

const STATIC_URLS = [
	{ loc: "/",                                    priority: "1.0", changefreq: "daily"   },
	{ loc: "/about",                               priority: "0.8", changefreq: "monthly" },
	{ loc: "/contact",                             priority: "0.7", changefreq: "monthly" },
	{ loc: "/tours",                               priority: "0.9", changefreq: "weekly"  },
	{ loc: "/tours/all",                           priority: "0.8", changefreq: "weekly"  },
	{ loc: "/tour-partners",                       priority: "0.8", changefreq: "weekly"  },
	{ loc: "/tour-partners/tour-sites",            priority: "0.7", changefreq: "weekly"  },
	{ loc: "/tour-partners/accommodation",         priority: "0.7", changefreq: "weekly"  },
	{ loc: "/tour-partners/transportation",        priority: "0.7", changefreq: "weekly"  },
	{ loc: "/tour-partners/guides",                priority: "0.7", changefreq: "weekly"  },
	{ loc: "/tour-partners/restaurants",           priority: "0.7", changefreq: "weekly"  },
	{ loc: "/tour-partners/photographers",         priority: "0.7", changefreq: "weekly"  },
	{ loc: "/tour-partners/insurance",             priority: "0.7", changefreq: "weekly"  },
	{ loc: "/gallery",                             priority: "0.7", changefreq: "weekly"  },
	{ loc: "/gallery/destinations/all",            priority: "0.6", changefreq: "weekly"  },
	{ loc: "/gallery/activities/all",              priority: "0.6", changefreq: "weekly"  },
	{ loc: "/gallery/nature/all",                  priority: "0.6", changefreq: "weekly"  },
	{ loc: "/gallery/culture/all",                 priority: "0.6", changefreq: "weekly"  },
	{ loc: "/gallery/videos/all",                  priority: "0.6", changefreq: "weekly"  },
	{ loc: "/gallery/partners/all",                priority: "0.6", changefreq: "weekly"  },
	{ loc: "/gallery/captured-by-you/all",         priority: "0.6", changefreq: "weekly"  },
	{ loc: "/blog",                                priority: "0.8", changefreq: "weekly"  },
	{ loc: "/blog/travel-guides",                  priority: "0.6", changefreq: "weekly"  },
	{ loc: "/blog/destination-highlights",         priority: "0.6", changefreq: "weekly"  },
	{ loc: "/blog/local-guides",                   priority: "0.6", changefreq: "weekly"  },
	{ loc: "/blog/travel-stories",                 priority: "0.6", changefreq: "weekly"  },
	{ loc: "/blog/partner-spotlight",              priority: "0.6", changefreq: "weekly"  },
];

const PARTNER_SOURCES = [
	{ action: "attraction.model.find",          urlCategory: "tour-sites"      },
	{ action: "hotelPartner.model.find",        urlCategory: "accommodation"   },
	{ action: "diningPartner.model.find",       urlCategory: "restaurants"     },
	{ action: "transportProvider.model.find",   urlCategory: "transportation"  },
	{ action: "tourGuide.model.find",           urlCategory: "guides"          },
	{ action: "photographerPartner.model.find", urlCategory: "photographers"   },
	{ action: "servicePartner.model.find",      urlCategory: "insurance"       },
];

function escXml(str) {
	return String(str || "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function isoDate(val) {
	if (!val) return null;
	try { return new Date(val).toISOString().split("T")[0]; } catch { return null; }
}

function buildXml(entries) {
	const rows = entries.map(({ loc, lastmod, changefreq, priority }) => {
		let s = `  <url>\n    <loc>${escXml(SITE_URL + loc)}</loc>\n`;
		if (lastmod)    s += `    <lastmod>${lastmod}</lastmod>\n`;
		if (changefreq) s += `    <changefreq>${changefreq}</changefreq>\n`;
		if (priority)   s += `    <priority>${priority}</priority>\n`;
		return s + `  </url>`;
	});
	return (
		`<?xml version="1.0" encoding="UTF-8"?>\n` +
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
		rows.join("\n") +
		`\n</urlset>`
	);
}

module.exports = {
	name: "sitemap",

	dependencies: [
		"tourPackage.model",
		"blog.model",
		"country.model",
		"attraction.model",
		"hotelPartner.model",
		"diningPartner.model",
		"transportProvider.model",
		"tourGuide.model",
		"photographerPartner.model",
		"servicePartner.model",
	],

	actions: {
		generate: {
			auth: undefined, // public — no token required
			async handler(ctx) {
				const urls = [...STATIC_URLS];
				const meta = ctx.meta;

				// ── Countries ────────────────────────────────────────────────
				try {
					const countries = await this.broker.call(
						"country.model.find",
						{ query: { isActive: true }, fields: ["slug", "updatedAt"] },
						{ meta }
					);
					for (const c of (countries || [])) {
						if (c.slug) {
							urls.push({ loc: `/tours/${c.slug}`, priority: "0.8", changefreq: "weekly", lastmod: isoDate(c.updatedAt) });
						}
					}
				} catch (e) { this.logger.warn("sitemap: country fetch failed", e.message); }

				// ── Tour packages ─────────────────────────────────────────────
				try {
					const tours = await this.broker.call(
						"tourPackage.model.find",
						{ query: { isActive: true, status: "published" }, fields: ["slug", "country", "updatedAt"] },
						{ meta }
					);
					for (const t of (tours || [])) {
						if (t.slug && t.country) {
							urls.push({
								loc: `/tours/${t.country}/${t.slug}`,
								priority: "0.9",
								changefreq: "weekly",
								lastmod: isoDate(t.updatedAt),
							});
						}
					}
				} catch (e) { this.logger.warn("sitemap: tourPackage fetch failed", e.message); }

				// ── Blog posts ────────────────────────────────────────────────
				try {
					const posts = await this.broker.call(
						"blog.model.find",
						{ query: { isPublished: true }, fields: ["slug", "updatedAt"] },
						{ meta }
					);
					for (const p of (posts || [])) {
						if (p.slug) {
							urls.push({
								loc: `/blog/post/${p.slug}`,
								priority: "0.7",
								changefreq: "monthly",
								lastmod: isoDate(p.updatedAt),
							});
						}
					}
				} catch (e) { this.logger.warn("sitemap: blog fetch failed", e.message); }

				// ── Partners ──────────────────────────────────────────────────
				for (const { action, urlCategory } of PARTNER_SOURCES) {
					try {
						const partners = await this.broker.call(
							action,
							{ query: { isActive: true }, fields: ["_id", "updatedAt"] },
							{ meta }
						);
						for (const p of (partners || [])) {
							if (p._id) {
								urls.push({
									loc: `/tour-partners/${urlCategory}/${p._id}`,
									priority: "0.6",
									changefreq: "monthly",
									lastmod: isoDate(p.updatedAt),
								});
							}
						}
					} catch (e) { this.logger.warn(`sitemap: ${action} fetch failed`, e.message); }
				}

				return buildXml(urls);
			},
		},
	},
};
