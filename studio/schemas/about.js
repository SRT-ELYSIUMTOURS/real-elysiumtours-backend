import { defineField, defineType } from "sanity";

export default defineType({
  name: "about",
  title: "About Page",
  type: "document",
  // Singleton — only one about page document
  fields: [
    defineField({
      name: "title",
      title: "Page Title",
      type: "string",
      initialValue: "About Elysium Tours",
    }),
    defineField({
      name: "heroImage",
      title: "Hero Image",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "mission",
      title: "Our Mission",
      type: "text",
      rows: 4,
    }),
    defineField({
      name: "vision",
      title: "Our Vision",
      type: "text",
      rows: 4,
    }),
    defineField({
      name: "story",
      title: "Our Story",
      type: "array",
      of: [{ type: "block" }, { type: "image", options: { hotspot: true } }],
    }),
    defineField({
      name: "team",
      title: "Team Members",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            { name: "name", type: "string", title: "Name" },
            { name: "role", type: "string", title: "Role" },
            { name: "bio", type: "text", title: "Bio", rows: 2 },
            { name: "photo", type: "image", title: "Photo", options: { hotspot: true } },
            { name: "linkedin", type: "url", title: "LinkedIn" },
          ],
          preview: {
            select: { title: "name", subtitle: "role", media: "photo" },
          },
        },
      ],
    }),
    defineField({
      name: "stats",
      title: "Company Stats",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            { name: "label", type: "string", title: "Label" },
            { name: "value", type: "string", title: "Value" },
          ],
        },
      ],
      description: "e.g. '500+ Tours', '10,000+ Customers'",
    }),
  ],
  preview: {
    select: { title: "title" },
  },
});
