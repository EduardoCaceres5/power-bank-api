import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { logger } from '../lib/logger';
import {
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  PasswordChangeRequest,
} from '../types/auth.types';

export class AuthController {
  // ==================== REGISTER ====================

  async register(req: Request, res: Response): Promise<void> {
    try {
      const data: RegisterRequest = req.body;

      // Validar datos requeridos
      if (!data.email || !data.password) {
        res.status(400).json({
          success: false,
          error: 'Email and password are required',
        });
        return;
      }

      const result = await authService.register(data);

      const response: AuthResponse = {
        success: true,
        data: {
          user: result.user,
          token: result.token,
          expiresIn: authService.getTokenExpirationTime(),
        },
      };

      res.status(201).json(response);
    } catch (error: any) {
      logger.error('Error en controlador de registro:', error);

      let statusCode = 500;
      let errorMessage = 'Registration failed';

      if (error.message === 'USER_ALREADY_EXISTS') {
        statusCode = 409;
        errorMessage = 'User with this email already exists';
      } else if (error.message.includes('Password')) {
        statusCode = 400;
        errorMessage = error.message;
      } else if (error.message.includes('email')) {
        statusCode = 400;
        errorMessage = error.message;
      }

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
      });
    }
  }

  // ==================== LOGIN ====================

  async login(req: Request, res: Response): Promise<void> {
    try {
      const data: LoginRequest = req.body;

      // Validar datos requeridos
      if (!data.email || !data.password) {
        res.status(400).json({
          success: false,
          error: 'Email and password are required',
        });
        return;
      }

      const result = await authService.login(data);

      const response: AuthResponse = {
        success: true,
        data: {
          user: result.user,
          token: result.token,
          expiresIn: authService.getTokenExpirationTime(),
        },
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error('Error en controlador de inicio de sesión:', error);

      let statusCode = 500;
      let errorMessage = 'Login failed';

      if (error.message === 'INVALID_CREDENTIALS') {
        statusCode = 401;
        errorMessage = 'Invalid email or password';
      } else if (error.message === 'ACCOUNT_INACTIVE') {
        statusCode = 403;
        errorMessage = 'Account is inactive. Please contact support';
      }

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
      });
    }
  }

  // ==================== GET CURRENT USER ====================

  async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      // El userId viene del middleware de autenticación
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const user = await authService.getUserById(userId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error: any) {
      logger.error('Error en controlador de obtener usuario actual:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user information',
      });
    }
  }

  // ==================== CHANGE PASSWORD ====================

  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const data: PasswordChangeRequest = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      if (!data.currentPassword || !data.newPassword) {
        res.status(400).json({
          success: false,
          error: 'Current password and new password are required',
        });
        return;
      }

      await authService.changePassword(userId, data.currentPassword, data.newPassword);

      res.status(200).json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error: any) {
      logger.error('Error en controlador de cambio de contraseña:', error);

      let statusCode = 500;
      let errorMessage = 'Failed to change password';

      if (error.message === 'INVALID_CREDENTIALS') {
        statusCode = 401;
        errorMessage = 'Current password is incorrect';
      } else if (error.message.includes('Password')) {
        statusCode = 400;
        errorMessage = error.message;
      }

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
      });
    }
  }

  // ==================== LOGOUT ====================

  async logout(req: Request, res: Response): Promise<void> {
    try {
      // En un sistema JWT stateless, el logout es principalmente del lado del cliente
      // (eliminando el token del localStorage/sessionStorage)
      // Aquí podemos registrar el evento si es necesario

      const userId = (req as any).user?.userId;
      if (userId) {
        logger.info(`User logged out: ${userId}`);
      }

      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error: any) {
      logger.error('Error en controlador de cierre de sesión:', error);
      res.status(500).json({
        success: false,
        error: 'Logout failed',
      });
    }
  }

  // ==================== VERIFY TOKEN ====================

  async verifyToken(req: Request, res: Response): Promise<void> {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        res.status(401).json({
          success: false,
          error: 'No token provided',
        });
        return;
      }

      const decoded = authService.verifyToken(token);
      const user = await authService.getUserById(decoded.userId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          valid: true,
          user,
        },
      });
    } catch (error: any) {
      logger.error('Error en controlador de verificación de token:', error);

      let statusCode = 401;
      let errorMessage = 'Invalid token';

      if (error.message === 'TOKEN_EXPIRED') {
        errorMessage = 'Token has expired';
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
}

// Export singleton instance
export const authController = new AuthController();
