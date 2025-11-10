import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '../lib/logger';

/**
 * Rate limiter for authentication routes
 * Limits requests to prevent brute force attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again later.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers

  // Custom handler for rate limit exceeded
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded for authentication', {
      ip: req.ip,
      path: req.path,
    });

    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts. Please try again after 15 minutes.',
    });
  },

  // Skip successful requests (optional - only count failed attempts)
  skipSuccessfulRequests: false,
});

/**
 * Stricter rate limiter for login attempts
 * More restrictive to prevent brute force attacks
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    success: false,
    error: 'Too many login attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,

  handler: (req: Request, res: Response) => {
    logger.warn('Login rate limit exceeded', {
      ip: req.ip,
      email: req.body?.email,
    });

    res.status(429).json({
      success: false,
      error: 'Too many login attempts from this IP. Please try again after 15 minutes.',
    });
  },

  skipSuccessfulRequests: true, // Only count failed login attempts
});

/**
 * Rate limiter for registration
 * Prevents spam account creation
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 registration attempts per hour
  message: {
    success: false,
    error: 'Too many accounts created from this IP. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,

  handler: (req: Request, res: Response) => {
    logger.warn('Registration rate limit exceeded', {
      ip: req.ip,
      email: req.body?.email,
    });

    res.status(429).json({
      success: false,
      error: 'Too many registration attempts. Please try again after 1 hour.',
    });
  },
});

/**
 * General rate limiter for password change
 * Prevents abuse of password change functionality
 */
export const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 password changes per hour
  message: {
    success: false,
    error: 'Too many password change attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,

  handler: (req: Request, res: Response) => {
    logger.warn('Password change rate limit exceeded', {
      ip: req.ip,
      userId: (req as any).user?.userId,
    });

    res.status(429).json({
      success: false,
      error: 'Too many password change attempts. Please try again after 1 hour.',
    });
  },
});
