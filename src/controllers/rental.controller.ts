import { Request, Response } from 'express';
import { z } from 'zod';
import { rentalService } from '../services/rental.service';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';

export class RentalController {
  /**
   * POST /api/rentals
   * Crear una nueva renta (escanear QR y rentar)
   */
  async createRental(req: Request, res: Response): Promise<void> {
    try {
      const schema = z.object({
        cabinetId: z.string().min(1),
        slotNumber: z.number().int().min(1).max(99),
        paymentMethod: z.enum(['stripe', 'pagopar', 'manual']).optional().default('stripe'),
        userId: z.string().optional(), // Para admin que puede crear para otros usuarios
      });

      const { cabinetId, slotNumber, paymentMethod, userId: targetUserId } = schema.parse(req.body);
      const userId = targetUserId || req.userId!;

      const rental = await rentalService.createRental(userId, cabinetId, slotNumber, paymentMethod);

      res.status(201).json({
        success: true,
        data: rental,
        message: 'Power bank rented successfully',
      });
    } catch (error: any) {
      logger.error('Error creating rental', { error });
      res.status(error.statusCode || 500).json({
        error: error.message || 'Failed to create rental',
      });
    }
  }

  /**
   * GET /api/rentals/active
   * Obtener renta activa del usuario
   */
  async getActiveRental(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const rental = await rentalService.getActiveRental(userId);

      res.json({
        success: true,
        data: rental,
      });
    } catch (error) {
      logger.error('Error getting active rental', { error });
      res.status(500).json({ error: 'Failed to get active rental' });
    }
  }

  /**
   * GET /api/rentals
   * Obtener historial de rentas del usuario
   */
  async getUserRentals(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const { status } = req.query;

      const rentals = await rentalService.getUserRentals(
        userId,
        status as any
      );

      res.json({
        success: true,
        data: rentals,
      });
    } catch (error) {
      logger.error('Error getting user rentals', { error });
      res.status(500).json({ error: 'Failed to get rentals' });
    }
  }

  /**
   * POST /api/rentals/:id/complete
   * Completar una renta manualmente (admin)
   */
  async completeRental(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const rental = await rentalService.completeRental(id);

      res.json({
        success: true,
        data: rental,
        message: 'Rental completed successfully',
      });
    } catch (error: any) {
      logger.error('Error completing rental', { error });
      res.status(error.statusCode || 500).json({
        error: error.message || 'Failed to complete rental',
      });
    }
  }

  /**
   * POST /api/rentals/:id/report-lost
   * Reportar power bank como perdido
   */
  async reportLost(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await rentalService.reportLost(id);

      res.json({
        success: true,
        message: 'Power bank reported as lost',
      });
    } catch (error: any) {
      logger.error('Error reporting lost', { error });
      res.status(error.statusCode || 500).json({
        error: error.message || 'Failed to report lost',
      });
    }
  }

  /**
   * GET /api/rentals/:id
   * Obtener detalles de una renta específica
   */
  async getRentalById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.userId!;

      const rental = await prisma.rental.findFirst({
        where: {
          id,
          userId, // Solo puede ver sus propias rentas
        },
        include: {
          powerBank: true,
          cabinet: true,
          transactions: true,
        },
      });

      if (!rental) {
        res.status(404).json({ error: 'Rental not found' });
        return;
      }

      res.json({
        success: true,
        data: rental,
      });
    } catch (error) {
      logger.error('Error getting rental', { error });
      res.status(500).json({ error: 'Failed to get rental' });
    }
  }
}

export const rentalController = new RentalController();
