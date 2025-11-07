import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { z } from 'zod';
import { cabinetService } from '../services/cabinet.service';
import {
  CreateCabinetRequest,
  UpdateCabinetRequest,
  UpdateCabinetStatusRequest,
  CabinetFilters,
  GetNearbyCabinetsRequest,
  LATITUDE_RANGE,
  LONGITUDE_RANGE,
  CABINET_ID_REGEX,
} from '../types/cabinet.types';
import { CabinetStatus } from '@prisma/client';

export class CabinetController {
  /**
   * GET /api/cabinets
   * Obtener todos los gabinetes
   */
  async getAllCabinets(req: Request, res: Response): Promise<void> {
    try {
      const { latitude, longitude, radius } = req.query;

      let cabinets;

      if (latitude && longitude && radius) {
        // Buscar gabinetes cercanos (simplified - en producción usar PostGIS)
        const lat = parseFloat(latitude as string);
        const lon = parseFloat(longitude as string);
        const rad = parseFloat(radius as string);

        cabinets = await prisma.cabinet.findMany({
          where: {
            status: 'ONLINE',
            AND: [
              { latitude: { gte: lat - rad, lte: lat + rad } },
              { longitude: { gte: lon - rad, lte: lon + rad } },
            ],
          },
          include: {
            slots: {
              include: {
                powerBank: true,
              },
            },
          },
        });
      } else {
        cabinets = await prisma.cabinet.findMany({
          where: {
            status: 'ONLINE',
          },
          include: {
            slots: {
              include: {
                powerBank: true,
              },
            },
          },
        });
      }

      // Calcular disponibilidad
      const cabinetsWithAvailability = cabinets.map((cabinet) => ({
        ...cabinet,
        availableSlots: cabinet.slots.filter(
          (slot) => slot.powerBank && slot.powerBank.status === 'AVAILABLE'
        ).length,
        totalSlots: cabinet.slots.length,
      }));

      res.json({
        success: true,
        data: cabinetsWithAvailability,
      });
    } catch (error) {
      logger.error('Error getting cabinets', { error });
      res.status(500).json({ error: 'Failed to get cabinets' });
    }
  }

  /**
   * GET /api/cabinets/:id
   * Obtener detalles de un gabinete
   */
  async getCabinetById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const cabinet = await prisma.cabinet.findUnique({
        where: { id },
        include: {
          slots: {
            include: {
              powerBank: true,
            },
            orderBy: {
              slotNumber: 'asc',
            },
          },
        },
      });

      if (!cabinet) {
        res.status(404).json({ error: 'Cabinet not found' });
        return;
      }

      const availableSlots = cabinet.slots.filter(
        (slot) => slot.powerBank && slot.powerBank.status === 'AVAILABLE'
      ).length;

      res.json({
        success: true,
        data: {
          ...cabinet,
          availableSlots,
          totalSlots: cabinet.slots.length,
        },
      });
    } catch (error) {
      logger.error('Error getting cabinet', { error });
      res.status(500).json({ error: 'Failed to get cabinet' });
    }
  }

  /**
   * GET /api/cabinets/nearby
   * Buscar gabinetes cercanos con power banks disponibles
   */
  async getNearby(req: Request, res: Response): Promise<void> {
    try {
      const schema = z.object({
        latitude: z.string().transform(Number),
        longitude: z.string().transform(Number),
        radius: z.string().transform(Number).default('5'),
      });

      const { latitude, longitude, radius } = schema.parse(req.query);

      // En producción, usar PostGIS para búsquedas geoespaciales eficientes
      const cabinets = await prisma.cabinet.findMany({
        where: {
          status: 'ONLINE',
          latitude: { not: null },
          longitude: { not: null },
        },
        include: {
          slots: {
            include: {
              powerBank: {
                where: {
                  status: 'AVAILABLE',
                },
              },
            },
          },
        },
      });

      // Calcular distancia y filtrar
      const cabinetsWithDistance = cabinets
        .map((cabinet) => {
          if (!cabinet.latitude || !cabinet.longitude) return null;

          const distance = this.calculateDistance(
            latitude,
            longitude,
            cabinet.latitude,
            cabinet.longitude
          );

          const availablePowerBanks = cabinet.slots.filter(
            (slot) => slot.powerBank
          ).length;

          return {
            ...cabinet,
            distance,
            availablePowerBanks,
          };
        })
        .filter((c) => c !== null && c.distance <= radius)
        .sort((a, b) => a!.distance - b!.distance);

      res.json({
        success: true,
        data: cabinetsWithDistance,
      });
    } catch (error) {
      logger.error('Error getting nearby cabinets', { error });
      res.status(500).json({ error: 'Failed to get nearby cabinets' });
    }
  }

  /**
   * Haversine formula para calcular distancia entre dos puntos
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // ==================== ADMIN METHODS ====================

  /**
   * POST /api/cabinets
   * Create a new cabinet (Admin only)
   */
  async createCabinet(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const schema = z.object({
        id: z.string().regex(CABINET_ID_REGEX, 'Invalid cabinet ID format (WSTD + 12 digits)'),
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        location: z.string().min(1).max(200),
        address: z.string().min(1).max(500),
        latitude: z.number().min(LATITUDE_RANGE.min).max(LATITUDE_RANGE.max),
        longitude: z.number().min(LONGITUDE_RANGE.min).max(LONGITUDE_RANGE.max),
        iotCardNumber: z.string().optional(),
      });

      const data = schema.parse(req.body) as CreateCabinetRequest;

      // Create cabinet using service
      const cabinet = await cabinetService.createCabinet(data);

      logger.info('Cabinet created by admin', {
        cabinetId: cabinet.id,
        adminId: req.user?.userId,
      });

      res.status(201).json({
        success: true,
        data: cabinet,
        message: 'Cabinet created successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          res.status(409).json({
            success: false,
            error: error.message,
          });
          return;
        }

        logger.error('Error creating cabinet', {
          error: error.message,
          adminId: req.user?.userId,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create cabinet',
      });
    }
  }

  /**
   * PUT /api/cabinets/:id
   * Update a cabinet (Admin only)
   */
  async updateCabinet(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Validate request body
      const schema = z.object({
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        location: z.string().min(1).max(200).optional(),
        address: z.string().min(1).max(500).optional(),
        latitude: z.number().min(LATITUDE_RANGE.min).max(LATITUDE_RANGE.max).optional(),
        longitude: z.number().min(LONGITUDE_RANGE.min).max(LONGITUDE_RANGE.max).optional(),
        status: z.nativeEnum(CabinetStatus).optional(),
      });

      const data = schema.parse(req.body) as UpdateCabinetRequest;

      // Update cabinet using service
      const cabinet = await cabinetService.updateCabinet(id, data);

      logger.info('Cabinet updated by admin', {
        cabinetId: id,
        adminId: req.user?.userId,
      });

      res.json({
        success: true,
        data: cabinet,
        message: 'Cabinet updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({
            success: false,
            error: error.message,
          });
          return;
        }

        logger.error('Error updating cabinet', {
          error: error.message,
          cabinetId: id,
          adminId: req.user?.userId,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to update cabinet',
      });
    }
  }

  /**
   * DELETE /api/cabinets/:id
   * Delete a cabinet (Admin only)
   */
  async deleteCabinet(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Delete cabinet using service
      await cabinetService.deleteCabinet(id);

      logger.info('Cabinet deleted by admin', {
        cabinetId: id,
        adminId: req.user?.userId,
      });

      res.json({
        success: true,
        message: 'Cabinet deleted successfully',
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({
            success: false,
            error: error.message,
          });
          return;
        }

        if (error.message.includes('active rentals')) {
          res.status(409).json({
            success: false,
            error: error.message,
          });
          return;
        }

        logger.error('Error deleting cabinet', {
          error: error.message,
          cabinetId: id,
          adminId: req.user?.userId,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to delete cabinet',
      });
    }
  }

  /**
   * PATCH /api/cabinets/:id/status
   * Update cabinet status (Admin only)
   */
  async updateCabinetStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Validate request body
      const schema = z.object({
        status: z.nativeEnum(CabinetStatus),
      });

      const { status } = schema.parse(req.body) as UpdateCabinetStatusRequest;

      // Update status using service
      const cabinet = await cabinetService.updateCabinetStatus(id, status);

      logger.info('Cabinet status updated by admin', {
        cabinetId: id,
        newStatus: status,
        adminId: req.user?.userId,
      });

      res.json({
        success: true,
        data: cabinet,
        message: 'Cabinet status updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({
            success: false,
            error: 'Cabinet not found',
          });
          return;
        }

        logger.error('Error updating cabinet status', {
          error: error.message,
          cabinetId: id,
          adminId: req.user?.userId,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to update cabinet status',
      });
    }
  }

  /**
   * GET /api/cabinets/:id/stats
   * Get cabinet statistics (Admin only)
   */
  async getCabinetStats(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Get stats using service
      const stats = await cabinetService.getCabinetStats(id);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({
            success: false,
            error: error.message,
          });
          return;
        }

        logger.error('Error getting cabinet stats', {
          error: error.message,
          cabinetId: id,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to get cabinet stats',
      });
    }
  }

  /**
   * POST /api/cabinets/:id/sync
   * Sync cabinet with WsCharge API (Admin only)
   */
  async syncCabinet(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Sync cabinet using service
      const result = await cabinetService.syncCabinetWithWsCharge(id);

      logger.info('Cabinet sync initiated by admin', {
        cabinetId: id,
        success: result.success,
        adminId: req.user?.userId,
      });

      if (!result.success) {
        res.status(500).json({
          success: false,
          error: 'Sync failed',
          details: result.errors,
        });
        return;
      }

      res.json({
        success: true,
        data: result,
        message: 'Cabinet synced successfully',
      });
    } catch (error) {
      logger.error('Error syncing cabinet', {
        error: error instanceof Error ? error.message : 'Unknown error',
        cabinetId: req.params.id,
        adminId: req.user?.userId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to sync cabinet',
      });
    }
  }

  /**
   * GET /api/cabinets/admin/list
   * Get all cabinets with filters (Admin only)
   * Enhanced version of getAllCabinets with more filters
   */
  async getAdminCabinetList(req: Request, res: Response): Promise<void> {
    try {
      // Parse filters from query params
      const schema = z.object({
        status: z.nativeEnum(CabinetStatus).optional(),
        location: z.string().optional(),
        hasAvailableSlots: z.string().transform((val) => val === 'true').optional(),
        search: z.string().optional(),
      });

      const filters = schema.parse(req.query) as CabinetFilters;

      // Get cabinets using service
      const cabinets = await cabinetService.getAllCabinets(filters);

      res.json({
        success: true,
        data: cabinets,
        count: cabinets.length,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      logger.error('Error getting admin cabinet list', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get cabinet list',
      });
    }
  }
}

export const cabinetController = new CabinetController();
