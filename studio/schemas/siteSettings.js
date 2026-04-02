import { defineField, defineType } from "sanity";

export default defineType({
  name: "siteSettings",
  title: "Site Settings",
  type: "document",
  // Singleton — one settings document for the whole site
  fields: [
    defineField({
      name: "siteName",
      title: "Site Name",
      type: "string",
      initialValue: "Elysium Tours",
    }),
    defineField({
      name: "tagline",
      title: "Tagline",
      type: "string",
      initialValue: "Explore Ghana with us",
    }),
    defineField({
      name: "logo",
      title: "Logo",
      type: "image",
    }),
    defineField({
      name: "favicon",
      title: "Favicon",
      type: "image",
    }),
    defineField({
      name: "contactEmail",
      title: "Contact Email",
      type: "string",
    }),
    defineField({
      name: "contactPhone",
      title: "Contact Phone",
      type: "string",
    }),
    defineField({
      name: "address",
      title: "Office Address",
      type: "text",
      rows: 2,
    }),
    defineField({
      name: "socialLinks",
      title: "Social Media Links",
      type: "object",
      fields: [
        { name: "facebook", type: "url", title: "Facebook" },
        { name: "instagram", type: "url", title: "Instagram" },
        { name: "twitter", type: "url", title: "Twitter / X" },
        { name: "youtube", type: "url", title: "YouTube" },
        { name: "tiktok", type: "url", title: "TikTok" },
        { name: "linkedin", type: "url", title: "LinkedIn" },
      ],
    }),
    defineField({
      name: "footerText",
      title: "Footer Text",
      type: "string",
      initialValue: "© 2026 Elysium Tours. All rights reserved.",
    }),
    defineField({
      name: "announcementBar",
      title: "Announcement Bar",
      type: "object",
      fields: [
        { name: "enabled", type: "boolean", title: "Show Announcement", initialValue: false },
        { name: "text", type: "string", title: "Announcement Text" },
        { name: "link", type: "url", title: "Link (optional)" },
        { name: "backgroundColor", type: "string", title: "Background Color", initialValue: "#7B2CBF" },
      ],
    }),
    defineField({
      name: "seo",
      title: "Default SEO",
      type: "object",
      fields: [
        { name: "metaTitle", type: "string", title: "Default Meta Title" },
        { name: "metaDescription", type: "text", title: "Default Meta Description", rows: 2 },
        { name: "ogImage", type: "image", title: "Default OG Image" },
      ],
    }),
  ],
  preview: {
    select: { title: "siteName" },
  },
});
