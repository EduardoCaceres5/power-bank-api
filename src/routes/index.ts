import { Router, type Router as RouterType } from 'express';
import authRoutes from './auth.routes';
import cabinetRoutes from './cabinet.routes';
import rentalRoutes from './rental.routes';
import wschargeApiRoutes from './wscharge-api.routes';
import adminRoutes from './admin.routes';

const router: RouterType = Router();

// API Routes
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/cabinets', cabinetRoutes);
router.use('/rentals', rentalRoutes);
router.use('/wscharge', wschargeApiRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || 'v1',
  });
});

export default router;
