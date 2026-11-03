import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import logger from '../config/logger.js';
import {
  UnauthorizedError,
  ForbiddenError,
} from '../errors/AppError.js';

/**
 * Extract Bearer token from Authorization header.
 * Header format: "Authorization: Bearer <token>"
 */
function extractBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;

  const [scheme, token] = authHeader.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;

  return token;
}

/**
 * Verify JWT and attach decoded payload to req.user.
 * Distinguishes between:
 *   - Missing/invalid format  → 401 UNAUTHORIZED
 *   - Expired token           → 401 TOKEN_EXPIRED  (client should refresh)
 *   - Invalid signature       → 403 FORBIDDEN
 */
export function authenticate(req, _res, next) {
  const token = extractBearerToken(req);

  if (!token) {
    return next(new UnauthorizedError('Missing or malformed Authorization header'));
  }

  try {
    const payload = jwt.verify(token, config.JWT_SECRET);

    req.user = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      logger.info({ userId: undefined }, 'Access token expired');
      return next(
        new UnauthorizedError('Token expired', 'TOKEN_EXPIRED'),
      );
    }

    if (err.name === 'JsonWebTokenError') {
      logger.warn({ err: err.message }, 'Invalid JWT');
      return next(new ForbiddenError('Invalid token'));
    }

    // Anything else (NotBeforeError, etc.)
    logger.error({ err }, 'JWT verification failed unexpectedly');
    return next(new UnauthorizedError('Authentication failed'));
  }
}

/**
 * Require specific role(s) — must be used AFTER `authenticate`.
 * Usage:
 *   router.post('/', authenticate, authorize('admin'), handler)
 */
export function authorize(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Not authenticated'));
    }

    const role = req.user.role;
    if (!allowedRoles.includes(role)) {
      logger.warn(
        { userId: req.user.sub, role, allowedRoles },
        'Access denied: insufficient role',
      );
      return next(new ForbiddenError(`Requires one of: ${allowedRoles.join(', ')}`));
    }

    next();
  };
}