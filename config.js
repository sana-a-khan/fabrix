/**
 * fabrix Configuration
 *
 * IMPORTANT: Update BACKEND_URL before publishing to Chrome Web Store!
 *
 * For development: use http://localhost:3000
 * For production: use your deployed backend URL
 */

const CONFIG = {
  // ✅ Production backend URL
  BACKEND_URL: "https://fabrix-backend.onrender.com",

  // For local development, use:
  // BACKEND_URL: "http://localhost:3000",

  // Version
  VERSION: "1.0.0",

  // Feature flags
  DEBUG: false, // Set to false in production
};

// Make config available globally
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}
