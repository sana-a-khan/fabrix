/**
 * fabrix Configuration
 *
 * IMPORTANT: Update BACKEND_URL before publishing to Chrome Web Store!
 *
 * For development: use http://localhost:3000
 * For production: use your deployed backend URL
 */

const CONFIG = {
  // ⚠️ CHANGE THIS BEFORE PUBLISHING ⚠️
  BACKEND_URL: "http://localhost:3000",

  // For production, replace with your deployed backend:
  // BACKEND_URL: "https://fabrix-backend.railway.app",
  // BACKEND_URL: "https://fabrix-api.onrender.com",
  // BACKEND_URL: "https://your-app.herokuapp.com",

  // Version
  VERSION: "1.0.0",

  // Feature flags
  DEBUG: false, // Set to false in production
};

// Make config available globally
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}
