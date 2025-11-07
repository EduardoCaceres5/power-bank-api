import { PrismaClient, Cabinet, CabinetStatus, PowerBankStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import {
  CreateCabinetRequest,
  UpdateCabinetRequest,
  CabinetWithDetails,
  CabinetListItem,
  CabinetStats,
  CabinetsOverview,
  CabinetFilters,
  GetNearbyCabinetsRequest,
  SyncCabinetResult,
  CABINET_ID_REGEX,
  DEFAULT_SEARCH_RADIUS_KM,
  MAX_SEARCH_RADIUS_KM,
} from '../types/cabinet.types';
import { WsChargeApiService } from './wscharge-api.service';

/**
 * Cabinet Service
 * Business logic for cabinet management in local database
 */
export class CabinetService {
  private wsChargeApi: WsChargeApiService;

  constructor() {
    this.wsChargeApi = new WsChargeApiService();
  }

  // ==================== CRUD OPERATIONS ====================

  /**
   * Create a new cabinet in the local database
   */
  async createCabinet(data: CreateCabinetRequest): Promise<Cabinet> {
    // Validate cabinet ID format
    if (!CABINET_ID_REGEX.test(data.id)) {
      throw new Error('Invalid cabinet ID format. Expected format: WSTD + 12 digits');
    }

    // Check if cabinet already exists
    const existing = await prisma.cabinet.findUnique({
      where: { id: data.id },
    });

    if (existing) {
      throw new Error(`Cabinet with ID ${data.id} already exists`);
    }

    // Create cabinet
    const cabinet = await prisma.cabinet.create({
      data: {
        id: data.id,
        name: data.name,
        description: data.description,
        location: data.location,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        iotCardNumber: data.iotCardNumber,
        status: CabinetStatus.OFFLINE, // Default to offline until first ping
      },
    });

    logger.info('Cabinet created', { cabinetId: cabinet.id, name: cabinet.name });

    // Try to register with WsCharge API (don't fail if it errors)
    try {
      await this.wsChargeApi.addCabinet({
        device_number: data.id,
        name: data.name,
        qrcode: data.id, // Use cabinet ID as QR code by default
        address: data.address,
        lat: data.latitude.toString(),
        lng: data.longitude.toString(),
      });
      logger.info('Cabinet registered with WsCharge API', { cabinetId: cabinet.id });
    } catch (error) {
      logger.warn('Failed to register cabinet with WsCharge API', {
        cabinetId: cabinet.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return cabinet;
  }

  /**
   * Update a cabinet
   */
  async updateCabinet(id: string, data: UpdateCabinetRequest): Promise<Cabinet> {
    // Check if cabinet exists
    const existing = await prisma.cabinet.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error(`Cabinet with ID ${id} not found`);
    }

    // Update cabinet
    const cabinet = await prisma.cabinet.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.latitude !== undefined && { latitude: data.latitude }),
        ...(data.longitude !== undefined && { longitude: data.longitude }),
        ...(data.status !== undefined && { status: data.status }),
      },
    });

    logger.info('Cabinet updated', { cabinetId: id });

    // Try to update in WsCharge API
    try {
      await this.wsChargeApi.editCabinet({
        device_number: id,
        ...(data.name && { name: data.name }),
        ...(data.address && { address: data.address }),
        ...(data.latitude && { lat: data.latitude.toString() }),
        ...(data.longitude && { lng: data.longitude.toString() }),
      });
      logger.info('Cabinet updated in WsCharge API', { cabinetId: id });
    } catch (error) {
      logger.warn('Failed to update cabinet in WsCharge API', {
        cabinetId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return cabinet;
  }

  /**
   * Delete a cabinet
   */
  async deleteCabinet(id: string): Promise<void> {
    // Check if cabinet exists
    const existing = await prisma.cabinet.findUnique({
      where: { id },
      include: {
        rentals: {
          where: {
            status: 'ACTIVE',
          },
        },
      },
    });

    if (!existing) {
      throw new Error(`Cabinet with ID ${id} not found`);
    }

    // Check for active rentals
    if (existing.rentals.length > 0) {
      throw new Error(`Cannot delete cabinet ${id}. It has ${existing.rentals.length} active rentals`);
    }

    // Delete cabinet (cascade will delete slots and their relations)
    await prisma.cabinet.delete({
      where: { id },
    });

    logger.info('Cabinet deleted', { cabinetId: id });

    // Try to delete from WsCharge API
    try {
      await this.wsChargeApi.deleteCabinet({
        device_number: id,
      });
      logger.info('Cabinet deleted from WsCharge API', { cabinetId: id });
    } catch (error) {
      logger.warn('Failed to delete cabinet from WsCharge API', {
        cabinetId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Update cabinet status
   */
  async updateCabinetStatus(id: string, status: CabinetStatus): Promise<Cabinet> {
    const cabinet = await prisma.cabinet.update({
      where: { id },
      data: { status },
    });

    logger.info('Cabinet status updated', { cabinetId: id, status });

    return cabinet;
  }

  // ==================== READ OPERATIONS ====================

  /**
   * Get all cabinets with filters
   */
  async getAllCabinets(filters?: CabinetFilters): Promise<CabinetListItem[]> {
    const where: Prisma.CabinetWhereInput = {};

    // Apply filters
    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.location) {
      where.location = {
        contains: filters.location,
        mode: 'insensitive',
      };
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { address: { contains: filters.search, mode: 'insensitive' } },
        { location: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const cabinets = await prisma.cabinet.findMany({
      where,
      include: {
        slots: {
          include: {
            powerBank: true,
          },
        },
        _count: {
          select: {
            slots: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform to CabinetListItem with availability
    const cabinetList: CabinetListItem[] = cabinets.map((cabinet) => {
      const totalSlots = cabinet.slots.length;
      const availableSlots = cabinet.slots.filter((slot) => !slot.powerBank).length;
      const availablePowerBanks = cabinet.slots.filter(
        (slot) => slot.powerBank && slot.powerBank.status === PowerBankStatus.AVAILABLE
      ).length;

      // Filter out if hasAvailableSlots filter is applied
      if (filters?.hasAvailableSlots && availablePowerBanks === 0) {
        return null;
      }

      return {
        ...cabinet,
        availability: {
          totalSlots,
          availableSlots,
          availablePowerBanks,
        },
      };
    }).filter((c): c is CabinetListItem => c !== null);

    return cabinetList;
  }

  /**
   * Get cabinet by ID with full details
   */
  async getCabinetById(id: string): Promise<CabinetWithDetails | null> {
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
        _count: {
          select: {
            slots: true,
            rentals: true,
          },
        },
      },
    });

    if (!cabinet) {
      return null;
    }

    // Calculate availability
    const totalSlots = cabinet.slots.length;
    const availableSlots = cabinet.slots.filter((slot) => !slot.powerBank).length;
    const occupiedSlots = totalSlots - availableSlots;
    const availablePowerBanks = cabinet.slots.filter(
      (slot) => slot.powerBank && slot.powerBank.status === PowerBankStatus.AVAILABLE
    ).length;

    return {
      ...cabinet,
      availability: {
        totalSlots,
        availableSlots,
        occupiedSlots,
        availablePowerBanks,
      },
    };
  }

  /**
   * Get nearby cabinets using Haversine formula
   */
  async getNearbyCabinets(params: GetNearbyCabinetsRequest): Promise<CabinetListItem[]> {
    const { latitude, longitude, radius = DEFAULT_SEARCH_RADIUS_KM } = params;

    // Validate radius
    if (radius > MAX_SEARCH_RADIUS_KM) {
      throw new Error(`Search radius cannot exceed ${MAX_SEARCH_RADIUS_KM} km`);
    }

    // Get all online cabinets with location data
    const cabinets = await prisma.cabinet.findMany({
      where: {
        status: CabinetStatus.ONLINE,
        latitude: { not: null },
        longitude: { not: null },
      },
      include: {
        slots: {
          include: {
            powerBank: true,
          },
        },
        _count: {
          select: {
            slots: true,
          },
        },
      },
    });

    // Calculate distance and filter by radius
    const nearbyCabinets: CabinetListItem[] = cabinets
      .map((cabinet) => {
        if (!cabinet.latitude || !cabinet.longitude) {
          return null;
        }

        const distance = this.calculateDistance(
          latitude,
          longitude,
          cabinet.latitude,
          cabinet.longitude
        );

        if (distance > radius) {
          return null;
        }

        const totalSlots = cabinet.slots.length;
        const availableSlots = cabinet.slots.filter((slot) => !slot.powerBank).length;
        const availablePowerBanks = cabinet.slots.filter(
          (slot) => slot.powerBank && slot.powerBank.status === PowerBankStatus.AVAILABLE
        ).length;

        return {
          ...cabinet,
          availability: {
            totalSlots,
            availableSlots,
            availablePowerBanks,
          },
          distance,
        };
      })
      .filter((c): c is CabinetListItem => c !== null)
      .sort((a, b) => (a.distance || 0) - (b.distance || 0)); // Sort by distance

    return nearbyCabinets;
  }

  // ==================== STATISTICS ====================

  /**
   * Get detailed statistics for a cabinet
   */
  async getCabinetStats(id: string): Promise<CabinetStats> {
    const cabinet = await prisma.cabinet.findUnique({
      where: { id },
      include: {
        slots: {
          include: {
            powerBank: true,
          },
        },
        rentals: {
          include: {
            transactions: true,
          },
        },
      },
    });

    if (!cabinet) {
      throw new Error(`Cabinet with ID ${id} not found`);
    }

    // Calculate slot/powerbank stats
    const totalSlots = cabinet.slots.length;
    const availableSlots = cabinet.slots.filter((slot) => !slot.powerBank).length;
    const occupiedSlots = totalSlots - availableSlots;
    const powerBanks = cabinet.slots.filter((slot) => slot.powerBank).map((slot) => slot.powerBank!);
    const totalPowerBanks = powerBanks.length;
    const availablePowerBanks = powerBanks.filter((pb) => pb.status === PowerBankStatus.AVAILABLE).length;
    const rentedPowerBanks = powerBanks.filter((pb) => pb.status === PowerBankStatus.RENTED).length;
    const chargingPowerBanks = powerBanks.filter((pb) => pb.status === PowerBankStatus.CHARGING).length;
    const maintenancePowerBanks = powerBanks.filter(
      (pb) => pb.status === PowerBankStatus.MAINTENANCE || pb.status === PowerBankStatus.DAMAGED
    ).length;

    // Calculate rental stats
    const totalRentals = cabinet.rentals.length;
    const activeRentals = cabinet.rentals.filter((r) => r.status === 'ACTIVE').length;
    const completedRentals = cabinet.rentals.filter((r) => r.status === 'COMPLETED').length;
    const overdueRentals = cabinet.rentals.filter((r) => r.status === 'OVERDUE').length;

    // Calculate revenue
    const allTransactions = cabinet.rentals.flatMap((r) => r.transactions);
    const completedTransactions = allTransactions.filter((t) => t.status === 'COMPLETED');
    const totalRevenue = completedTransactions.reduce((sum, t) => sum + Number(t.amount), 0);

    // Revenue by time period
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayRevenue = completedTransactions
      .filter((t) => t.createdAt >= startOfToday)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const weekRevenue = completedTransactions
      .filter((t) => t.createdAt >= startOfWeek)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const monthRevenue = completedTransactions
      .filter((t) => t.createdAt >= startOfMonth)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // Calculate uptime (simplified - based on last ping)
    const uptimePercentage = this.calculateUptimePercentage(cabinet.lastPingAt, cabinet.status);

    return {
      cabinet,
      stats: {
        totalSlots,
        availableSlots,
        occupiedSlots,
        totalPowerBanks,
        availablePowerBanks,
        rentedPowerBanks,
        chargingPowerBanks,
        maintenancePowerBanks,
      },
      rentals: {
        total: totalRentals,
        active: activeRentals,
        completed: completedRentals,
        overdue: overdueRentals,
      },
      revenue: {
        total: totalRevenue,
        thisMonth: monthRevenue,
        thisWeek: weekRevenue,
        today: todayRevenue,
      },
      uptime: {
        lastPingAt: cabinet.lastPingAt,
        status: cabinet.status,
        uptimePercentage,
      },
    };
  }

  /**
   * Get overview of all cabinets
   */
  async getCabinetsOverview(): Promise<CabinetsOverview> {
    const cabinets = await prisma.cabinet.findMany({
      include: {
        slots: {
          include: {
            powerBank: true,
          },
        },
      },
    });

    const total = cabinets.length;
    const byStatus = {
      online: cabinets.filter((c) => c.status === CabinetStatus.ONLINE).length,
      offline: cabinets.filter((c) => c.status === CabinetStatus.OFFLINE).length,
      maintenance: cabinets.filter((c) => c.status === CabinetStatus.MAINTENANCE).length,
      outOfService: cabinets.filter((c) => c.status === CabinetStatus.OUT_OF_SERVICE).length,
    };

    const totalSlots = cabinets.reduce((sum, c) => sum + c.slots.length, 0);
    const totalAvailableSlots = cabinets.reduce(
      (sum, c) => sum + c.slots.filter((s) => !s.powerBank).length,
      0
    );

    const allPowerBanks = cabinets.flatMap((c) => c.slots.filter((s) => s.powerBank).map((s) => s.powerBank!));
    const totalPowerBanks = allPowerBanks.length;
    const totalAvailablePowerBanks = allPowerBanks.filter((pb) => pb.status === PowerBankStatus.AVAILABLE).length;

    return {
      total,
      byStatus,
      totalSlots,
      totalAvailableSlots,
      totalPowerBanks,
      totalAvailablePowerBanks,
    };
  }

  // ==================== SYNC OPERATIONS ====================

  /**
   * Sync a cabinet with WsCharge API
   */
  async syncCabinetWithWsCharge(id: string): Promise<SyncCabinetResult> {
    try {
      // Get cabinet details from WsCharge API
      const wsChargeDetails = await this.wsChargeApi.getCabinetDetails({
        device_number: id,
      });

      // Update cabinet status
      await prisma.cabinet.update({
        where: { id },
        data: {
          lastPingAt: new Date(),
          status: wsChargeDetails.status === '1' ? CabinetStatus.ONLINE : CabinetStatus.OFFLINE,
        },
      });

      // Sync slots and power banks
      // This would require parsing the slot data from WsCharge
      // For now, we'll just return a basic sync result

      logger.info('Cabinet synced with WsCharge API', { cabinetId: id });

      return {
        success: true,
        cabinetId: id,
        syncedAt: new Date(),
        changes: {
          slotsAdded: 0,
          slotsRemoved: 0,
          powerBanksUpdated: 0,
        },
      };
    } catch (error) {
      logger.error('Failed to sync cabinet with WsCharge API', {
        cabinetId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        cabinetId: id,
        syncedAt: new Date(),
        changes: {
          slotsAdded: 0,
          slotsRemoved: 0,
          powerBanksUpdated: 0,
        },
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in kilometers
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 100) / 100; // Round to 2 decimal places
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate uptime percentage based on last ping and status
   * Simplified version - in production would query historical data
   */
  private calculateUptimePercentage(lastPingAt: Date | null, status: CabinetStatus): number {
    if (!lastPingAt) {
      return 0;
    }

    if (status === CabinetStatus.ONLINE) {
      return 100;
    }

    if (status === CabinetStatus.OUT_OF_SERVICE || status === CabinetStatus.MAINTENANCE) {
      return 0;
    }

    // For OFFLINE, calculate based on last ping
    const now = new Date();
    const hoursSinceLastPing = (now.getTime() - lastPingAt.getTime()) / (1000 * 60 * 60);

    // If last ping was within 24 hours, consider it mostly up
    if (hoursSinceLastPing < 24) {
      return 95;
    }

    // Otherwise, estimate based on days offline
    const daysOffline = Math.floor(hoursSinceLastPing / 24);
    const uptimePercentage = Math.max(0, 100 - daysOffline * 3.33); // ~30 days = 0%

    return Math.round(uptimePercentage);
  }
}

// Export singleton instance
export const cabinetService = new CabinetService();
