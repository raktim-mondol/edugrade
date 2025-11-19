/**
 * Authentication helper utilities
 * Provides graceful degradation when Clerk is not configured (development mode)
 */

/**
 * Check if authentication is enabled
 * @returns {boolean} True if CLERK_SECRET_KEY is set
 */
const isAuthEnabled = () => {
  return !!process.env.CLERK_SECRET_KEY;
};

/**
 * Get user ID from request
 * Returns null in development mode when auth is disabled
 * @param {object} req - Express request object
 * @returns {string|null} User ID or null
 */
const getUserId = (req) => {
  // If auth is disabled (development mode), return a default user ID
  if (!isAuthEnabled()) {
    console.log('⚠️  Auth disabled - using default user ID');
    return 'dev-user-123'; // Default user ID for development
  }

  // In production with auth enabled, get from Clerk
  return req.auth?.userId || null;
};

/**
 * Check if user is authenticated
 * Always returns true in development mode when auth is disabled
 * @param {object} req - Express request object
 * @returns {boolean} True if authenticated or auth is disabled
 */
const isAuthenticated = (req) => {
  if (!isAuthEnabled()) {
    return true; // Always authenticated in development mode
  }

  return !!req.auth?.userId;
};

/**
 * Verify user owns a resource
 * Always returns true in development mode when auth is disabled
 * @param {string} resourceUserId - The userId that owns the resource
 * @param {object} req - Express request object
 * @returns {boolean} True if user owns resource or auth is disabled
 */
const verifyOwnership = (resourceUserId, req) => {
  if (!isAuthEnabled()) {
    return true; // Skip ownership check in development mode
  }

  const userId = req.auth?.userId;
  return userId === resourceUserId;
};

module.exports = {
  isAuthEnabled,
  getUserId,
  isAuthenticated,
  verifyOwnership
};
