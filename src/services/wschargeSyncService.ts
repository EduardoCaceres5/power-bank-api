import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { CabinetStatus } from '@prisma/client';
import { wsChargeApiService } from './wscharge-api.service';

/**
 * Servicio para sincronizar el estado de gabinetes desde WsCharge API
 * Consulta periódicamente a WsCharge y actualiza la base de datos local
 */
export class WsChargeSyncService {
  private cronJob: cron.ScheduledTask | null = null;
  private readonly SYNC_INTERVAL_SECONDS: number;
  private isRunning = false;

  constructor() {
    // Intervalo de sincronización: Cada cuánto tiempo se consulta a WsCharge
    // Por defecto: 30 segundos
    this.SYNC_INTERVAL_SECONDS = parseInt(process.env.WSCHARGE_SYNC_INTERVAL_SECONDS || '30');

    logger.info('WsCharge Sync Service initialized', {
      syncInterval: `${this.SYNC_INTERVAL_SECONDS} seconds`,
    });
  }

  /**
   * Inicia la sincronización automática
   */
  start(): void {
    if (this.cronJob) {
      logger.warn('WsCharge sync already running');
      return;
    }

    // Ejecutar inmediatamente una vez al inicio
    this.syncCabinets();

    // Crear cron job que se ejecuta cada SYNC_INTERVAL_SECONDS
    const cronExpression = `*/${this.SYNC_INTERVAL_SECONDS} * * * * *`;

    this.cronJob = cron.schedule(cronExpression, () => {
      this.syncCabinets();
    });

    logger.info(`WsCharge sync started with cron expression: ${cronExpression}`);
  }

  /**
   * Detiene la sincronización
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('WsCharge sync stopped');
    }
  }

  /**
   * Sincroniza el estado de los gabinetes desde WsCharge API
   */
  async syncCabinets(): Promise<void> {
    // Evitar ejecuciones simultáneas
    if (this.isRunning) {
      logger.debug('Sync already in progress, skipping...');
      return;
    }

    this.isRunning = true;

    try {
      logger.debug('Starting WsCharge cabinet sync...');

      // 1. Asegurar autenticación con WsCharge
      const isAuthenticated = await wsChargeApiService.ensureAuthenticated();
      if (!isAuthenticated) {
        logger.error('Failed to authenticate with WsCharge');
        return;
      }

      // 2. Obtener lista de gabinetes desde WsCharge
      const response = await wsChargeApiService.getCabinetList({
        page: 1,
        limit: 100,
      });

      if (!response.success) {
        logger.error('Failed to get cabinet list from WsCharge', {
          message: response.message,
        });
        return;
      }

      const cabinets = response.data?.list || [];
      logger.debug(`Syncing ${cabinets.length} cabinets from WsCharge`);

      // 3. Actualizar cada gabinete en la base de datos
      let updated = 0;
      let created = 0;

      for (const cabinet of cabinets) {
        try {
          // WsCharge usa 'cabinet_id' o 'device_number'
          const cabinetId = cabinet.cabinet_id || cabinet.device_number;
          if (!cabinetId) {
            logger.warn('Cabinet without ID found, skipping', { cabinet });
            continue;
          }

          const isOnline = cabinet.is_online === 1;
          const status: CabinetStatus = isOnline ? CabinetStatus.ONLINE : CabinetStatus.OFFLINE;

          // Verificar si ya existe
          const existing = await prisma.cabinet.findUnique({
            where: { id: cabinetId },
          });

          if (existing) {
            // Actualizar existente (solo si cambió el estado o hace mucho que no se actualiza)
            if (existing.status !== status || this.shouldUpdate(existing.updatedAt)) {
              await prisma.cabinet.update({
                where: { id: cabinetId },
                data: {
                  status,
                  lastPingAt: isOnline ? new Date() : existing.lastPingAt,
                  signalStrength: cabinet.signal || existing.signalStrength,
                  updatedAt: new Date(),
                },
              });
              updated++;

              if (existing.status !== status) {
                logger.info(`Cabinet status changed: ${cabinetId}`, {
                  from: existing.status,
                  to: status,
                });
              }
            }
          } else {
            // Crear nuevo gabinete
            await prisma.cabinet.create({
              data: {
                id: cabinetId,
                name: cabinet.name || `Gabinete ${cabinetId}`,
                status,
                location: cabinet.location || 'Sin ubicación',
                address: cabinet.address,
                latitude: cabinet.latitude ? parseFloat(cabinet.latitude) : null,
                longitude: cabinet.longitude ? parseFloat(cabinet.longitude) : null,
                signalStrength: cabinet.signal || null,
                lastPingAt: isOnline ? new Date() : null,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
            created++;

            logger.info(`New cabinet discovered and added: ${cabinetId}`);
          }
        } catch (error) {
          logger.error('Error syncing cabinet', {
            cabinet,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      if (updated > 0 || created > 0) {
        logger.info('WsCharge sync completed', {
          total: cabinets.length,
          updated,
          created,
          skipped: cabinets.length - updated - created,
        });
      } else {
        logger.debug('WsCharge sync completed - no changes');
      }

    } catch (error) {
      logger.error('Error in WsCharge sync', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Determina si un gabinete debe actualizarse basándose en su última actualización
   * Para evitar actualizaciones innecesarias, solo actualiza si han pasado más de 5 minutos
   */
  private shouldUpdate(lastUpdate: Date): boolean {
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
    return lastUpdate < fiveMinutesAgo;
  }

  /**
   * Obtiene estadísticas de la última sincronización
   */
  async getSyncStats(): Promise<{
    lastSync: Date | null;
    totalCabinets: number;
    onlineCabinets: number;
    offlineCabinets: number;
  }> {
    try {
      const cabinets = await prisma.cabinet.findMany({
        select: {
          id: true,
          status: true,
          updatedAt: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      return {
        lastSync: cabinets[0]?.updatedAt || null,
        totalCabinets: cabinets.length,
        onlineCabinets: cabinets.filter(c => c.status === CabinetStatus.ONLINE).length,
        offlineCabinets: cabinets.filter(c => c.status === CabinetStatus.OFFLINE).length,
      };
    } catch (error) {
      logger.error('Error getting sync stats:', error);
      throw error;
    }
  }

  /**
   * Fuerza una sincronización manual inmediata
   */
  async forceSyncNow(): Promise<void> {
    logger.info('Forcing immediate WsCharge sync...');
    await this.syncCabinets();
  }
}

// Export singleton instance
export const wsChargeSyncService = new WsChargeSyncService();
