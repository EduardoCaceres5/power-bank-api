import { UserRole } from '@prisma/client';

// ==================== REQUEST/RESPONSE TYPES ====================

export interface RegisterRequest {
  email: string;
  password: string;
  fullName?: string;
  phone?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  data?: {
    user: UserPayload;
    token: string;
    expiresIn: number;
  };
  error?: string;
}

// ==================== USER PAYLOAD ====================

export interface UserPayload {
  id: string;
  email: string;
  fullName?: string | null;
  phone?: string | null;
  role: UserRole;
  avatarUrl?: string | null;
  isActive: boolean;
  emailVerified: boolean;
}

// ==================== JWT TOKEN ====================

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// ==================== PASSWORD ====================

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  newPassword: string;
}

// ==================== VALIDATION ====================

export const passwordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false,
};

// ==================== ERROR CODES ====================

export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  ACCOUNT_INACTIVE = 'ACCOUNT_INACTIVE',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
}
