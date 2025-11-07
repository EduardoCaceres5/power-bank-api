import { Router, type Router as RouterType } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router: RouterType = Router();

// ==================== PUBLIC ROUTES ====================

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 * @body    { email: string, password: string, fullName?: string, phone?: string }
 */
router.post('/register', authController.register.bind(authController));

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 * @body    { email: string, password: string }
 */
router.post('/login', authController.login.bind(authController));

/**
 * @route   POST /api/v1/auth/verify
 * @desc    Verify JWT token
 * @access  Public
 * @headers Authorization: Bearer <token>
 */
router.post('/verify', authController.verifyToken.bind(authController));

// ==================== PROTECTED ROUTES ====================

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user information
 * @access  Private
 * @headers Authorization: Bearer <token>
 */
router.get('/me', authenticateToken, authController.getCurrentUser.bind(authController));

/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Change user password
 * @access  Private
 * @headers Authorization: Bearer <token>
 * @body    { currentPassword: string, newPassword: string }
 */
router.post('/change-password', authenticateToken, authController.changePassword.bind(authController));

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Private
 * @headers Authorization: Bearer <token>
 */
router.post('/logout', authenticateToken, authController.logout.bind(authController));

export default router;
