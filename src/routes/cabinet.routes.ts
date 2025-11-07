import { Router } from 'express';
import { cabinetController } from '../controllers/cabinet.controller';
import { optionalAuthMiddleware, authMiddleware, requireRole } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// ==================== ADMIN ROUTES ====================
// Admin routes must come before public routes to prevent conflicts

// Admin list with filters
router.get(
  '/admin/list',
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  cabinetController.getAdminCabinetList.bind(cabinetController)
);

// Create cabinet
router.post(
  '/',
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  cabinetController.createCabinet.bind(cabinetController)
);

// Cabinet stats
router.get(
  '/:id/stats',
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  cabinetController.getCabinetStats.bind(cabinetController)
);

// Sync cabinet
router.post(
  '/:id/sync',
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  cabinetController.syncCabinet.bind(cabinetController)
);

// Update cabinet status
router.patch(
  '/:id/status',
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  cabinetController.updateCabinetStatus.bind(cabinetController)
);

// Update cabinet
router.put(
  '/:id',
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  cabinetController.updateCabinet.bind(cabinetController)
);

// Delete cabinet
router.delete(
  '/:id',
  authMiddleware,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  cabinetController.deleteCabinet.bind(cabinetController)
);

// ==================== PUBLIC ROUTES ====================
// Public routes (con auth opcional para mostrar más info si está autenticado)

router.get('/nearby', optionalAuthMiddleware, cabinetController.getNearby.bind(cabinetController));
router.get('/:id', optionalAuthMiddleware, cabinetController.getCabinetById.bind(cabinetController));
router.get('/', optionalAuthMiddleware, cabinetController.getAllCabinets.bind(cabinetController));

export default router;
