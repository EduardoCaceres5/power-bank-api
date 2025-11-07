import { CabinetStatus, PowerBankStatus, Cabinet, Slot, PowerBank } from '@prisma/client';

// ==================== REQUEST DTOs ====================

export interface CreateCabinetRequest {
  id: string; // Cabinet ID in WSTD format (e.g., WSTD088888888888)
  name: string;
  description?: string;
  location: string;
  address: string;
  latitude: number;
  longitude: number;
  iotCardNumber?: string;
}

export interface UpdateCabinetRequest {
  name?: string;
  description?: string;
  location?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  status?: CabinetStatus;
}

export interface UpdateCabinetStatusRequest {
  status: CabinetStatus;
}

export interface GetNearbyCabinetsRequest {
  latitude: number;
  longitude: number;
  radius?: number; // in kilometers, default 5
}

export interface CabinetFilters {
  status?: CabinetStatus;
  location?: string;
  hasAvailableSlots?: boolean;
  search?: string; // Search in name, description, address
}

// ==================== RESPONSE DTOs ====================

export interface CabinetWithDetails extends Cabinet {
  slots: SlotWithPowerBank[];
  _count: {
    slots: number;
    rentals: number;
  };
  availability: {
    totalSlots: number;
    availableSlots: number;
    occupiedSlots: number;
    availablePowerBanks: number;
  };
}

export interface SlotWithPowerBank extends Slot {
  powerBank: PowerBank | null;
}

export interface CabinetListItem extends Cabinet {
  _count: {
    slots: number;
  };
  availability: {
    totalSlots: number;
    availableSlots: number;
    availablePowerBanks: number;
  };
  distance?: number; // in kilometers, for nearby search
}

export interface CabinetStats {
  cabinet: Cabinet;
  stats: {
    totalSlots: number;
    availableSlots: number;
    occupiedSlots: number;
    totalPowerBanks: number;
    availablePowerBanks: number;
    rentedPowerBanks: number;
    chargingPowerBanks: number;
    maintenancePowerBanks: number;
  };
  rentals: {
    total: number;
    active: number;
    completed: number;
    overdue: number;
  };
  revenue: {
    total: number;
    thisMonth: number;
    thisWeek: number;
    today: number;
  };
  uptime: {
    lastPingAt: Date | null;
    status: CabinetStatus;
    uptimePercentage: number; // last 30 days
  };
}

export interface CabinetsOverview {
  total: number;
  byStatus: {
    online: number;
    offline: number;
    maintenance: number;
    outOfService: number;
  };
  totalSlots: number;
  totalAvailableSlots: number;
  totalPowerBanks: number;
  totalAvailablePowerBanks: number;
}

// ==================== SYNC DTOs ====================

export interface SyncCabinetResult {
  success: boolean;
  cabinetId: string;
  syncedAt: Date;
  changes: {
    slotsAdded: number;
    slotsRemoved: number;
    powerBanksUpdated: number;
  };
  errors?: string[];
}

export interface BulkSyncResult {
  totalCabinets: number;
  successful: number;
  failed: number;
  results: SyncCabinetResult[];
}

// ==================== VALIDATION SCHEMAS ====================

export const CABINET_ID_REGEX = /^WSTD\d{12}$/;
export const POWERBANK_ID_REGEX = /^WSBA\d{8}$/;

export const LATITUDE_RANGE = { min: -90, max: 90 };
export const LONGITUDE_RANGE = { min: -180, max: 180 };
export const DEFAULT_SEARCH_RADIUS_KM = 5;
export const MAX_SEARCH_RADIUS_KM = 50;

// ==================== UTILITY TYPES ====================

export interface CabinetLocation {
  cabinetId: string;
  name: string;
  location: string;
  address: string;
  latitude: number;
  longitude: number;
  distance?: number;
}

export interface PowerBankAvailability {
  cabinetId: string;
  cabinetName: string;
  available: number;
  total: number;
  slots: {
    slotNumber: number;
    hasPowerBank: boolean;
    powerBankId?: string;
    batteryLevel?: number;
    status?: PowerBankStatus;
  }[];
}
