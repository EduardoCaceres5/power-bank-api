import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { cabinetService } from '../services/cabinet.service';
import { CabinetStatus, PowerBankStatus, RentalStatus, TransactionStatus } from '@prisma/client';

export class AdminController {
  /**
   * GET /api/admin/dashboard
   * Get dashboard overview with key metrics
   */
  async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      // Get cabinet overview
      const cabinetsOverview = await cabinetService.getCabinetsOverview();

      // Get rental stats
      const [
        totalRentals,
        activeRentals,
        completedRentals,
        overdueRentals,
        todayRentals,
      ] = await Promise.all([
        prisma.rental.count(),
        prisma.rental.count({ where: { status: RentalStatus.ACTIVE } }),
        prisma.rental.count({ where: { status: RentalStatus.COMPLETED } }),
        prisma.rental.count({ where: { status: RentalStatus.OVERDUE } }),
        prisma.rental.count({
          where: {
            rentedAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
      ]);

      // Get revenue stats
      const completedTransactions = await prisma.transaction.findMany({
        where: { status: TransactionStatus.COMPLETED },
        select: { amount: true, createdAt: true },
      });

      const totalRevenue = completedTransactions.reduce(
        (sum, t) => sum + Number(t.amount),
        0
      );

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

      // Get user stats
      const [totalUsers, activeUsers, newUsersToday] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({
          where: {
            createdAt: {
              gte: startOfToday,
            },
          },
        }),
      ]);

      // Get recent activity
      const recentRentals = await prisma.rental.findMany({
        take: 10,
        orderBy: { rentedAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
          cabinet: {
            select: {
              id: true,
              name: true,
              location: true,
            },
          },
          powerBank: {
            select: {
              id: true,
              batteryLevel: true,
            },
          },
        },
      });

      // Get system alerts
      const alerts = await this.getSystemAlerts();

      res.json({
        success: true,
        data: {
          cabinets: cabinetsOverview,
          rentals: {
            total: totalRentals,
            active: activeRentals,
            completed: completedRentals,
            overdue: overdueRentals,
            today: todayRentals,
          },
          revenue: {
            total: totalRevenue,
            today: todayRevenue,
            thisWeek: weekRevenue,
            thisMonth: monthRevenue,
          },
          users: {
            total: totalUsers,
            active: activeUsers,
            newToday: newUsersToday,
          },
          recentActivity: recentRentals,
          alerts,
        },
      });
    } catch (error) {
      logger.error('Error getting dashboard data', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get dashboard data',
      });
    }
  }

  /**
   * GET /api/admin/cabinets/stats
   * Get overall cabinet statistics
   */
  async getCabinetsStats(req: Request, res: Response): Promise<void> {
    try {
      const overview = await cabinetService.getCabinetsOverview();

      // Get additional stats
      const cabinets = await prisma.cabinet.findMany({
        include: {
          rentals: {
            include: {
              transactions: true,
            },
          },
        },
      });

      // Calculate revenue per cabinet
      const cabinetRevenue = cabinets.map((cabinet) => {
        const transactions = cabinet.rentals.flatMap((r) => r.transactions);
        const completedTransactions = transactions.filter(
          (t) => t.status === TransactionStatus.COMPLETED
        );
        const revenue = completedTransactions.reduce(
          (sum, t) => sum + Number(t.amount),
          0
        );

        return {
          cabinetId: cabinet.id,
          name: cabinet.name,
          location: cabinet.location,
          revenue,
          totalRentals: cabinet.rentals.length,
        };
      });

      // Sort by revenue
      cabinetRevenue.sort((a, b) => b.revenue - a.revenue);

      res.json({
        success: true,
        data: {
          overview,
          topCabinets: cabinetRevenue.slice(0, 10),
          allCabinets: cabinetRevenue,
        },
      });
    } catch (error) {
      logger.error('Error getting cabinets stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get cabinets stats',
      });
    }
  }

  /**
   * GET /api/admin/rentals/stats
   * Get rental statistics
   */
  async getRentalsStats(req: Request, res: Response): Promise<void> {
    try {
      const { period = '30d' } = req.query;

      // Calculate date range
      const now = new Date();
      let startDate = new Date();

      switch (period) {
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(now.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        default:
          startDate.setDate(now.getDate() - 30);
      }

      // Get rentals in period
      const rentals = await prisma.rental.findMany({
        where: {
          rentedAt: {
            gte: startDate,
          },
        },
        include: {
          transactions: true,
          cabinet: {
            select: {
              id: true,
              name: true,
              location: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      // Calculate stats
      const totalRentals = rentals.length;
      const activeRentals = rentals.filter((r) => r.status === RentalStatus.ACTIVE).length;
      const completedRentals = rentals.filter((r) => r.status === RentalStatus.COMPLETED).length;
      const overdueRentals = rentals.filter((r) => r.status === RentalStatus.OVERDUE).length;
      const lostRentals = rentals.filter((r) => r.status === RentalStatus.LOST).length;

      // Calculate average rental duration for completed rentals
      const completedRentalsData = rentals.filter(
        (r) => r.status === RentalStatus.COMPLETED && r.returnedAt
      );

      const averageDuration =
        completedRentalsData.length > 0
          ? completedRentalsData.reduce((sum, r) => {
              const duration = r.returnedAt!.getTime() - r.rentedAt.getTime();
              return sum + duration / (1000 * 60 * 60); // Convert to hours
            }, 0) / completedRentalsData.length
          : 0;

      // Group by day
      const rentalsByDay = rentals.reduce((acc, rental) => {
        const date = rental.rentedAt.toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Top users
      const userRentals = rentals.reduce((acc, rental) => {
        const userId = rental.userId;
        if (!acc[userId]) {
          acc[userId] = {
            userId,
            email: rental.user.email,
            count: 0,
          };
        }
        acc[userId].count++;
        return acc;
      }, {} as Record<string, { userId: string; email: string; count: number }>);

      const topUsers = Object.values(userRentals)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      res.json({
        success: true,
        data: {
          summary: {
            total: totalRentals,
            active: activeRentals,
            completed: completedRentals,
            overdue: overdueRentals,
            lost: lostRentals,
            averageDurationHours: Math.round(averageDuration * 100) / 100,
          },
          byDay: rentalsByDay,
          topUsers,
          period,
        },
      });
    } catch (error) {
      logger.error('Error getting rentals stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get rentals stats',
      });
    }
  }

  /**
   * GET /api/admin/revenue/stats
   * Get revenue statistics
   */
  async getRevenueStats(req: Request, res: Response): Promise<void> {
    try {
      const { period = '30d' } = req.query;

      // Calculate date range
      const now = new Date();
      let startDate = new Date();

      switch (period) {
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(now.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        default:
          startDate.setDate(now.getDate() - 30);
      }

      // Get transactions in period
      const transactions = await prisma.transaction.findMany({
        where: {
          createdAt: {
            gte: startDate,
          },
          status: TransactionStatus.COMPLETED,
        },
        include: {
          rental: {
            include: {
              cabinet: {
                select: {
                  id: true,
                  name: true,
                  location: true,
                },
              },
            },
          },
        },
      });

      // Calculate total revenue
      const totalRevenue = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

      // Group by type
      const byType = transactions.reduce((acc, t) => {
        const type = t.type;
        if (!acc[type]) {
          acc[type] = 0;
        }
        acc[type] += Number(t.amount);
        return acc;
      }, {} as Record<string, number>);

      // Group by day
      const byDay = transactions.reduce((acc, t) => {
        const date = t.createdAt.toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = 0;
        }
        acc[date] += Number(t.amount);
        return acc;
      }, {} as Record<string, number>);

      // Revenue by cabinet
      const byCabinet = transactions
        .filter((t) => t.rental?.cabinet)
        .reduce((acc, t) => {
          const cabinetId = t.rental!.cabinet!.id;
          if (!acc[cabinetId]) {
            acc[cabinetId] = {
              cabinetId,
              name: t.rental!.cabinet!.name,
              location: t.rental!.cabinet!.location,
              revenue: 0,
            };
          }
          acc[cabinetId].revenue += Number(t.amount);
          return acc;
        }, {} as Record<string, { cabinetId: string; name: string | null; location: string | null; revenue: number }>);

      const topCabinets = Object.values(byCabinet)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      res.json({
        success: true,
        data: {
          summary: {
            total: totalRevenue,
            transactionCount: transactions.length,
            averageTransaction:
              transactions.length > 0
                ? Math.round((totalRevenue / transactions.length) * 100) / 100
                : 0,
          },
          byType,
          byDay,
          topCabinets,
          period,
        },
      });
    } catch (error) {
      logger.error('Error getting revenue stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get revenue stats',
      });
    }
  }

  /**
   * GET /api/admin/alerts
   * Get system alerts
   */
  async getAlerts(req: Request, res: Response): Promise<void> {
    try {
      const alerts = await this.getSystemAlerts();

      res.json({
        success: true,
        data: alerts,
      });
    } catch (error) {
      logger.error('Error getting alerts', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get alerts',
      });
    }
  }

  /**
   * Helper method to generate system alerts
   */
  private async getSystemAlerts(): Promise<
    Array<{
      type: 'warning' | 'error' | 'info';
      message: string;
      count?: number;
      timestamp: Date;
    }>
  > {
    const alerts: Array<{
      type: 'warning' | 'error' | 'info';
      message: string;
      count?: number;
      timestamp: Date;
    }> = [];

    // Check for offline cabinets
    const offlineCabinets = await prisma.cabinet.count({
      where: { status: CabinetStatus.OFFLINE },
    });
    if (offlineCabinets > 0) {
      alerts.push({
        type: 'warning',
        message: `${offlineCabinets} cabinet(s) are offline`,
        count: offlineCabinets,
        timestamp: new Date(),
      });
    }

    // Check for overdue rentals
    const overdueRentals = await prisma.rental.count({
      where: { status: RentalStatus.OVERDUE },
    });
    if (overdueRentals > 0) {
      alerts.push({
        type: 'error',
        message: `${overdueRentals} rental(s) are overdue`,
        count: overdueRentals,
        timestamp: new Date(),
      });
    }

    // Check for lost power banks
    const lostPowerBanks = await prisma.powerBank.count({
      where: { status: PowerBankStatus.LOST },
    });
    if (lostPowerBanks > 0) {
      alerts.push({
        type: 'error',
        message: `${lostPowerBanks} power bank(s) reported as lost`,
        count: lostPowerBanks,
        timestamp: new Date(),
      });
    }

    // Check for low battery power banks
    const lowBatteryPowerBanks = await prisma.powerBank.count({
      where: {
        status: PowerBankStatus.CHARGING,
        batteryLevel: { lt: 20 },
      },
    });
    if (lowBatteryPowerBanks > 0) {
      alerts.push({
        type: 'warning',
        message: `${lowBatteryPowerBanks} power bank(s) have low battery (<20%)`,
        count: lowBatteryPowerBanks,
        timestamp: new Date(),
      });
    }

    // Check for damaged power banks
    const damagedPowerBanks = await prisma.powerBank.count({
      where: { status: PowerBankStatus.DAMAGED },
    });
    if (damagedPowerBanks > 0) {
      alerts.push({
        type: 'warning',
        message: `${damagedPowerBanks} power bank(s) are damaged`,
        count: damagedPowerBanks,
        timestamp: new Date(),
      });
    }

    // Check for cabinets in maintenance
    const maintenanceCabinets = await prisma.cabinet.count({
      where: { status: CabinetStatus.MAINTENANCE },
    });
    if (maintenanceCabinets > 0) {
      alerts.push({
        type: 'info',
        message: `${maintenanceCabinets} cabinet(s) are under maintenance`,
        count: maintenanceCabinets,
        timestamp: new Date(),
      });
    }

    return alerts;
  }
}

export const adminController = new AdminController();
