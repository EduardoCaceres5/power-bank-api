import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import {
  WsChargeFunctionCode,
  WsChargeLoginMessage,
  WsChargeOfflineMessage,
  WsChargeQueryInventoryRequest,
  WsChargeQueryInventoryResponse,
  WsChargeRentRequest,
  WsChargeRentResponse,
  WsChargeReturnMessage,
  WsChargeForceEjectRequest,
  WsChargeMessage,
} from '../types/wscharge.types';

/**
 * WsCharge Service
 * Maneja la comunicación bidireccional con los gabinetes físicos
 */
export class WsChargeService {
  private io: SocketIOServer;
  private cabinetSockets: Map<string, Socket> = new Map();

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CORS_ORIGINS?.split(',') || '*',
        methods: ['GET', 'POST'],
      },
      path: '/wscharge',
    });

    this.setupEventHandlers();
    logger.info('Servicio WsCharge inicializado');
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.info('Nuevo intento de conexión de gabinete', { socketId: socket.id });

      // Escuchar mensajes del gabinete
      socket.on('message', async (data: WsChargeMessage) => {
        await this.handleMessage(socket, data);
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

      socket.on('error', (error) => {
        logger.error('Error de socket', { error, socketId: socket.id });
      });
    });
  }

  private async handleMessage(socket: Socket, message: WsChargeMessage): Promise<void> {
    try {
      const functionCode = message.I;

      switch (functionCode) {
        case WsChargeFunctionCode.LOGIN:
          await this.handleLogin(socket, message as WsChargeLoginMessage);
          break;

        case WsChargeFunctionCode.OFFLINE:
          await this.handleOffline(socket, message as WsChargeOfflineMessage);
          break;

        case WsChargeFunctionCode.QUERY_INVENTORY:
          await this.handleInventoryResponse(socket, message as WsChargeQueryInventoryResponse);
          break;

        case WsChargeFunctionCode.RENT_POWER_BANK:
          await this.handleRentResponse(socket, message as WsChargeRentResponse);
          break;

        case WsChargeFunctionCode.RETURN_POWER_BANK:
          await this.handleReturn(socket, message as WsChargeReturnMessage);
          break;

        default:
          logger.warn('Código de función desconocido recibido', { functionCode, message });
      }
    } catch (error) {
      logger.error('Error al manejar mensaje', { error, message });
    }
  }

  /**
   * Handler: Cabinet Login (Function 60)
   */
  private async handleLogin(socket: Socket, message: WsChargeLoginMessage): Promise<void> {
    const cabinetId = message.E;

    logger.info('Inicio de sesión de gabinete', { cabinetId });

    try {
      // Actualizar o crear gabinete en la DB
      await prisma.cabinet.upsert({
        where: { id: cabinetId },
        update: {
          status: 'ONLINE',
          lastPingAt: new Date(),
        },
        create: {
          id: cabinetId,
          status: 'ONLINE',
          lastPingAt: new Date(),
        },
      });

      // Guardar socket asociado al gabinete
      this.cabinetSockets.set(cabinetId, socket);

      // Solicitar inventario inicial
      await this.queryInventory(cabinetId);

      logger.info('Gabinete inició sesión exitosamente', { cabinetId });
    } catch (error) {
      logger.error('Error al manejar inicio de sesión de gabinete', { error, cabinetId });
    }
  }

  /**
   * Handler: Cabinet Offline (Function 90)
   */
  private async handleOffline(socket: Socket, message: WsChargeOfflineMessage): Promise<void> {
    const cabinetId = message.E;

    logger.info('Gabinete pasando a offline', { cabinetId });

    try {
      await prisma.cabinet.update({
        where: { id: cabinetId },
        data: {
          status: 'OFFLINE',
        },
      });

      this.cabinetSockets.delete(cabinetId);
    } catch (error) {
      logger.error('Error al manejar gabinete offline', { error, cabinetId });
    }
  }

  /**
   * Handler: Inventory Response (Function 64)
   */
  private async handleInventoryResponse(
    socket: Socket,
    message: WsChargeQueryInventoryResponse
  ): Promise<void> {
    const cabinetId = message.E;

    logger.info('Respuesta de inventario recibida', {
      cabinetId,
      powerBankCount: message.terminalArr?.length || 0,
    });

    try {
      // Actualizar información del gabinete
      await prisma.cabinet.update({
        where: { id: cabinetId },
        data: {
          iotCardNumber: message.K,
          signalStrength: parseInt(message.X, 16), // Convertir de hex a decimal
          lastPingAt: new Date(),
        },
      });

      // Actualizar slots y power banks
      if (message.terminalArr && Array.isArray(message.terminalArr)) {
        for (const powerBankInfo of message.terminalArr) {
          const slotNumber = parseInt(powerBankInfo.E, 10);
          const powerBankId = powerBankInfo.B;
          const batteryLevel = powerBankInfo.D;

          // Buscar o crear slot
          const slot = await prisma.slot.upsert({
            where: {
              cabinetId_slotNumber: {
                cabinetId,
                slotNumber,
              },
            },
            update: {},
            create: {
              cabinetId,
              slotNumber,
            },
          });

          // Actualizar o crear power bank
          await prisma.powerBank.upsert({
            where: { id: powerBankId },
            update: {
              slotId: slot.id,
              batteryLevel,
              status: 'AVAILABLE',
            },
            create: {
              id: powerBankId,
              slotId: slot.id,
              batteryLevel,
              status: 'AVAILABLE',
            },
          });
        }
      }

      logger.info('Inventario actualizado exitosamente', { cabinetId });
    } catch (error) {
      logger.error('Error al actualizar inventario', { error, cabinetId });
    }
  }

  /**
   * Handler: Rent Response (Function 65)
   */
  private async handleRentResponse(
    socket: Socket,
    message: WsChargeRentResponse
  ): Promise<void> {
    const cabinetId = message.E;
    const slotNumber = parseInt(message.L, 10);
    const powerBankId = message.B;
    const statusCode = message.S;

    logger.info('Respuesta de renta recibida', {
      cabinetId,
      slotNumber,
      powerBankId,
      statusCode,
    });

    try {
      if (statusCode === '200') {
        // Actualizar power bank a estado RENTED
        await prisma.powerBank.update({
          where: { id: powerBankId },
          data: {
            status: 'RENTED',
            slotId: null, // Ya no está en el slot
            lastUsedAt: new Date(),
          },
        });

        logger.info('Power bank rentado exitosamente', { powerBankId });
      } else {
        logger.warn('Renta fallida', { cabinetId, slotNumber, statusCode });
      }
    } catch (error) {
      logger.error('Error al manejar respuesta de renta', { error, message });
    }
  }

  /**
   * Handler: Return Power Bank (Function 66)
   */
  private async handleReturn(socket: Socket, message: WsChargeReturnMessage): Promise<void> {
    const cabinetId = message.E;
    const slotNumber = parseInt(message.L, 10);
    const powerBankId = message.B;

    logger.info('Power bank devuelto', { cabinetId, slotNumber, powerBankId });

    try {
      // Buscar slot
      const slot = await prisma.slot.findUnique({
        where: {
          cabinetId_slotNumber: {
            cabinetId,
            slotNumber,
          },
        },
      });

      if (!slot) {
        logger.error('Slot no encontrado para devolución', { cabinetId, slotNumber });
        return;
      }

      // Actualizar power bank
      await prisma.powerBank.update({
        where: { id: powerBankId },
        data: {
          status: 'CHARGING',
          slotId: slot.id,
        },
      });

      // Buscar renta activa y marcarla como completada
      const activeRental = await prisma.rental.findFirst({
        where: {
          powerBankId,
          status: 'ACTIVE',
        },
      });

      if (activeRental) {
        await prisma.rental.update({
          where: { id: activeRental.id },
          data: {
            status: 'COMPLETED',
            returnedAt: new Date(),
            returnCabinetId: cabinetId,
          },
        });

        logger.info('Renta completada', { rentalId: activeRental.id, powerBankId });
      }
    } catch (error) {
      logger.error('Error al manejar devolución', { error, message });
    }
  }

  private handleDisconnect(socket: Socket): void {
    // Encontrar el gabinete asociado
    for (const [cabinetId, cabinetSocket] of this.cabinetSockets.entries()) {
      if (cabinetSocket.id === socket.id) {
        logger.info('Gabinete desconectado', { cabinetId });
        this.cabinetSockets.delete(cabinetId);

        // Marcar como offline
        prisma.cabinet
          .update({
            where: { id: cabinetId },
            data: { status: 'OFFLINE' },
          })
          .catch((error) => {
            logger.error('Error al actualizar estado del gabinete en desconexión', { error, cabinetId });
          });

        break;
      }
    }
  }

  // ==================== PUBLIC METHODS ====================

  /**
   * Query cabinet inventory
   */
  public async queryInventory(cabinetId: string): Promise<void> {
    const socket = this.cabinetSockets.get(cabinetId);

    if (!socket) {
      throw new Error(`Cabinet ${cabinetId} is not connected`);
    }

    const message: WsChargeQueryInventoryRequest = {
      I: WsChargeFunctionCode.QUERY_INVENTORY,
      E: cabinetId,
    };

    socket.emit('message', message);
    logger.info('Inventario consultado', { cabinetId });
  }

  /**
   * Rent power bank from cabinet
   */
  public async rentPowerBank(cabinetId: string, slotNumber: number): Promise<void> {
    const socket = this.cabinetSockets.get(cabinetId);

    if (!socket) {
      throw new Error(`Cabinet ${cabinetId} is not connected`);
    }

    const message: WsChargeRentRequest = {
      I: WsChargeFunctionCode.RENT_POWER_BANK,
      E: cabinetId,
      L: slotNumber.toString().padStart(2, '0'),
    };

    socket.emit('message', message);
    logger.info('Renta solicitada', { cabinetId, slotNumber });
  }

  /**
   * Force eject power bank
   */
  public async forceEject(cabinetId: string, slotNumber: number): Promise<void> {
    const socket = this.cabinetSockets.get(cabinetId);

    if (!socket) {
      throw new Error(`Cabinet ${cabinetId} is not connected`);
    }

    const message: WsChargeForceEjectRequest = {
      I: WsChargeFunctionCode.FORCE_EJECT,
      E: cabinetId,
      L: slotNumber.toString().padStart(2, '0'),
    };

    socket.emit('message', message);
    logger.info('Expulsión forzada', { cabinetId, slotNumber });
  }

  /**
   * Check if cabinet is online
   */
  public isCabinetOnline(cabinetId: string): boolean {
    return this.cabinetSockets.has(cabinetId);
  }

  /**
   * Get all online cabinets
   */
  public getOnlineCabinets(): string[] {
    return Array.from(this.cabinetSockets.keys());
  }
}
