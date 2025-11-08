import { Request, Response } from 'express';
import { deviceAuthService } from '../services/deviceAuth.service';
import { logger } from '../lib/logger';

/**
 * Controller para autenticación de dispositivos (gabinetes)
 */
export class DeviceAuthController {
  /**
   * POST /api/v1/device/auth/login
   * Autentica un dispositivo y retorna un token JWT
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId, deviceSecret } = req.body;

      // Validar datos requeridos
      if (!deviceId || !deviceSecret) {
        res.status(400).json({
          success: false,
          error: 'deviceId and deviceSecret are required',
        });
        return;
      }

      // Autenticar dispositivo
      const result = await deviceAuthService.login({
        deviceId,
        deviceSecret,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Device login controller error:', error);

      let statusCode = 500;
      let errorMessage = 'Internal server error';

      if (error.message === 'INVALID_DEVICE_CREDENTIALS') {
        statusCode = 401;
        errorMessage = 'Invalid device credentials';
      } else if (error.message === 'DEVICE_NOT_CONFIGURED') {
        statusCode = 400;
        errorMessage = 'Device not configured';
      } else if (error.message === 'CABINET_OUT_OF_SERVICE') {
        statusCode = 403;
        errorMessage = 'Cabinet is out of service';
      }

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
      });
    }
  }

  /**
   * POST /api/v1/device/auth/register
   * Registra un nuevo dispositivo para un gabinete
   * Requiere autenticación de administrador
   */
  async registerDevice(req: Request, res: Response): Promise<void> {
    try {
      const { cabinetId, deviceId, deviceSecret } = req.body;

      // Validar datos requeridos
      if (!cabinetId || !deviceId || !deviceSecret) {
        res.status(400).json({
          success: false,
          error: 'cabinetId, deviceId and deviceSecret are required',
        });
        return;
      }

      // Validar longitud del secret (mínimo 16 caracteres)
      if (deviceSecret.length < 16) {
        res.status(400).json({
          success: false,
          error: 'deviceSecret must be at least 16 characters long',
        });
        return;
      }

      // Registrar dispositivo
      await deviceAuthService.registerDevice(cabinetId, deviceId, deviceSecret);

      res.status(201).json({
        success: true,
        message: 'Device registered successfully',
        data: {
          cabinetId,
          deviceId,
        },
      });
    } catch (error: any) {
      logger.error('Register device controller error:', error);

      let statusCode = 500;
      let errorMessage = 'Internal server error';

      if (error.message === 'CABINET_NOT_FOUND') {
        statusCode = 404;
        errorMessage = 'Cabinet not found';
      } else if (error.message === 'CABINET_ALREADY_HAS_DEVICE') {
        statusCode = 409;
        errorMessage = 'Cabinet already has a device registered';
      } else if (error.message === 'DEVICE_ALREADY_REGISTERED') {
        statusCode = 409;
        errorMessage = 'Device ID already registered to another cabinet';
      }

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
      });
    }
  }

  /**
   * POST /api/v1/device/auth/verify
   * Verifica si el token del dispositivo es válido
   */
  async verifyToken(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: 'No authorization token provided',
        });
        return;
      }

      const token = authHeader.split('Bearer ')[1];

      // Verificar token
      const decoded = deviceAuthService.verifyDeviceToken(token);

      res.status(200).json({
        success: true,
        data: {
          valid: true,
          cabinetId: decoded.cabinetId,
          deviceId: decoded.deviceId,
        },
      });
    } catch (error: any) {
      logger.error('Verify device token controller error:', error);

      let statusCode = 401;
      let errorMessage = 'Invalid device token';

      if (error.message === 'DEVICE_TOKEN_EXPIRED') {
        errorMessage = 'Device token has expired';
      }

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
        data: {
          valid: false,
        },
      });
    }
  }

  /**
   * PUT /api/v1/device/auth/update-secret
   * Actualiza el secret de un dispositivo
   * Requiere autenticación del dispositivo
   */
  async updateSecret(req: Request, res: Response): Promise<void> {
    try {
      const device = (req as any).device;
      const { oldSecret, newSecret } = req.body;

      if (!device) {
        res.status(401).json({
          success: false,
          error: 'Device authentication required',
        });
        return;
      }

      // Validar datos requeridos
      if (!oldSecret || !newSecret) {
        res.status(400).json({
          success: false,
          error: 'oldSecret and newSecret are required',
        });
        return;
      }

      // Validar longitud del nuevo secret
      if (newSecret.length < 16) {
        res.status(400).json({
          success: false,
          error: 'newSecret must be at least 16 characters long',
        });
        return;
      }

      // Actualizar secret
      await deviceAuthService.updateDeviceSecret(
        device.cabinetId,
        oldSecret,
        newSecret
      );

      res.status(200).json({
        success: true,
        message: 'Device secret updated successfully',
      });
    } catch (error: any) {
      logger.error('Update device secret controller error:', error);

      let statusCode = 500;
      let errorMessage = 'Internal server error';

      if (error.message === 'INVALID_DEVICE_CREDENTIALS') {
        statusCode = 401;
        errorMessage = 'Invalid current secret';
      } else if (error.message === 'CABINET_NOT_FOUND') {
        statusCode = 404;
        errorMessage = 'Cabinet not found';
      } else if (error.message === 'DEVICE_NOT_CONFIGURED') {
        statusCode = 400;
        errorMessage = 'Device not configured';
      }

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
      });
    }
  }
}

// Export singleton instance
export const deviceAuthController = new DeviceAuthController();
