const { ClerkExpressRequireAuth, ClerkExpressWithAuth } = require('@clerk/clerk-sdk-node');

/**
 * Middleware to require authentication for routes
 * Usage: app.use('/api/protected', requireAuth);
 */
const requireAuth = () => {
  // Only enable if Clerk is configured
  if (!process.env.CLERK_SECRET_KEY) {
    console.warn('⚠️  CLERK_SECRET_KEY not set - authentication disabled');
    return (req, res, next) => next();
  }

  return ClerkExpressRequireAuth();
};

/**
 * Middleware to optionally attach auth info (doesn't require auth)
 * Usage: app.use(withAuth());
 */
const withAuth = () => {
  if (!process.env.CLERK_SECRET_KEY) {
    return (req, res, next) => next();
  }

  return ClerkExpressWithAuth();
};

/**
 * Middleware to check if user has specific role
 * @param {String[]} allowedRoles - Array of allowed roles
 */
const requireRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      // Skip if auth is not configured
      if (!process.env.CLERK_SECRET_KEY) {
        return next();
      }

      // Get user from Clerk auth
      const userId = req.auth?.userId;

      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      // Get user metadata (roles stored in publicMetadata)
      const { clerkClient } = require('@clerk/clerk-sdk-node');
      const user = await clerkClient.users.getUser(userId);

      const userRole = user.publicMetadata?.role || 'user';

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Insufficient permissions',
        });
      }

      // Attach user info to request
      req.user = {
        id: userId,
        email: user.emailAddresses[0]?.emailAddress,
        role: userRole,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      };

      next();
    } catch (error) {
      console.error('❌ Role check error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to verify user role',
      });
    }
  };
};

/**
 * Middleware to check if user owns the resource
 * @param {Function} getResourceOwnerId - Function to get resource owner ID from req
 */
const requireOwnership = (getResourceOwnerId) => {
  return async (req, res, next) => {
    try {
      if (!process.env.CLERK_SECRET_KEY) {
        return next();
      }

      const userId = req.auth?.userId;

      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      // Get resource owner ID
      const ownerId = await getResourceOwnerId(req);

      if (!ownerId) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Resource not found',
        });
      }

      // Check if user owns the resource
      if (ownerId !== userId) {
        // Check if user is admin
        const { clerkClient } = require('@clerk/clerk-sdk-node');
        const user = await clerkClient.users.getUser(userId);
        const userRole = user.publicMetadata?.role || 'user';

        if (userRole !== 'admin') {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'You do not have permission to access this resource',
          });
        }
      }

      next();
    } catch (error) {
      console.error('❌ Ownership check error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to verify resource ownership',
      });
    }
  };
};

module.exports = {
  requireAuth,
  withAuth,
  requireRole,
  requireOwnership,
};
