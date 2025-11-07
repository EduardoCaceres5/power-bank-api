import { Router, type Router as RouterType } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';

const router: RouterType = Router();

// All admin routes require authentication and ADMIN or SUPER_ADMIN role
router.use(authMiddleware);
router.use(requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN));

// ==================== DASHBOARD ====================

/**
 * GET /api/admin/dashboard
 * Get dashboard overview with key metrics
 */
router.get('/dashboard', adminController.getDashboard.bind(adminController));

// ==================== STATISTICS ====================

/**
 * GET /api/admin/cabinets/stats
 * Get overall cabinet statistics
 */
router.get('/cabinets/stats', adminController.getCabinetsStats.bind(adminController));

/**
 * GET /api/admin/rentals/stats
 * Get rental statistics
 * Query params:
 *   - period: 7d | 30d | 90d | 1y (default: 30d)
 */
router.get('/rentals/stats', adminController.getRentalsStats.bind(adminController));

/**
 * GET /api/admin/revenue/stats
 * Get revenue statistics
 * Query params:
 *   - period: 7d | 30d | 90d | 1y (default: 30d)
 */
router.get('/revenue/stats', adminController.getRevenueStats.bind(adminController));

// ==================== ALERTS ====================

/**
 * GET /api/admin/alerts
 * Get system alerts
 */
router.get('/alerts', adminController.getAlerts.bind(adminController));

export default router;
