import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import {
  RegisterRequest,
  LoginRequest,
  UserPayload,
  JWTPayload,
  AuthErrorCode,
  passwordRequirements,
} from '../types/auth.types';
import { UserRole } from '@prisma/client';

export class AuthService {
  private readonly JWT_SECRET: string;
  private readonly JWT_EXPIRES_IN: string;
  private readonly SALT_ROUNDS = 10;

  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
    this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

    if (!process.env.JWT_SECRET) {
      logger.warn('JWT_SECRET no configurado en las variables de entorno, usando valor por defecto (no seguro para producción)');
    }
  }

  // ==================== REGISTRATION ====================

  async register(data: RegisterRequest): Promise<{ user: UserPayload; token: string }> {
    try {
      // Validar formato de email
      if (!this.isValidEmail(data.email)) {
        throw new Error('Invalid email format');
      }

      // Validar contraseña
      this.validatePassword(data.password);

      // Verificar si el usuario ya existe
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email.toLowerCase() },
      });

      if (existingUser) {
        throw new Error(AuthErrorCode.USER_ALREADY_EXISTS);
      }

      // Hash de la contraseña
      const hashedPassword = await bcrypt.hash(data.password, this.SALT_ROUNDS);

      // Crear usuario
      const user = await prisma.user.create({
        data: {
          email: data.email.toLowerCase(),
          password: hashedPassword,
          fullName: data.fullName,
          phone: data.phone,
          role: UserRole.USER,
          isActive: true,
          emailVerified: false,
        },
      });

      logger.info(`Nuevo usuario registrado: ${user.email}`);

      // Generar token
      const token = this.generateToken(user.id, user.email, user.role);

      // Retornar usuario sin password
      const userPayload = this.mapUserToPayload(user);

      return { user: userPayload, token };
    } catch (error) {
      logger.error('Error de registro:', error);
      throw error;
    }
  }

  // ==================== LOGIN ====================

  async login(data: LoginRequest): Promise<{ user: UserPayload; token: string }> {
    try {
      // Buscar usuario por email
      const user = await prisma.user.findUnique({
        where: { email: data.email.toLowerCase() },
      });

      if (!user) {
        throw new Error(AuthErrorCode.INVALID_CREDENTIALS);
      }

      // Verificar si la cuenta está activa
      if (!user.isActive) {
        throw new Error(AuthErrorCode.ACCOUNT_INACTIVE);
      }

      // Verificar contraseña
      const isPasswordValid = await bcrypt.compare(data.password, user.password);

      if (!isPasswordValid) {
        throw new Error(AuthErrorCode.INVALID_CREDENTIALS);
      }

      // Actualizar último login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      logger.info(`Usuario inició sesión: ${user.email}`);

      // Generar token
      const token = this.generateToken(user.id, user.email, user.role);

      // Retornar usuario sin password
      const userPayload = this.mapUserToPayload(user);

      return { user: userPayload, token };
    } catch (error) {
      logger.error('Error de inicio de sesión:', error);
      throw error;
    }
  }

  // ==================== TOKEN VERIFICATION ====================

  verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as JWTPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error(AuthErrorCode.TOKEN_EXPIRED);
      }
      throw new Error(AuthErrorCode.INVALID_TOKEN);
    }
  }

  // ==================== GET USER BY ID ====================

  async getUserById(userId: string): Promise<UserPayload | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return null;
      }

      return this.mapUserToPayload(user);
    } catch (error) {
      logger.error('Error al obtener usuario por ID:', error);
      throw error;
    }
  }

  // ==================== PASSWORD CHANGE ====================

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error(AuthErrorCode.USER_NOT_FOUND);
      }

      // Verificar contraseña actual
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

      if (!isPasswordValid) {
        throw new Error(AuthErrorCode.INVALID_CREDENTIALS);
      }

      // Validar nueva contraseña
      this.validatePassword(newPassword);

      // Hash de la nueva contraseña
      const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

      // Actualizar contraseña
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      logger.info(`Contraseña cambiada para usuario: ${user.email}`);
    } catch (error) {
      logger.error('Error al cambiar contraseña:', error);
      throw error;
    }
  }

  // ==================== HELPER METHODS ====================

  private generateToken(userId: string, email: string, role: UserRole): string {
    const payload: JWTPayload = {
      userId,
      email,
      role,
    };

    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN,
    });
  }

  private mapUserToPayload(user: any): UserPayload {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
    };
  }

  private validatePassword(password: string): void {
    if (password.length < passwordRequirements.minLength) {
      throw new Error(`Password must be at least ${passwordRequirements.minLength} characters long`);
    }

    if (passwordRequirements.requireUppercase && !/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }

    if (passwordRequirements.requireLowercase && !/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }

    if (passwordRequirements.requireNumbers && !/[0-9]/.test(password)) {
      throw new Error('Password must contain at least one number');
    }

    if (passwordRequirements.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      throw new Error('Password must contain at least one special character');
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // ==================== GET TOKEN EXPIRATION ====================

  getTokenExpirationTime(): number {
    // Retorna el tiempo de expiración en segundos
    const match = this.JWT_EXPIRES_IN.match(/(\d+)([dhms])/);
    if (!match) return 7 * 24 * 60 * 60; // Default: 7 días

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'd': return value * 24 * 60 * 60;
      case 'h': return value * 60 * 60;
      case 'm': return value * 60;
      case 's': return value;
      default: return 7 * 24 * 60 * 60;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
