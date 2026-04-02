import { defineField, defineType } from "sanity";

export default defineType({
  name: "testimonial",
  title: "Testimonial",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Customer Name",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "avatar",
      title: "Customer Photo",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "location",
      title: "Location",
      type: "string",
      description: "e.g. Accra, Ghana",
    }),
    defineField({
      name: "tourName",
      title: "Tour Name",
      type: "string",
      description: "Which tour they took",
    }),
    defineField({
      name: "rating",
      title: "Rating",
      type: "number",
      validation: (Rule) => Rule.required().min(1).max(5),
    }),
    defineField({
      name: "quote",
      title: "Testimonial Quote",
      type: "text",
      rows: 4,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "featured",
      title: "Featured",
      type: "boolean",
      initialValue: false,
      description: "Show on homepage",
    }),
  ],
  preview: {
    select: { title: "name", subtitle: "tourName", media: "avatar" },
  },
});
