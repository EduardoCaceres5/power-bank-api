import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { CabinetStatus } from '@prisma/client';

/**
 * Servicio para monitorear el estado de los gabinetes
 * Detecta automáticamente gabinetes que no han enviado heartbeat
 * y los marca como offline
 */
export class CabinetMonitorService {
  private cronJob: cron.ScheduledTask | null = null;
  private readonly HEARTBEAT_TIMEOUT_MINUTES: number;
  private readonly CHECK_INTERVAL_MINUTES: number;

  constructor() {
    // Timeout de heartbeat: Si un gabinete no envía heartbeat en este tiempo, se marca como offline
    this.HEARTBEAT_TIMEOUT_MINUTES = parseInt(process.env.HEARTBEAT_TIMEOUT_MINUTES || '5');

    // Intervalo de verificación: Cada cuánto tiempo se verifica el estado de los gabinetes
    this.CHECK_INTERVAL_MINUTES = parseInt(process.env.CABINET_CHECK_INTERVAL_MINUTES || '2');

    logger.info('Servicio de monitoreo de gabinetes inicializado', {
      heartbeatTimeout: `${this.HEARTBEAT_TIMEOUT_MINUTES} minutes`,
      checkInterval: `${this.CHECK_INTERVAL_MINUTES} minutes`,
    });
  }

  /**
   * Inicia el monitoreo de gabinetes
   */
  start(): void {
    if (this.cronJob) {
      logger.warn('Monitor de gabinetes ya está ejecutándose');
      return;
    }

    // Ejecutar inmediatamente una vez al inicio
    this.checkOfflineCabinets();

    // Crear cron job que se ejecuta cada CHECK_INTERVAL_MINUTES
    const cronExpression = `*/${this.CHECK_INTERVAL_MINUTES} * * * *`;

    this.cronJob = cron.schedule(cronExpression, () => {
      this.checkOfflineCabinets();
    });

    logger.info(`Monitor de gabinetes iniciado con expresión cron: ${cronExpression}`);
  }

  /**
   * Detiene el monitoreo de gabinets
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Monitor de gabinetes detenido');
    }
  }

  /**
   * Verifica gabinetes que no han enviado heartbeat y los marca como offline
   */
  async checkOfflineCabinets(): Promise<void> {
    try {
      const timeoutDate = new Date();
      timeoutDate.setMinutes(timeoutDate.getMinutes() - this.HEARTBEAT_TIMEOUT_MINUTES);

      logger.debug('Verificando gabinetes offline', {
        timeoutDate: timeoutDate.toISOString(),
      });

      // Buscar gabinetes que:
      // 1. Están marcados como ONLINE o MAINTENANCE
      // 2. Su último ping fue hace más de HEARTBEAT_TIMEOUT_MINUTES
      // O nunca han enviado un ping
      const result = await prisma.cabinet.updateMany({
        where: {
          status: {
            in: [CabinetStatus.ONLINE, CabinetStatus.MAINTENANCE],
          },
          OR: [
            {
              lastPingAt: {
                lt: timeoutDate,
              },
            },
            {
              lastPingAt: null,
            },
          ],
        },
        data: {
          status: CabinetStatus.OFFLINE,
        },
      });

      if (result.count > 0) {
        logger.warn(`Se marcaron ${result.count} gabinete(s) como OFFLINE debido a timeout de heartbeat`);

        // Obtener detalles de los gabinetes afectados para logging
        const offlineCabinets = await prisma.cabinet.findMany({
          where: {
            status: CabinetStatus.OFFLINE,
            OR: [
              {
                lastPingAt: {
                  lt: timeoutDate,
                },
              },
              {
                lastPingAt: null,
              },
            ],
          },
          select: {
            id: true,
            name: true,
            location: true,
            lastPingAt: true,
          },
        });

        offlineCabinets.forEach(cabinet => {
          logger.info('Gabinete offline', {
            cabinetId: cabinet.id,
            name: cabinet.name,
            location: cabinet.location,
            lastPingAt: cabinet.lastPingAt?.toISOString() || 'never',
          });
        });
      } else {
        logger.debug('Ningún gabinete marcado como offline');
      }
    } catch (error) {
      logger.error('Error al verificar gabinetes offline:', error);
    }
  }

  /**
   * Obtiene estadísticas de conectividad de gabinetes
   */
  async getConnectivityStats(): Promise<{
    total: number;
    online: number;
    offline: number;
    maintenance: number;
    outOfService: number;
  }> {
    try {
      const stats = await prisma.cabinet.groupBy({
        by: ['status'],
        _count: true,
      });

      const result = {
        total: 0,
        online: 0,
        offline: 0,
        maintenance: 0,
        outOfService: 0,
      };

      stats.forEach(stat => {
        result.total += stat._count;
        switch (stat.status) {
          case CabinetStatus.ONLINE:
            result.online = stat._count;
            break;
          case CabinetStatus.OFFLINE:
            result.offline = stat._count;
            break;
          case CabinetStatus.MAINTENANCE:
            result.maintenance = stat._count;
            break;
          case CabinetStatus.OUT_OF_SERVICE:
            result.outOfService = stat._count;
            break;
        }
      });

      return result;
    } catch (error) {
      logger.error('Error al obtener estadísticas de conectividad:', error);
      throw error;
    }
  }

  /**
   * Obtiene gabinetes que están cerca de quedar offline
   * (han pasado más del 50% del tiempo de timeout desde su último heartbeat)
   */
  async getCabinetsNearTimeout(): Promise<any[]> {
    try {
      const halfTimeout = this.HEARTBEAT_TIMEOUT_MINUTES / 2;
      const warningDate = new Date();
      warningDate.setMinutes(warningDate.getMinutes() - halfTimeout);

      const cabinets = await prisma.cabinet.findMany({
        where: {
          status: CabinetStatus.ONLINE,
          lastPingAt: {
            lt: warningDate,
          },
        },
        select: {
          id: true,
          name: true,
          location: true,
          lastPingAt: true,
          deviceId: true,
        },
      });

      return cabinets;
    } catch (error) {
      logger.error('Error al obtener gabinetes cerca del timeout:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const cabinetMonitorService = new CabinetMonitorService();
