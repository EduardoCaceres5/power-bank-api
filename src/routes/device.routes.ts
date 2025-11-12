import express from 'express';
import { deviceAuthController } from '../controllers/deviceAuth.controller';
import { heartbeatController } from '../controllers/heartbeat.controller';
import { authenticateDevice } from '../middleware/auth.middleware';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';

const router = express.Router();

// ==================== DEVICE AUTHENTICATION ====================

/**
 * POST /api/v1/device/auth/login
 * Autentica un dispositivo y retorna un token JWT
 *
 * Body:
 * {
 *   "deviceId": "string",
 *   "deviceSecret": "string"
 * }
 */
router.post('/auth/login', (req, res) => {
  deviceAuthController.login(req, res);
});

/**
 * POST /api/v1/device/auth/register
 * Registra un nuevo dispositivo para un gabinete
 * Requiere autenticación de administrador
 *
 * Body:
 * {
 *   "cabinetId": "string",
 *   "deviceId": "string",
 *   "deviceSecret": "string"
 * }
 */
router.post('/auth/register', authMiddleware, requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN), (req, res) => {
  deviceAuthController.registerDevice(req, res);
});

/**
 * POST /api/v1/device/auth/verify
 * Verifica si el token del dispositivo es válido
 *
 * Headers:
 * Authorization: Bearer {token}
 */
router.post('/auth/verify', (req, res) => {
  deviceAuthController.verifyToken(req, res);
});

/**
 * PUT /api/v1/device/auth/update-secret
 * Actualiza el secret de un dispositivo
 * Requiere autenticación del dispositivo
 *
 * Headers:
 * Authorization: Bearer {token}
 *
 * Body:
 * {
 *   "oldSecret": "string",
 *   "newSecret": "string"
 * }
 */
router.put('/auth/update-secret', authenticateDevice, (req, res) => {
  deviceAuthController.updateSecret(req, res);
});

// ==================== HEARTBEAT & STATUS ====================

/**
 * POST /api/v1/device/heartbeat
 * Envía heartbeat del dispositivo al servidor
 * Requiere autenticación del dispositivo
 *
 * Headers:
 * Authorization: Bearer {token}
 *
 * Body:
 * {
 *   "status": "ONLINE" | "OFFLINE" | "MAINTENANCE" | "OUT_OF_SERVICE",
 *   "signalStrength": number (1-31),
 *   "ipAddress": "string",
 *   "connectionType": "wifi" | "ethernet" | "4g",
 *   "slots": [
 *     {
 *       "slotNumber": number,
 *       "isOccupied": boolean,
 *       "powerBankId": "string",
 *       "batteryLevel": number (0-100)
 *     }
 *   ]
 * }
 */
router.post('/heartbeat', authenticateDevice, (req, res) => {
  heartbeatController.receiveHeartbeat(req, res);
});

/**
 * GET /api/v1/device/status
 * Obtiene el estado actual del gabinete según el servidor
 * Requiere autenticación del dispositivo
 *
 * Headers:
 * Authorization: Bearer {token}
 */
router.get('/status', authenticateDevice, (req, res) => {
  heartbeatController.getStatus(req, res);
});

export default router;
