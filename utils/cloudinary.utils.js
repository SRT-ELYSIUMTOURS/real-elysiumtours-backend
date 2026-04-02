"use strict";

const cloudinary = require("cloudinary").v2;

// Configure from environment
cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file stream to Cloudinary.
 * @param {ReadableStream} stream - File stream
 * @param {Object} options - Upload options (folder, publicId, resourceType, transformation)
 * @returns {Promise<Object>} - Cloudinary upload result
 */
async function uploadStream(stream, options = {}) {
	return new Promise((resolve, reject) => {
		const uploadStream = cloudinary.uploader.upload_stream(
			{
				folder: options.folder || "elysium-tours",
				public_id: options.publicId,
				resource_type: options.resourceType || "auto",
				transformation: options.transformation,
			},
			(error, result) => {
				if (error) return reject(error);
				resolve(result);
			}
		);
		stream.pipe(uploadStream);
	});
}

/**
 * Upload from a URL.
 * @param {string} url - Remote file URL
 * @param {Object} options - Upload options (folder, publicId, resourceType)
 * @returns {Promise<Object>} - Cloudinary upload result
 */
async function uploadFromUrl(url, options = {}) {
	return cloudinary.uploader.upload(url, {
		folder: options.folder || "elysium-tours",
		public_id: options.publicId,
		resource_type: options.resourceType || "auto",
	});
}

/**
 * Delete a file from Cloudinary.
 * @param {string} publicId - The public ID of the resource
 * @param {string} resourceType - Resource type (default: "image")
 * @returns {Promise<Object>} - Cloudinary destroy result
 */
async function deleteFile(publicId, resourceType = "image") {
	return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

/**
 * Generate a signed URL for secure access.
 * @param {string} publicId - The public ID of the resource
 * @param {Object} options - URL generation options
 * @returns {string} - Signed URL
 */
function generateSignedUrl(publicId, options = {}) {
	return cloudinary.url(publicId, {
		secure: true,
		sign_url: true,
		type: "authenticated",
		...options,
	});
}

/**
 * List resources in a folder.
 * @param {string} folder - Folder prefix
 * @param {Object} options - Listing options (maxResults, etc.)
 * @returns {Promise<Object>} - Cloudinary resources response
 */
async function listResources(folder, options = {}) {
	return cloudinary.api.resources({
		type: "upload",
		prefix: folder || "elysium-tours",
		max_results: options.maxResults || 50,
		...options,
	});
}

module.exports = {
	cloudinary,
	uploadStream,
	uploadFromUrl,
	deleteFile,
	generateSignedUrl,
	listResources,
};
