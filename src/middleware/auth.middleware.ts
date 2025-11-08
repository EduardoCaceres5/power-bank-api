import { Request, Response, NextFunction } from 'express';
import { supabaseClient } from '../lib/supabase';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { authService } from '../services/auth.service';
import { deviceAuthService } from '../services/deviceAuth.service';
import { UserRole } from '@prisma/client';

/**
 * Middleware para autenticar requests usando JWT local o Supabase JWT
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No authorization token provided' });
      return;
    }

    const token = authHeader.split('Bearer ')[1];

    // Intentar primero con JWT local
    try {
      const decoded = authService.verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (user && user.isActive) {
        // Adjuntar usuario al request
        (req as any).user = {
          userId: user.id,
          email: user.email,
          role: user.role,
        };
        req.userId = user.id;
        next();
        return;
      }
    } catch (jwtError) {
      // Si falla JWT local, intentar con Supabase
      logger.debug('JWT local verification failed, trying Supabase');
    }

    // Verificar token con Supabase (fallback)
    const {
      data: { user: supabaseUser },
      error,
    } = await supabaseClient.auth.getUser(token);

    if (error || !supabaseUser) {
      logger.warn('Invalid token', { error: error?.message });
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Sincronizar o crear usuario en Prisma
    const user = await prisma.user.upsert({
      where: { id: supabaseUser.id },
      update: {
        email: supabaseUser.email!,
        phone: supabaseUser.phone,
        fullName: supabaseUser.user_metadata?.full_name,
        avatarUrl: supabaseUser.user_metadata?.avatar_url,
        updatedAt: new Date(),
      },
      create: {
        id: supabaseUser.id,
        email: supabaseUser.email!,
        password: '', // Usuarios de Supabase no tienen password local
        phone: supabaseUser.phone,
        fullName: supabaseUser.user_metadata?.full_name,
        avatarUrl: supabaseUser.user_metadata?.avatar_url,
        role: UserRole.USER,
      },
    });

    // Adjuntar usuario al request
    (req as any).user = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    req.userId = user.id;

    next();
  } catch (error) {
    logger.error('Auth middleware error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Middleware para autenticar requests usando solo JWT local
 */
export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'No authorization token provided'
      });
      return;
    }

    const token = authHeader.split('Bearer ')[1];

    // Verificar token JWT
    const decoded = authService.verifyToken(token);

    // Verificar que el usuario existe y está activo
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        error: 'Account is inactive'
      });
      return;
    }

    // Adjuntar usuario al request
    (req as any).user = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error: any) {
    logger.error('Token authentication error', { error });

    let statusCode = 401;
    let errorMessage = 'Invalid token';

    if (error.message === 'TOKEN_EXPIRED') {
      errorMessage = 'Token has expired';
    } else if (error.message === 'INVALID_TOKEN') {
      errorMessage = 'Invalid token';
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage
    });
  }
}

/**
 * Middleware para verificar roles de usuario
 */
export function requireRole(...roles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized'
        });
        return;
      }

      if (!roles.includes(user.role)) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Role verification error', { error });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
}

/**
 * Middleware opcional - permite requests autenticados y no autenticados
 */
export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  try {
    await authMiddleware(req, res, next);
  } catch (error) {
    // Si falla la autenticación, continuar sin usuario
    next();
  }
}

/**
 * Middleware para autenticar dispositivos (gabinetes)
 */
export async function authenticateDevice(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'No authorization token provided'
      });
      return;
    }

    const token = authHeader.split('Bearer ')[1];

    // Verificar token de dispositivo
    const decoded = deviceAuthService.verifyDeviceToken(token);

    // Verificar que el gabinete existe
    const cabinet = await prisma.cabinet.findUnique({
      where: { id: decoded.cabinetId },
    });

    if (!cabinet) {
      res.status(401).json({
        success: false,
        error: 'Cabinet not found'
      });
      return;
    }

    // Verificar que el deviceId coincida
    if (cabinet.deviceId !== decoded.deviceId) {
      logger.warn(`Device ID mismatch for cabinet ${decoded.cabinetId}`);
      res.status(401).json({
        success: false,
        error: 'Device ID mismatch'
      });
      return;
    }

    // Adjuntar información del dispositivo al request
    (req as any).device = {
      cabinetId: decoded.cabinetId,
      deviceId: decoded.deviceId,
    };

    next();
  } catch (error: any) {
    logger.error('Device authentication error', { error });

    let statusCode = 401;
    let errorMessage = 'Invalid device token';

    if (error.message === 'DEVICE_TOKEN_EXPIRED') {
      errorMessage = 'Device token has expired';
    } else if (error.message === 'INVALID_DEVICE_TOKEN') {
      errorMessage = 'Invalid device token';
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage
    });
  }
}
