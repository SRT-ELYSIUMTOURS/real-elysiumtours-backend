import { defineField, defineType } from "sanity";

export default defineType({
  name: "gallery",
  title: "Gallery Collection",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Collection Title",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title" },
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
      name: "description",
      title: "Description",
      type: "text",
      rows: 2,
    }),
    defineField({
      name: "coverImage",
      title: "Cover Image",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "images",
      title: "Gallery Images",
      type: "array",
      of: [
        {
          type: "image",
          options: { hotspot: true },
          fields: [
            { name: "alt", type: "string", title: "Alt Text" },
            { name: "caption", type: "string", title: "Caption" },
            { name: "location", type: "string", title: "Location" },
          ],
        },
      ],
    }),
  ],
  preview: {
    select: { title: "title", subtitle: "category", media: "coverImage" },
  },
});
