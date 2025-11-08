import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { CabinetStatus, PowerBankStatus } from '@prisma/client';

interface SlotUpdate {
  slotNumber: number;
  isOccupied: boolean;
  powerBankId?: string;
  batteryLevel?: number;
}

interface HeartbeatRequest {
  status?: CabinetStatus;
  slots?: SlotUpdate[];
  signalStrength?: number;
  ipAddress?: string;
  connectionType?: string;
}

/**
 * Controller para manejar heartbeats de dispositivos
 */
export class HeartbeatController {
  /**
   * POST /api/v1/device/heartbeat
   * Recibe heartbeat del dispositivo y actualiza estado del gabinete
   */
  async receiveHeartbeat(req: Request, res: Response): Promise<void> {
    try {
      const device = (req as any).device;

      if (!device) {
        res.status(401).json({
          success: false,
          error: 'Device authentication required',
        });
        return;
      }

      const { cabinetId } = device;
      const heartbeatData: HeartbeatRequest = req.body;

      // Validar que el gabinete existe
      const cabinet = await prisma.cabinet.findUnique({
        where: { id: cabinetId },
        include: {
          slots: {
            include: {
              powerBank: true,
            },
          },
        },
      });

      if (!cabinet) {
        res.status(404).json({
          success: false,
          error: 'Cabinet not found',
        });
        return;
      }

      // Preparar datos de actualización
      const updateData: any = {
        lastPingAt: new Date(),
      };

      // Actualizar status si se proporciona
      if (heartbeatData.status && Object.values(CabinetStatus).includes(heartbeatData.status)) {
        updateData.status = heartbeatData.status;
      } else if (cabinet.status === CabinetStatus.OFFLINE) {
        // Si estaba offline, cambiar a online automáticamente
        updateData.status = CabinetStatus.ONLINE;
      }

      // Actualizar información de conexión
      if (heartbeatData.signalStrength !== undefined) {
        updateData.signalStrength = heartbeatData.signalStrength;
      }

      if (heartbeatData.ipAddress) {
        updateData.ipAddress = heartbeatData.ipAddress;
      }

      if (heartbeatData.connectionType) {
        updateData.connectionType = heartbeatData.connectionType;
      }

      // Actualizar gabinete
      const updatedCabinet = await prisma.cabinet.update({
        where: { id: cabinetId },
        data: updateData,
      });

      // Actualizar slots si se proporcionan
      let slotsUpdated = 0;
      if (heartbeatData.slots && Array.isArray(heartbeatData.slots)) {
        for (const slotUpdate of heartbeatData.slots) {
          await this.updateSlot(cabinetId, slotUpdate);
          slotsUpdated++;
        }
      }

      logger.info(`Heartbeat received from cabinet ${cabinetId}`, {
        status: updatedCabinet.status,
        slotsUpdated,
        signalStrength: heartbeatData.signalStrength,
      });

      res.status(200).json({
        success: true,
        message: 'Heartbeat received',
        data: {
          cabinetId,
          status: updatedCabinet.status,
          lastPingAt: updatedCabinet.lastPingAt,
          slotsUpdated,
        },
      });
    } catch (error: any) {
      logger.error('Heartbeat controller error:', error);

      res.status(500).json({
        success: false,
        error: 'Failed to process heartbeat',
      });
    }
  }

  /**
   * Actualiza información de un slot específico
   */
  private async updateSlot(cabinetId: string, slotUpdate: SlotUpdate): Promise<void> {
    try {
      // Buscar el slot
      const slot = await prisma.slot.findFirst({
        where: {
          cabinetId,
          slotNumber: slotUpdate.slotNumber,
        },
        include: {
          powerBank: true,
        },
      });

      if (!slot) {
        // Si el slot no existe, crearlo
        await prisma.slot.create({
          data: {
            cabinetId,
            slotNumber: slotUpdate.slotNumber,
          },
        });
        logger.info(`Created new slot ${slotUpdate.slotNumber} for cabinet ${cabinetId}`);
        return;
      }

      // Si el slot está ocupado
      if (slotUpdate.isOccupied && slotUpdate.powerBankId) {
        // Verificar si el power bank existe
        let powerBank = await prisma.powerBank.findUnique({
          where: { id: slotUpdate.powerBankId },
        });

        // Si no existe, crearlo
        if (!powerBank) {
          powerBank = await prisma.powerBank.create({
            data: {
              id: slotUpdate.powerBankId,
              slotId: slot.id,
              batteryLevel: slotUpdate.batteryLevel || 0,
              status: PowerBankStatus.CHARGING,
            },
          });
          logger.info(`Created new power bank ${slotUpdate.powerBankId} in slot ${slot.id}`);
        } else {
          // Si existe, actualizar
          const updatePowerBankData: any = {
            slotId: slot.id,
          };

          if (slotUpdate.batteryLevel !== undefined) {
            updatePowerBankData.batteryLevel = slotUpdate.batteryLevel;
          }

          // Si está en el slot y no está rentado, está cargando o disponible
          if (powerBank.status !== PowerBankStatus.RENTED) {
            if (slotUpdate.batteryLevel !== undefined && slotUpdate.batteryLevel < 100) {
              updatePowerBankData.status = PowerBankStatus.CHARGING;
            } else {
              updatePowerBankData.status = PowerBankStatus.AVAILABLE;
            }
          }

          await prisma.powerBank.update({
            where: { id: slotUpdate.powerBankId },
            data: updatePowerBankData,
          });
        }
      } else if (!slotUpdate.isOccupied && slot.powerBank) {
        // Si el slot ya no está ocupado, remover la asociación
        await prisma.powerBank.update({
          where: { id: slot.powerBank.id },
          data: {
            slotId: null,
          },
        });
        logger.info(`Power bank ${slot.powerBank.id} removed from slot ${slot.id}`);
      }
    } catch (error) {
      logger.error(`Error updating slot ${slotUpdate.slotNumber}:`, error);
      throw error;
    }
  }

  /**
   * GET /api/v1/device/status
   * Obtiene el estado actual del gabinete según el servidor
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const device = (req as any).device;

      if (!device) {
        res.status(401).json({
          success: false,
          error: 'Device authentication required',
        });
        return;
      }

      const { cabinetId } = device;

      // Obtener estado del gabinete
      const cabinet = await prisma.cabinet.findUnique({
        where: { id: cabinetId },
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
        res.status(404).json({
          success: false,
          error: 'Cabinet not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          cabinetId: cabinet.id,
          status: cabinet.status,
          lastPingAt: cabinet.lastPingAt,
          signalStrength: cabinet.signalStrength,
          slots: cabinet.slots.map(slot => ({
            slotNumber: slot.slotNumber,
            isOccupied: !!slot.powerBank,
            powerBank: slot.powerBank ? {
              id: slot.powerBank.id,
              batteryLevel: slot.powerBank.batteryLevel,
              status: slot.powerBank.status,
            } : null,
          })),
        },
      });
    } catch (error: any) {
      logger.error('Get device status controller error:', error);

      res.status(500).json({
        success: false,
        error: 'Failed to get device status',
      });
    }
  }
}

// Export singleton instance
export const heartbeatController = new HeartbeatController();
