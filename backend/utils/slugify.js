/**
 * Converts a string to a URL-friendly slug.
 * Fixed to prevent removing valid latin characters before normalization.
 */
const createSlug = (str) => {
  if (!str) return '';
  return str
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9]+/g, '-')     // Replace non-alphanumeric with dash
    .replace(/(^-|-$)+/g, '');       // Remove leading/trailing dashes
};

module.exports = {
  createSlug
};
