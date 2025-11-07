/**
 * WsCharge HTTP API Types
 * Based on API Documentation v1.0.0 (2024-08-23)
 * Base URL: https://api.w-dian.cn/operate
 */

// ==================== COMMON TYPES ====================

export interface ApiResponse<T = any> {
  code: number; // 1: Normal; 0: Failed; 401: Re-login
  data?: T;
  msg: string;
}

// ==================== AUTHENTICATION ====================

export interface LoginRequest {
  name: string; // Account
  password: string; // Password
}

export interface EquipmentModel {
  id: string; // Equipment model ID (e.g., "zs4", "zs6", "pm8")
  name: string; // Model name
  producer: string; // Manufacturer (e.g., "zd")
  num: number; // Number of charging ports
}

export interface LoginResponse {
  token: string; // Secret key, valid for 30 minutes
  ocode: string; // Operator identifier
  equipment_model: EquipmentModel[];
}

// ==================== DEVICE MANAGEMENT ====================

export interface AddCabinetRequest {
  cabinet_id: string; // Cabinet ID
  qrcode: string; // QR code
  model: string; // Equipment model (from equipment_model.id)
  sim?: string; // IoT card number (optional)
}

export interface AddCabinetResponse {
  cabinet_id: string;
}

export interface EditCabinetRequest {
  cabinet_id: string; // Cabinet ID
  qrcode: string; // QR code
  model: string; // Cabinet model
  sim?: string; // IoT card number (optional)
}

export interface CabinetInfoRequest {
  cabinet_id: string; // Cabinet No.
}

export interface CabinetInfo {
  cabinet_id: string;
  qrcode: string;
  model: string;
  volume: number; // Cabinet volume
  network_card: string; // IoT Card
  heart_time: number; // Last heartbeat timestamp
  is_online: number; // 1: Online, 0: Offline
  create_time: number; // Add cabinet timestamp
  update_time: number; // Last modified timestamp
}

export interface DeleteCabinetRequest {
  cabinet_id: string;
}

export interface CabinetListRequest {
  page?: number;
  page_size?: number; // Default 20
  cabinet_id?: string;
  qrcode?: string;
  model?: string;
  is_online?: number; // 1: Online, 0: Offline
}

export interface CabinetListItem {
  cabinet_id: string;
  qrcode: string;
  is_online: number;
  model: string;
  mode: number;
  heart_time: number;
  return_num: number; // Returnable quantity
  borrow_num: number; // Number of rentals
  ip: string; // Device IP address
}

export interface CabinetListResponse {
  total: number;
  list: CabinetListItem[];
  online_num: number;
  offline_num: number;
}

// ==================== BATTERY LIST ====================

export interface BatteryListRequest {
  device_id?: string;
  page?: number;
  page_size?: number; // Default 20
}

export interface BatteryInfo {
  device_id: string;
  create_time: number; // Timestamp
}

export interface BatteryListResponse {
  total: number;
  list: BatteryInfo[];
}

// ==================== DEVICE OPERATIONS ====================

export interface IssueCommandRequest {
  cabinet_id: string;
  type: 'restart' | 'borrow' | 'open' | 'openAll'; // Command type
  lock_id?: number; // Required for: borrow, open
  order_no?: string; // Required for: borrow (max 50 chars)
}

export interface RentCommandResponse {
  msg: string;
  battery_id: string;
  lock_id: string;
  code: number;
}

// ==================== DEVICE DETAILS ====================

export interface CabinetDetailsRequest {
  cabinet_id: string;
}

export interface PowerBankDetail {
  bid: string; // Battery ID (empty if slot is empty)
  power: number | string; // Power level (0-100, or empty string)
  lock: number; // Slot number
  quick_charge: number; // 1: quick charge, 0: normal charge
}

export interface CabinetDetails {
  cabinet_id: string;
  is_online: number; // 1: Online, 0: Offline
  signal: number; // Signal value
  device: PowerBankDetail[];
}

// ==================== SCREEN MANAGEMENT - AD MATERIAL ====================

export interface AddMaterialRequest {
  name?: string; // Material Name
  path: string; // File access address (must be HTTPS)
  type: 'image' | 'video'; // File type
}

export interface AddMaterialResponse {
  id: number; // File ID
}

export interface DeleteMaterialRequest {
  id: number; // File ID
}

export interface MaterialListRequest {
  type?: 'image' | 'video';
  name?: string;
  page?: number;
  page_size?: number; // Default 20
}

export interface MaterialInfo {
  id: number;
  name: string;
  type: 'image' | 'video';
  file: string; // File address
  seconds: number; // Material residence time in seconds
  create_time: number;
}

export interface MaterialListResponse {
  total: number;
  list: MaterialInfo[];
}

// ==================== SCREEN MANAGEMENT - AD GROUP ====================

export interface GroupMaterialDetail {
  material_id: number;
  sort: number; // Sequence
  time: number; // Stay time in seconds
}

export interface AddGroupRequest {
  name: string; // Group Name
  details: GroupMaterialDetail[]; // Material Information (JSON array)
}

export interface AddGroupResponse {
  id: number; // Group ID
}

export interface EditGroupRequest {
  id: number; // Group ID
  name: string; // Group name
  details: GroupMaterialDetail[];
}

export interface DeleteGroupRequest {
  id: number; // Group ID
}

export interface GroupDetailRequest {
  id: number; // Group ID
}

export interface GroupMaterialDetailWithInfo extends GroupMaterialDetail {
  name: string;
  type: 'image' | 'video';
  file: string; // Material address
}

export interface GroupDetail {
  id: number;
  group_name: string;
  details: GroupMaterialDetailWithInfo[];
  create_time: number;
}

export interface GroupListRequest {
  page?: number;
  page_size?: number; // Default 20
  name?: string; // AD plan name
}

export interface GroupListItem {
  id: number;
  group_name: string;
  details: GroupMaterialDetail[];
  create_time: number;
}

export interface GroupListResponse {
  total: number;
  list: GroupListItem[];
}

// ==================== SCREEN MANAGEMENT - AD PLAN ====================

export interface PlanDetail {
  start_hour: number; // Start time hours (0-23)
  start_minute: number; // Start time minutes (0-59)
  end_hour: number; // End time hours (0-23)
  end_minute: number; // End time minutes (0-59)
  group_id: number; // Group ID
}

export interface AddPlanRequest {
  plan_name: string; // Program Name
  start_date: string; // Start Date (Y-m-d format)
  end_date: string; // End Date (Y-m-d format)
  details: PlanDetail[]; // Ad Grouping (JSON array)
  equipment_group: string; // Cabinet numbers (comma-separated)
}

export interface AddPlanResponse {
  id: number; // AD plan ID
}

export interface EditPlanRequest {
  id: number; // Plan ID
  plan_name: string;
  start_date: string; // Y-m-d
  end_date: string; // Y-m-d
  details: PlanDetail[];
  equipment_group: string; // Cabinet numbers (comma-separated)
}

export interface DeletePlanRequest {
  id: number; // Plan ID
}

export interface PlanDetailRequest {
  id: number; // AD plan ID
}

export interface PlanDetailWithGroupInfo extends PlanDetail {
  group_name: string; // Ad Group Name
}

export interface PlanInfo {
  id: number;
  plan_name: string;
  start_date: string;
  end_date: string;
  details: PlanDetailWithGroupInfo[];
  create_time: number;
  equipment_group: string[];
}

export interface PlanListRequest {
  page?: number;
  name?: string; // Plan Name
}

export interface PlanListItem {
  id: number;
  plan_name: string;
  start_date: string;
  end_date: string;
  details: Array<{
    group_id: number;
    group_name: string;
    start_hour: string;
    start_minute: string;
    end_hour: number | string;
    end_minute: number;
  }>;
  create_time: number;
  equipment_group: string[];
}

export interface PlanListResponse {
  total: number;
  list: PlanListItem[];
}

// ==================== SYSTEM SETTINGS ====================

export type SystemConfigType = 'battery_power' | 'screen_default' | 'webhook' | 'qrcode_color';

export interface GetSystemConfigRequest {
  type: SystemConfigType;
}

export interface BatteryPowerConfig {
  battery_power: string; // Minimum power bank capacity that can be borrowed
}

export interface ScreenDefaultConfig {
  screen_default: {
    default_vertical: string; // Default advertising image of large cabinet
    default_bottom: string; // Default bottom image of large cabinet
    rent_success_vertical: string; // Lease Success Picture
    rent_fail_vertical: string; // Failed Rental picture
    back_success_vertical: string; // Return Success Picture
    back_fail_vertical: string; // Failed Rental picture
    default_cross: string; // Default advertising pictures for 8 slot machine
    default_left_cross: string; // Default left image for 8 slot machine
  };
}

export interface WebhookConfig {
  webhook: string; // System power bank return push address
}

export interface QRCodeColorConfig {
  qrcode_color: string; // System QR code background color
}

export type SystemConfig =
  | BatteryPowerConfig
  | ScreenDefaultConfig
  | WebhookConfig
  | QRCodeColorConfig;

export interface SetSystemConfigRequest {
  type: SystemConfigType;
  // For battery_power
  battery_power?: number;
  // For webhook
  webhook?: string;
  // For qrcode_color
  qrcodeColor?: string;
  // For screen_default
  default_vertical?: string;
  default_bottom?: string;
  rent_success_vertical?: string;
  rent_fail_vertical?: string;
  back_success_vertical?: string;
  back_fail_vertical?: string;
  default_cross?: string;
  default_left_cross?: string;
}
