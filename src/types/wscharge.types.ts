/**
 * WsCharge Protocol Types
 * Based on API Documentation v6.0A
 */

// ==================== FUNCTION CODES ====================
export enum WsChargeFunctionCode {
  LOGIN = 60,
  OFFLINE = 90,
  QUERY_INVENTORY = 64,
  RENT_POWER_BANK = 65,
  RETURN_POWER_BANK = 66,
  FORCE_EJECT = 80,
  FULL_EJECT = 81,
  RESTART_DEVICE = 67,
}

// ==================== STATUS CODES ====================
export enum WsChargeStatusCode {
  SUCCESS = 200,
  INVALID_SLOT = 201,
  SLOT_EMPTY = 202,
  SLOT_OCCUPIED = 203,
  DEVICE_ERROR = 204,
  COMMUNICATION_ERROR = 205,
}

// ==================== MESSAGE STRUCTURES ====================

/**
 * Login Message (Function 60)
 * Cabinet -> Server
 */
export interface WsChargeLoginMessage {
  I: number; // Function code: 60
  E: string; // Device code (16 chars): WSTD088888888888
}

/**
 * Offline Message (Function 90)
 * Cabinet -> Server
 */
export interface WsChargeOfflineMessage {
  I: number; // Function code: 90
  E: string; // Device code
}

/**
 * Query Inventory Request (Function 64)
 * Server -> Cabinet
 */
export interface WsChargeQueryInventoryRequest {
  I: number; // Function code: 64
  E: string; // Device code
}

/**
 * Power Bank Info
 */
export interface WsChargePowerBankInfo {
  B: string; // Power bank number (12 chars): WSBA01234567
  E: string; // Slot number (2 chars): "01"
  D: number; // Battery level (0-100)
}

/**
 * Query Inventory Response (Function 64)
 * Cabinet -> Server
 */
export interface WsChargeQueryInventoryResponse {
  I: number; // Function code: 64
  E: string; // Device code
  K: string; // IoT card number (20 chars)
  X: string; // Signal strength (hex format)
  terminalArr: WsChargePowerBankInfo[]; // Array of power banks
}

/**
 * Rent Power Bank Request (Function 65)
 * Server -> Cabinet
 */
export interface WsChargeRentRequest {
  I: number; // Function code: 65
  E: string; // Device code
  L: string; // Slot number (e.g., "03")
}

/**
 * Rent Power Bank Response (Function 65)
 * Cabinet -> Server
 */
export interface WsChargeRentResponse {
  I: number; // Function code: 65
  E: string; // Device code
  L: string; // Slot number
  B: string; // Power bank number
  S: string; // Status code
}

/**
 * Return Power Bank (Function 66)
 * Cabinet -> Server
 */
export interface WsChargeReturnMessage {
  I: number; // Function code: 66
  E: string; // Device code
  L: string; // Slot number
  B: string; // Power bank number
}

/**
 * Force Eject Request (Function 80)
 * Server -> Cabinet
 */
export interface WsChargeForceEjectRequest {
  I: number; // Function code: 80
  E: string; // Device code
  L: string; // Slot number
}

/**
 * Force Eject Response (Function 80)
 * Cabinet -> Server
 */
export interface WsChargeForceEjectResponse {
  I: number; // Function code: 80
  E: string; // Device code
  L: string; // Slot number
  S: string; // Status code
}

/**
 * Full Eject Request (Function 81)
 * Server -> Cabinet
 */
export interface WsChargeFullEjectRequest {
  I: number; // Function code: 81
  E: string; // Device code
}

/**
 * Full Eject Response (Function 81)
 * Cabinet -> Server
 */
export interface WsChargeFullEjectResponse {
  I: number; // Function code: 81
  E: string; // Device code
  S: string; // Status code
}

/**
 * Restart Device Request (Function 67)
 * Server -> Cabinet
 */
export interface WsChargeRestartRequest {
  I: number; // Function code: 67
  E: string; // Device code
}

/**
 * Restart Device Response (Function 67)
 * Cabinet -> Server
 */
export interface WsChargeRestartResponse {
  I: number; // Function code: 67
  E: string; // Device code
  S: string; // Status code
}

// ==================== UTILITY TYPES ====================

export type WsChargeMessage =
  | WsChargeLoginMessage
  | WsChargeOfflineMessage
  | WsChargeQueryInventoryRequest
  | WsChargeQueryInventoryResponse
  | WsChargeRentRequest
  | WsChargeRentResponse
  | WsChargeReturnMessage
  | WsChargeForceEjectRequest
  | WsChargeForceEjectResponse
  | WsChargeFullEjectRequest
  | WsChargeFullEjectResponse
  | WsChargeRestartRequest
  | WsChargeRestartResponse;

export interface WsChargeMessageHandler {
  handleLogin(message: WsChargeLoginMessage): Promise<void>;
  handleOffline(message: WsChargeOfflineMessage): Promise<void>;
  handleInventoryResponse(message: WsChargeQueryInventoryResponse): Promise<void>;
  handleRentResponse(message: WsChargeRentResponse): Promise<void>;
  handleReturn(message: WsChargeReturnMessage): Promise<void>;
}
