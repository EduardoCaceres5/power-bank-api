import { Router } from 'express';
import { rentalController } from '../controllers/rental.controller';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Rutas que requieren autenticación obligatoria
router.post('/', authMiddleware, rentalController.createRental.bind(rentalController));
router.post('/:id/complete', authMiddleware, rentalController.completeRental.bind(rentalController));
router.post('/:id/report-lost', authMiddleware, rentalController.reportLost.bind(rentalController));

// Rutas con autenticación opcional (para desarrollo/testing)
router.get('/', optionalAuthMiddleware, rentalController.getUserRentals.bind(rentalController));
router.get('/active', optionalAuthMiddleware, rentalController.getActiveRental.bind(rentalController));
router.get('/:id', optionalAuthMiddleware, rentalController.getRentalById.bind(rentalController));

export default router;
