"use strict";

const { MoleculerClientError } = require("moleculer").Errors;
const { ERROR_CODES } = require("../utils/constants");
const {
	uploadStream,
	uploadFromUrl,
	deleteFile,
	generateSignedUrl,
	listResources,
} = require("../utils/cloudinary.utils");

module.exports = {
	name: "media",

	dependencies: [],

	actions: {
		/**
		 * Upload a file stream to Cloudinary.
		 * In moleculer-web, ctx.params IS the ReadableStream and
		 * ctx.meta.$multipart contains the form fields.
		 */
		upload: {
			auth: "required",
			role: "staff",
			async handler(ctx) {
				try {
					const multipart = ctx.meta.$multipart || {};
					const { folder, entityType, entityId } = multipart;
					const filename = multipart.filename || ctx.meta.filename || "";
					const mimetype = multipart.mimetype || ctx.meta.mimetype || "";

					// Determine resource type from file extension or mime
					let resourceType = "auto";
					const ext = filename.split(".").pop()?.toLowerCase() || "";
					const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif", "tiff"];
					if (imageExts.includes(ext) || mimetype.startsWith("image/")) {
						resourceType = "image";
					}

					const result = await uploadStream(ctx.params, {
						folder: folder || "elysium-tours",
						resourceType,
					});

					// Fallback: if Cloudinary still returns raw, force image URL for known image formats
					let imageUrl = result.secure_url;
					if (result.resource_type === "raw" && (imageExts.includes(result.format) || imageExts.includes(ext))) {
						imageUrl = imageUrl.replace("/raw/upload/", "/image/upload/");
					}

					return {
						success: true,
						url: imageUrl,
						publicId: result.public_id,
						resourceType: result.resource_type,
						width: result.width,
						height: result.height,
						format: result.format,
						bytes: result.bytes,
					};
				} catch (err) {
					throw new MoleculerClientError(
						`Upload failed: ${err.message}`,
						400,
						ERROR_CODES.UPLOAD_FAILED,
						{ error: err.message }
					);
				}
			},
		},

		/**
		 * Upload a file from a remote URL.
		 */
		uploadFromUrl: {
			auth: "required",
			role: "staff",
			params: {
				url: "string",
				folder: "string|optional",
			},
			async handler(ctx) {
				try {
					const { url, folder } = ctx.params;

					const result = await uploadFromUrl(url, {
						folder: folder || "elysium-tours",
					});

					return {
						success: true,
						url: result.secure_url,
						publicId: result.public_id,
						width: result.width,
						height: result.height,
						format: result.format,
						bytes: result.bytes,
					};
				} catch (err) {
					throw new MoleculerClientError(
						`Upload from URL failed: ${err.message}`,
						400,
						ERROR_CODES.UPLOAD_FAILED,
						{ error: err.message }
					);
				}
			},
		},

		/**
		 * Delete a file from Cloudinary by public ID.
		 */
		delete: {
			auth: "required",
			role: "admin",
			params: {
				publicId: "string",
				resourceType: "string|optional",
			},
			async handler(ctx) {
				try {
					const { publicId, resourceType } = ctx.params;

					const result = await deleteFile(publicId, resourceType || "image");

					return { success: true, result };
				} catch (err) {
					throw new MoleculerClientError(
						`Delete failed: ${err.message}`,
						400,
						ERROR_CODES.DELETE_FAILED,
						{ error: err.message }
					);
				}
			},
		},

		/**
		 * List resources in a Cloudinary folder.
		 */
		list: {
			auth: "required",
			role: "admin",
			params: {
				folder: "string|optional",
				maxResults: { type: "number", integer: true, positive: true, optional: true, convert: true },
			},
			async handler(ctx) {
				try {
					const { folder, maxResults } = ctx.params;

					return listResources(folder, { maxResults });
				} catch (err) {
					throw new MoleculerClientError(
						`List resources failed: ${err.message}`,
						400,
						ERROR_CODES.INTERNAL_ERROR,
						{ error: err.message }
					);
				}
			},
		},

		/**
		 * Generate a signed URL for a Cloudinary resource.
		 */
		getSignedUrl: {
			auth: "required",
			params: {
				publicId: "string",
			},
			async handler(ctx) {
				const { publicId } = ctx.params;

				const url = generateSignedUrl(publicId);

				return { url };
			},
		},
	},
};
