import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { CabinetStatus } from '@prisma/client';

interface DeviceLoginRequest {
  deviceId: string;
  deviceSecret: string;
}

interface DeviceJWTPayload {
  cabinetId: string;
  deviceId: string;
  type: 'device';
}

interface DeviceLoginResponse {
  token: string;
  cabinetId: string;
  expiresIn: number;
}

export class DeviceAuthService {
  private readonly JWT_SECRET: string;
  private readonly JWT_EXPIRES_IN: string;
  private readonly SALT_ROUNDS = 10;

  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
    // Los dispositivos tienen tokens de menor duración por seguridad
    this.JWT_EXPIRES_IN = process.env.DEVICE_JWT_EXPIRES_IN || '24h';

    if (!process.env.JWT_SECRET) {
      logger.warn('JWT_SECRET not set in environment variables, using default (not secure for production)');
    }
  }

  // ==================== DEVICE LOGIN ====================

  async login(data: DeviceLoginRequest): Promise<DeviceLoginResponse> {
    try {
      // Buscar gabinete por deviceId
      const cabinet = await prisma.cabinet.findUnique({
        where: { deviceId: data.deviceId },
      });

      if (!cabinet) {
        logger.warn(`Device login failed: deviceId not found - ${data.deviceId}`);
        throw new Error('INVALID_DEVICE_CREDENTIALS');
      }

      if (!cabinet.deviceSecret) {
        logger.error(`Cabinet ${cabinet.id} has no deviceSecret configured`);
        throw new Error('DEVICE_NOT_CONFIGURED');
      }

      // Verificar deviceSecret
      const isSecretValid = await bcrypt.compare(data.deviceSecret, cabinet.deviceSecret);

      if (!isSecretValid) {
        logger.warn(`Device login failed: invalid secret for deviceId - ${data.deviceId}`);
        throw new Error('INVALID_DEVICE_CREDENTIALS');
      }

      // Verificar que el gabinete no esté fuera de servicio
      if (cabinet.status === CabinetStatus.OUT_OF_SERVICE) {
        throw new Error('CABINET_OUT_OF_SERVICE');
      }

      logger.info(`Device authenticated successfully: ${data.deviceId} (Cabinet: ${cabinet.id})`);

      // Generar token
      const token = this.generateDeviceToken(cabinet.id, data.deviceId);
      const expiresIn = this.getTokenExpirationTime();

      return {
        token,
        cabinetId: cabinet.id,
        expiresIn,
      };
    } catch (error) {
      logger.error('Device login error:', error);
      throw error;
    }
  }

  // ==================== TOKEN VERIFICATION ====================

  verifyDeviceToken(token: string): DeviceJWTPayload {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as DeviceJWTPayload;

      // Verificar que sea un token de dispositivo
      if (decoded.type !== 'device') {
        throw new Error('INVALID_DEVICE_TOKEN');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('DEVICE_TOKEN_EXPIRED');
      }
      throw new Error('INVALID_DEVICE_TOKEN');
    }
  }

  // ==================== GET CABINET BY DEVICE ID ====================

  async getCabinetByDeviceId(deviceId: string) {
    try {
      const cabinet = await prisma.cabinet.findUnique({
        where: { deviceId },
        include: {
          slots: {
            include: {
              powerBank: true,
            },
          },
        },
      });

      return cabinet;
    } catch (error) {
      logger.error('Get cabinet by deviceId error:', error);
      throw error;
    }
  }

  // ==================== REGISTER NEW DEVICE ====================

  async registerDevice(cabinetId: string, deviceId: string, deviceSecret: string): Promise<string> {
    try {
      // Verificar que el gabinete existe
      const cabinet = await prisma.cabinet.findUnique({
        where: { id: cabinetId },
      });

      if (!cabinet) {
        throw new Error('CABINET_NOT_FOUND');
      }

      // Verificar que el deviceId no esté ya registrado
      if (cabinet.deviceId && cabinet.deviceId !== deviceId) {
        throw new Error('CABINET_ALREADY_HAS_DEVICE');
      }

      const existingDevice = await prisma.cabinet.findUnique({
        where: { deviceId },
      });

      if (existingDevice && existingDevice.id !== cabinetId) {
        throw new Error('DEVICE_ALREADY_REGISTERED');
      }

      // Hash del deviceSecret
      const hashedSecret = await bcrypt.hash(deviceSecret, this.SALT_ROUNDS);

      // Actualizar gabinete con credenciales del dispositivo
      await prisma.cabinet.update({
        where: { id: cabinetId },
        data: {
          deviceId,
          deviceSecret: hashedSecret,
        },
      });

      logger.info(`Device registered successfully: ${deviceId} for cabinet ${cabinetId}`);

      return hashedSecret;
    } catch (error) {
      logger.error('Register device error:', error);
      throw error;
    }
  }

  // ==================== UPDATE DEVICE SECRET ====================

  async updateDeviceSecret(cabinetId: string, oldSecret: string, newSecret: string): Promise<void> {
    try {
      const cabinet = await prisma.cabinet.findUnique({
        where: { id: cabinetId },
      });

      if (!cabinet) {
        throw new Error('CABINET_NOT_FOUND');
      }

      if (!cabinet.deviceSecret) {
        throw new Error('DEVICE_NOT_CONFIGURED');
      }

      // Verificar el secret actual
      const isSecretValid = await bcrypt.compare(oldSecret, cabinet.deviceSecret);

      if (!isSecretValid) {
        throw new Error('INVALID_DEVICE_CREDENTIALS');
      }

      // Hash del nuevo secret
      const hashedNewSecret = await bcrypt.hash(newSecret, this.SALT_ROUNDS);

      // Actualizar
      await prisma.cabinet.update({
        where: { id: cabinetId },
        data: { deviceSecret: hashedNewSecret },
      });

      logger.info(`Device secret updated for cabinet ${cabinetId}`);
    } catch (error) {
      logger.error('Update device secret error:', error);
      throw error;
    }
  }

  // ==================== HELPER METHODS ====================

  private generateDeviceToken(cabinetId: string, deviceId: string): string {
    const payload: DeviceJWTPayload = {
      cabinetId,
      deviceId,
      type: 'device',
    };

    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN,
    });
  }

  private getTokenExpirationTime(): number {
    // Retorna el tiempo de expiración en segundos
    const match = this.JWT_EXPIRES_IN.match(/(\d+)([dhms])/);
    if (!match) return 24 * 60 * 60; // Default: 24 horas

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'd': return value * 24 * 60 * 60;
      case 'h': return value * 60 * 60;
      case 'm': return value * 60;
      case 's': return value;
      default: return 24 * 60 * 60;
    }
  }
}

// Export singleton instance
export const deviceAuthService = new DeviceAuthService();
