// frontend/src/utils/urlUtils.js
// Utility function to build subdomain-based URLs for images and files
import Config from "../config";

/**
 * Builds a subdomain-based URL for images and files using explicit config
 * @param {string} type - 'images' or 'files'
 * @param {string} shieldedID - The shielded ID of the image/file
 * @param {string|number} size - Optional size for images (256, 512, 1024, etc.)
 * @returns {string} Complete URL with subdomain
 */
export function buildMediaUrl(type, shieldedID, size = null) {
  // Get subdomain from localStorage (stored in App.jsx)
  const subdomain = localStorage.getItem("subdomain");

  if (!subdomain) {
    // Fallback to current config if no subdomain (shouldn't happen in normal flow)
    console.warn("No subdomain found in localStorage, using default config");
    const baseUrl = Config.url || "";
    return size
      ? `${baseUrl}/api/${type}/${shieldedID}/${size}`
      : `${baseUrl}/api/${type}/${shieldedID}`;
  }

  // Build subdomain URL using explicit config
  const protocol = Config.subdomain.protocol;
  const domain = Config.subdomain.domain;
  const port = Config.subdomain.port ? `:${Config.subdomain.port}` : "";

  const baseUrl = `${protocol}://${subdomain}.${domain}${port}`;

  return size
    ? `${baseUrl}/api/${type}/${shieldedID}/${size}`
    : `${baseUrl}/api/${type}/${shieldedID}`;
}

/**
 * Helper function specifically for image URLs
 * @param {string} shieldedID - The shielded ID of the image
 * @param {string|number} size - Image size (256, 512, 1024, etc.)
 * @returns {string} Complete image URL with subdomain
 */
export function buildImageUrl(shieldedID, size = null) {
  return buildMediaUrl("images", shieldedID, size);
}

/**
 * Helper function specifically for file URLs
 * @param {string} shieldedID - The shielded ID of the file
 * @returns {string} Complete file URL with subdomain
 */
export function buildFileUrl(shieldedID) {
  return buildMediaUrl("files", shieldedID);
}
