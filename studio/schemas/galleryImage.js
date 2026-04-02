import { defineField, defineType } from "sanity";

export default defineType({
  name: "galleryImage",
  title: "Gallery Image (Standalone)",
  type: "document",
  description: "Individual gallery images not part of a collection",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
    }),
    defineField({
      name: "image",
      title: "Image",
      type: "image",
      options: { hotspot: true },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "alt",
      title: "Alt Text",
      type: "string",
    }),
    defineField({
      name: "caption",
      title: "Caption",
      type: "string",
    }),
    defineField({
      name: "category",
      title: "Category",
      type: "string",
      options: {
        list: [
          { title: "Destinations", value: "destinations" },
          { title: "Tours", value: "tours" },
          { title: "Hotels", value: "hotels" },
          { title: "Food & Dining", value: "food-dining" },
          { title: "Culture", value: "culture" },
          { title: "Adventure", value: "adventure" },
        ],
      },
    }),
    defineField({
      name: "location",
      title: "Location",
      type: "string",
    }),
  ],
  preview: {
    select: { title: "title", subtitle: "category", media: "image" },
  },
});
