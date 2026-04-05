/**
 * Authentication Service
 * Handles user signup, login, and JWT token management
 */

import jwt from 'jsonwebtoken';
import {
  createAuthenticatedUser,
  findUserByEmail,
  findUserById,
  findOrCreateUser,
  isDBConnected
} from './dbService.js';

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'debugmind-ai-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate JWT token for user
 */
function generateToken(user) {
  return jwt.sign(
    {
      userId: user.userId,
      email: user.email,
      authType: user.authType
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Sign up new user with email and password
 */
async function signup(email, password, leetcodeUsername) {
  // Validate input
  if (!email || !password || !leetcodeUsername) {
    return {
      success: false,
      error: 'Email, password, and LeetCode username are required'
    };
  }

  if (password.length < 6) {
    return {
      success: false,
      error: 'Password must be at least 6 characters'
    };
  }

  // Validate email format
  const emailRegex = /^\S+@\S+\.\S+$/;
  if (!emailRegex.test(email)) {
    return {
      success: false,
      error: 'Invalid email format'
    };
  }

  // Check if DB is connected
  if (!isDBConnected()) {
    return {
      success: false,
      error: 'Database unavailable. Please try again later.'
    };
  }

  try {
    const user = await createAuthenticatedUser(email, password, leetcodeUsername);
    
    if (!user) {
      return {
        success: false,
        error: 'Failed to create user'
      };
    }

    const token = generateToken(user);

    return {
      success: true,
      user: {
        userId: user.userId,
        email: user.email,
        leetcodeUsername: user.leetcodeUsername,
        authType: user.authType
      },
      token
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Signup failed'
    };
  }
}

/**
 * Login user with email and password
 */
async function login(email, password) {
  // Validate input
  if (!email || !password) {
    return {
      success: false,
      error: 'Email and password are required'
    };
  }

  // Check if DB is connected
  if (!isDBConnected()) {
    return {
      success: false,
      error: 'Database unavailable. Please try again later.'
    };
  }

  try {
    const user = await findUserByEmail(email);

    if (!user) {
      return {
        success: false,
        error: 'Invalid email or password'
      };
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return {
        success: false,
        error: 'Invalid email or password'
      };
    }

    // Update last active
    user.lastActive = new Date();
    await user.save();

    const token = generateToken(user);

    return {
      success: true,
      user: {
        userId: user.userId,
        email: user.email,
        leetcodeUsername: user.leetcodeUsername,
        authType: user.authType,
        preferences: user.preferences,
        stats: user.stats
      },
      token
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Login failed'
    };
  }
}

/**
 * Get user from token
 */
async function getUserFromToken(token) {
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return null;
  }

  const user = await findUserById(decoded.userId);
  return user;
}

/**
 * Middleware to authenticate requests
 * Adds req.user if valid token provided
 * Does NOT block requests without token (backward compatible)
 */
function authMiddleware(req, res, next) {
  // Get token from header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token - continue without user (backward compatible)
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    // Invalid token - continue without user
    req.user = null;
    return next();
  }

  // Valid token - attach user info
  req.user = decoded;
  next();
}

/**
 * Middleware that REQUIRES authentication
 * Use for protected routes
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    });
  }

  req.user = decoded;
  next();
}

/**
 * Guest login/signup
 * Creates or finds guest user based on LeetCode username
 * Does not require password
 */
async function guestLogin(leetcodeUsername) {
  if (!leetcodeUsername) {
    return {
      success: false,
      error: 'LeetCode username is required'
    };
  }

  // If DB is not connected, still allow guest access
  // The system works with in-memory cache
  if (!isDBConnected()) {
    return {
      success: true,
      user: {
        userId: leetcodeUsername.toLowerCase().trim(),
        leetcodeUsername: leetcodeUsername.toLowerCase().trim(),
        authType: 'guest'
      },
      token: null, // No token for guest when DB is down
      dbConnected: false
    };
  }

  try {
    const user = await findOrCreateUser(leetcodeUsername);

    if (!user) {
      // Fallback to guest without DB
      return {
        success: true,
        user: {
          userId: leetcodeUsername.toLowerCase().trim(),
          leetcodeUsername: leetcodeUsername.toLowerCase().trim(),
          authType: 'guest'
        },
        token: null
      };
    }

    const token = generateToken(user);

    return {
      success: true,
      user: {
        userId: user.userId,
        leetcodeUsername: user.leetcodeUsername,
        authType: user.authType,
        stats: user.stats
      },
      token
    };
  } catch (error) {
    console.error('[AuthService] Guest login error:', error.message);
    // Still allow access without DB
    return {
      success: true,
      user: {
        userId: leetcodeUsername.toLowerCase().trim(),
        leetcodeUsername: leetcodeUsername.toLowerCase().trim(),
        authType: 'guest'
      },
      token: null
    };
  }
}

/**
 * Update user password
 */
async function updatePassword(userId, currentPassword, newPassword) {
  if (!isDBConnected()) {
    return {
      success: false,
      error: 'Database unavailable'
    };
  }

  try {
    const user = await findUserByEmail(userId); // This returns with password
    
    if (!user) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    const isMatch = await user.comparePassword(currentPassword);
    
    if (!isMatch) {
      return {
        success: false,
        error: 'Current password is incorrect'
      };
    }

    user.password = newPassword;
    await user.save(); // Password will be hashed by pre-save hook

    return {
      success: true,
      message: 'Password updated successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Password update failed'
    };
  }
}

export {
  signup,
  login,
  guestLogin,
  getUserFromToken,
  generateToken,
  verifyToken,
  authMiddleware,
  requireAuth,
  updatePassword
};
