import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from '../lib/logger';
import {
  ApiResponse,
  LoginRequest,
  LoginResponse,
  AddCabinetRequest,
  AddCabinetResponse,
  EditCabinetRequest,
  CabinetInfoRequest,
  CabinetInfo,
  DeleteCabinetRequest,
  CabinetListRequest,
  CabinetListResponse,
  BatteryListRequest,
  BatteryListResponse,
  IssueCommandRequest,
  RentCommandResponse,
  CabinetDetailsRequest,
  CabinetDetails,
  AddMaterialRequest,
  AddMaterialResponse,
  DeleteMaterialRequest,
  MaterialListRequest,
  MaterialListResponse,
  AddGroupRequest,
  AddGroupResponse,
  EditGroupRequest,
  DeleteGroupRequest,
  GroupDetailRequest,
  GroupDetail,
  GroupListRequest,
  GroupListResponse,
  AddPlanRequest,
  AddPlanResponse,
  EditPlanRequest,
  DeletePlanRequest,
  PlanDetailRequest,
  PlanInfo,
  PlanListRequest,
  PlanListResponse,
  GetSystemConfigRequest,
  SystemConfig,
  SetSystemConfigRequest,
} from '../types/wscharge-api.types';

/**
 * WsCharge HTTP API Service
 * Handles communication with WsCharge power bank cabinet API
 * Base URL: https://api.w-dian.cn/operate
 */
export class WsChargeApiService {
  private client: AxiosInstance;
  private token: string | null = null;
  private ocode: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private readonly TOKEN_VALIDITY_MINUTES = 30;

  constructor() {
    const baseURL = process.env.WSCHARGE_API_URL || 'https://api.w-dian.cn/operate';

    // Get ocode from environment - this is required for ALL requests including login
    this.ocode = process.env.WSCHARGE_OCODE || null;

    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    // Request interceptor to add auth headers
    this.client.interceptors.request.use(
      (config) => {
        // Always add ocode header if available (required for ALL requests)
        if (this.ocode) {
          config.headers['ocode'] = this.ocode;
        }
        // Add token header for authenticated requests (not for login)
        if (this.token && config.url !== '/auth/login') {
          config.headers['token'] = this.token;
        }
        return config;
      },
      (error) => {
        logger.error('Request interceptor error', { error });
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<ApiResponse>) => {
        if (error.response) {
          const { code, msg } = error.response.data || {};

          // Handle 401 - Re-login required
          if (code === 401) {
            logger.warn('Token expired, re-login required');
            this.clearAuth();
            // Optionally trigger auto re-login here
          }

          logger.error('API Error Response', {
            code,
            msg,
            url: error.config?.url,
            method: error.config?.method,
          });
        } else if (error.request) {
          logger.error('API No Response', {
            url: error.config?.url,
            method: error.config?.method,
          });
        } else {
          logger.error('API Request Setup Error', { message: error.message });
        }

        return Promise.reject(error);
      }
    );

    logger.info('WsCharge API Service initialized', { baseURL });
  }

  // ==================== HELPER METHODS ====================

  /**
   * Convert object to URLSearchParams for form-data
   */
  private toFormData(data: Record<string, any>): string {
    const formData = new URLSearchParams();
    Object.keys(data).forEach((key) => {
      const value = data[key];
      if (value !== undefined && value !== null) {
        formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      }
    });
    return formData.toString();
  }

  // ==================== AUTHENTICATION ====================

  /**
   * Login to WsCharge API
   * Endpoint: POST /auth/login
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      logger.info('Attempting to login to WsCharge API', { name: credentials.name });

      const response = await this.client.post<ApiResponse<LoginResponse>>(
        '/auth/login',
        this.toFormData(credentials)
      );

      if (response.data.code === 1 && response.data.data) {
        this.token = response.data.data.token;
        // Don't overwrite ocode if already set from environment
        if (!this.ocode) {
          this.ocode = response.data.data.ocode;
        }
        this.tokenExpiresAt = new Date(Date.now() + this.TOKEN_VALIDITY_MINUTES * 60 * 1000);

        logger.info('Successfully logged in to WsCharge API', {
          ocode: this.ocode,
          tokenExpiresAt: this.tokenExpiresAt,
        });

        return response.data.data;
      } else {
        throw new Error(response.data.msg || 'Login failed');
      }
    } catch (error) {
      logger.error('Login failed', { error });
      throw error;
    }
  }

  /**
   * Check if token is valid
   */
  isAuthenticated(): boolean {
    if (!this.token || !this.tokenExpiresAt) {
      return false;
    }
    return new Date() < this.tokenExpiresAt;
  }

  /**
   * Clear authentication data
   */
  clearAuth(): void {
    this.token = null;
    this.ocode = null;
    this.tokenExpiresAt = null;
    logger.info('Authentication cleared');
  }

  /**
   * Ensure authenticated before making API calls
   * Auto-login using credentials from environment variables
   */
  private async ensureAuthenticated(): Promise<void> {
    const isAuth = this.isAuthenticated();
    logger.debug('Checking authentication status', {
      isAuthenticated: isAuth,
      hasToken: !!this.token,
      tokenExpiresAt: this.tokenExpiresAt,
      currentTime: new Date()
    });

    if (!isAuth) {
      // Auto re-login if credentials are available
      const username = process.env.WSCHARGE_USERNAME;
      const password = process.env.WSCHARGE_PASSWORD;

      if (!username || !password) {
        const error = 'Not authenticated and WsCharge credentials not found. Please set WSCHARGE_USERNAME and WSCHARGE_PASSWORD environment variables';
        logger.error(error);
        throw new Error(error);
      }

      try {
        logger.info('Token expired or missing, attempting auto-login', { username });
        await this.login({ name: username, password });
        logger.info('Auto-login successful', {
          hasToken: !!this.token,
          tokenExpiresAt: this.tokenExpiresAt
        });
      } catch (error: any) {
        logger.error('Auto-login failed', {
          error: error.message || error,
          username,
          stack: error.stack
        });
        throw new Error(`Failed to authenticate with WsCharge API: ${error.message || 'Unknown error'}`);
      }
    } else {
      logger.debug('Already authenticated, skipping login');
    }
  }

  /**
   * Initialize authentication on service startup if credentials are available
   */
  async initialize(): Promise<void> {
    const username = process.env.WSCHARGE_USERNAME;
    const password = process.env.WSCHARGE_PASSWORD;

    if (username && password) {
      try {
        logger.info('Initializing WsCharge API service with auto-login');
        await this.login({ name: username, password });
      } catch (error) {
        logger.error('Failed to auto-login on initialization', { error });
        // Don't throw - allow service to start, will retry on first API call
      }
    } else {
      logger.warn('WsCharge credentials not found in environment. Manual login required or will auto-login on first API call.');
    }
  }

  // ==================== DEVICE MANAGEMENT ====================

  /**
   * Add Cabinet
   * Endpoint: POST /equipment/add
   */
  async addCabinet(data: AddCabinetRequest): Promise<AddCabinetResponse> {
    await this.ensureAuthenticated();

    try {
      logger.info('Adding cabinet', { cabinet_id: data.cabinet_id });

      const response = await this.client.post<ApiResponse<AddCabinetResponse>>(
        '/equipment/add',
        this.toFormData(data)
      );

      if (response.data.code === 1 && response.data.data) {
        logger.info('Cabinet added successfully', { cabinet_id: data.cabinet_id });
        return response.data.data;
      } else {
        throw new Error(response.data.msg || 'Failed to add cabinet');
      }
    } catch (error) {
      logger.error('Failed to add cabinet', { error, data });
      throw error;
    }
  }

  /**
   * Edit Cabinet
   * Endpoint: POST /equipment/edit
   */
  async editCabinet(data: EditCabinetRequest): Promise<void> {
    await this.ensureAuthenticated();

    try {
      logger.info('Editing cabinet', { cabinet_id: data.cabinet_id });

      const response = await this.client.post<ApiResponse>('/equipment/edit', this.toFormData(data));

      if (response.data.code !== 1) {
        throw new Error(response.data.msg || 'Failed to edit cabinet');
      }

      logger.info('Cabinet edited successfully', { cabinet_id: data.cabinet_id });
    } catch (error) {
      logger.error('Failed to edit cabinet', { error, data });
      throw error;
    }
  }

  /**
   * Get Cabinet Information
   * Endpoint: POST /equipment/info
   */
  async getCabinetInfo(data: CabinetInfoRequest): Promise<CabinetInfo> {
    await this.ensureAuthenticated();

    try {
      logger.info('Getting cabinet info', { cabinet_id: data.cabinet_id });

      const response = await this.client.post<ApiResponse<CabinetInfo>>('/equipment/info', this.toFormData(data));

      if (response.data.code === 1 && response.data.data) {
        return response.data.data;
      } else {
        throw new Error(response.data.msg || 'Failed to get cabinet info');
      }
    } catch (error) {
      logger.error('Failed to get cabinet info', { error, data });
      throw error;
    }
  }

  /**
   * Delete Cabinet
   * Endpoint: POST /equipment/delete
   */
  async deleteCabinet(data: DeleteCabinetRequest): Promise<void> {
    await this.ensureAuthenticated();

    try {
      logger.info('Deleting cabinet', { cabinet_id: data.cabinet_id });

      const response = await this.client.post<ApiResponse>('/equipment/delete', this.toFormData(data));

      if (response.data.code !== 1) {
        throw new Error(response.data.msg || 'Failed to delete cabinet');
      }

      logger.info('Cabinet deleted successfully', { cabinet_id: data.cabinet_id });
    } catch (error) {
      logger.error('Failed to delete cabinet', { error, data });
      throw error;
    }
  }

  /**
   * Get Cabinet List
   * Endpoint: GET /equipment/index
   */
  async getCabinetList(params?: CabinetListRequest): Promise<CabinetListResponse> {
    try {
      await this.ensureAuthenticated();

      logger.info('Getting cabinet list', { params, authenticated: this.isAuthenticated(), hasToken: !!this.token });

      const response = await this.client.get<ApiResponse<CabinetListResponse>>(
        '/equipment/index',
        { params: { page: 1, ...params } }
      );

      if (response.data.code === 1 && response.data.data) {
        logger.info('Cabinet list retrieved successfully', { count: response.data.data.list?.length });
        return response.data.data;
      } else {
        const errorMsg = response.data.msg || 'Failed to get cabinet list';
        logger.error('Cabinet list API returned error', { code: response.data.code, msg: errorMsg });
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      logger.error('Failed to get cabinet list', {
        error: error.message || error,
        params,
        authenticated: this.isAuthenticated(),
        hasToken: !!this.token,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get Battery List
   * Endpoint: GET /equipment/batteryList
   */
  async getBatteryList(params?: BatteryListRequest): Promise<BatteryListResponse> {
    try {
      await this.ensureAuthenticated();

      logger.info('Getting battery list', { params, authenticated: this.isAuthenticated(), hasToken: !!this.token });

      const response = await this.client.get<ApiResponse<BatteryListResponse>>(
        '/equipment/batteryList',
        { params: { page: 1, ...params } }
      );

      if (response.data.code === 1 && response.data.data) {
        logger.info('Battery list retrieved successfully', { count: response.data.data.list?.length });
        return response.data.data;
      } else {
        const errorMsg = response.data.msg || 'Failed to get battery list';
        logger.error('Battery list API returned error', { code: response.data.code, msg: errorMsg });
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      logger.error('Failed to get battery list', {
        error: error.message || error,
        params,
        authenticated: this.isAuthenticated(),
        hasToken: !!this.token,
        stack: error.stack
      });
      throw error;
    }
  }

  // ==================== DEVICE OPERATIONS ====================

  /**
   * Issue Command to Cabinet
   * Endpoint: POST /equipment/operate
   * Commands: restart, borrow, open, openAll
   */
  async issueCommand(data: IssueCommandRequest): Promise<RentCommandResponse | void> {
    await this.ensureAuthenticated();

    try {
      logger.info('Issuing command to cabinet', { cabinet_id: data.cabinet_id, type: data.type });

      const response = await this.client.post<ApiResponse<RentCommandResponse>>(
        '/equipment/operate',
        this.toFormData(data)
      );

      if (response.data.code === 1) {
        logger.info('Command issued successfully', { cabinet_id: data.cabinet_id, type: data.type });

        // Return data if it's a borrow command
        if (data.type === 'borrow' && response.data.data) {
          return response.data.data;
        }
      } else {
        throw new Error(response.data.msg || 'Failed to issue command');
      }
    } catch (error) {
      logger.error('Failed to issue command', { error, data });
      throw error;
    }
  }

  /**
   * Get Cabinet Details (current power bank information)
   * Endpoint: POST /equipment/detail
   */
  async getCabinetDetails(data: CabinetDetailsRequest): Promise<CabinetDetails> {
    await this.ensureAuthenticated();

    try {
      logger.info('Getting cabinet details', { cabinet_id: data.cabinet_id });

      const response = await this.client.post<ApiResponse<CabinetDetails>>(
        '/equipment/detail',
        this.toFormData(data)
      );

      if (response.data.code === 1 && response.data.data) {
        return response.data.data;
      } else {
        throw new Error(response.data.msg || 'Failed to get cabinet details');
      }
    } catch (error) {
      logger.error('Failed to get cabinet details', { error, data });
      throw error;
    }
  }

  // ==================== SCREEN MANAGEMENT - AD MATERIALS ====================

  /**
   * Add AD Material
   * Endpoint: POST /screenadv/addMaterial
   */
  async addMaterial(data: AddMaterialRequest): Promise<AddMaterialResponse> {
    await this.ensureAuthenticated();

    try {
      logger.info('Adding AD material', { name: data.name, type: data.type });

      const response = await this.client.post<ApiResponse<AddMaterialResponse>>(
        '/screenadv/addMaterial',
        this.toFormData(data)
      );

      if (response.data.code === 1 && response.data.data) {
        logger.info('AD material added successfully', { id: response.data.data.id });
        return response.data.data;
      } else {
        throw new Error(response.data.msg || 'Failed to add material');
      }
    } catch (error) {
      logger.error('Failed to add material', { error, data });
      throw error;
    }
  }

  /**
   * Delete AD Material
   * Endpoint: POST /screenadv/deleteMaterial
   */
  async deleteMaterial(data: DeleteMaterialRequest): Promise<void> {
    await this.ensureAuthenticated();

    try {
      logger.info('Deleting AD material', { id: data.id });

      const response = await this.client.post<ApiResponse>('/screenadv/deleteMaterial', this.toFormData(data));

      if (response.data.code !== 1) {
        throw new Error(response.data.msg || 'Failed to delete material');
      }

      logger.info('AD material deleted successfully', { id: data.id });
    } catch (error) {
      logger.error('Failed to delete material', { error, data });
      throw error;
    }
  }

  /**
   * Get Material List
   * Endpoint: GET /screenadv/materialList
   */
  async getMaterialList(params?: MaterialListRequest): Promise<MaterialListResponse> {
    await this.ensureAuthenticated();

    try {
      logger.info('Getting material list', { params });

      const response = await this.client.get<ApiResponse<MaterialListResponse>>(
        '/screenadv/materialList',
        { params: { page: 1, ...params } }
      );

      if (response.data.code === 1 && response.data.data) {
        return response.data.data;
      } else {
        throw new Error(response.data.msg || 'Failed to get material list');
      }
    } catch (error) {
      logger.error('Failed to get material list', { error, params });
      throw error;
    }
  }

  // ==================== SCREEN MANAGEMENT - AD GROUPS ====================

  /**
   * Add AD Group
   * Endpoint: POST /screenadv/addGroup
   */
  async addGroup(data: AddGroupRequest): Promise<AddGroupResponse> {
    await this.ensureAuthenticated();

    try {
      logger.info('Adding AD group', { name: data.name });

      const response = await this.client.post<ApiResponse<AddGroupResponse>>(
        '/screenadv/addGroup',
        this.toFormData({
          name: data.name,
          details: JSON.stringify(data.details),
        })
      );

      if (response.data.code === 1 && response.data.data) {
        logger.info('AD group added successfully', { id: response.data.data.id });
        return response.data.data;
      } else {
        throw new Error(response.data.msg || 'Failed to add group');
      }
    } catch (error) {
      logger.error('Failed to add group', { error, data });
      throw error;
    }
  }

  /**
   * Edit AD Group
   * Endpoint: POST /screenadv/editGroup
   */
  async editGroup(data: EditGroupRequest): Promise<void> {
    await this.ensureAuthenticated();

    try {
      logger.info('Editing AD group', { id: data.id });

      const response = await this.client.post<ApiResponse>('/screenadv/editGroup',
        this.toFormData({
          id: data.id,
          name: data.name,
          details: JSON.stringify(data.details),
        })
      );

      if (response.data.code !== 1) {
        throw new Error(response.data.msg || 'Failed to edit group');
      }

      logger.info('AD group edited successfully', { id: data.id });
    } catch (error) {
      logger.error('Failed to edit group', { error, data });
      throw error;
    }
  }

  /**
   * Delete AD Group
   * Endpoint: POST /screenadv/deleteGroup
   */
  async deleteGroup(data: DeleteGroupRequest): Promise<void> {
    await this.ensureAuthenticated();

    try {
      logger.info('Deleting AD group', { id: data.id });

      const response = await this.client.post<ApiResponse>('/screenadv/deleteGroup', this.toFormData(data));

      if (response.data.code !== 1) {
        throw new Error(response.data.msg || 'Failed to delete group');
      }

      logger.info('AD group deleted successfully', { id: data.id });
    } catch (error) {
      logger.error('Failed to delete group', { error, data });
      throw error;
    }
  }

  /**
   * Get Group Detail
   * Endpoint: POST /screenadv/groupDetail
   */
  async getGroupDetail(data: GroupDetailRequest): Promise<GroupDetail> {
    await this.ensureAuthenticated();

    try {
      logger.info('Getting group detail', { id: data.id });

      const response = await this.client.post<ApiResponse<GroupDetail>>(
        '/screenadv/groupDetail',
        this.toFormData(data)
      );

      if (response.data.code === 1 && response.data.data) {
        return response.data.data;
      } else {
        throw new Error(response.data.msg || 'Failed to get group detail');
      }
    } catch (error) {
      logger.error('Failed to get group detail', { error, data });
      throw error;
    }
  }

  /**
   * Get Group List
   * Endpoint: GET /screenadv/groupList
   */
  async getGroupList(params?: GroupListRequest): Promise<GroupListResponse> {
    await this.ensureAuthenticated();

    try {
      logger.info('Getting group list', { params });

      const response = await this.client.get<ApiResponse<GroupListResponse>>(
        '/screenadv/groupList',
        { params: { page: 1, ...params } }
      );

      if (response.data.code === 1 && response.data.data) {
        return response.data.data;
      } else {
        throw new Error(response.data.msg || 'Failed to get group list');
      }
    } catch (error) {
      logger.error('Failed to get group list', { error, params });
      throw error;
    }
  }

  // ==================== SCREEN MANAGEMENT - AD PLANS ====================

  /**
   * Add AD Plan
   * Endpoint: POST /screenadv/addPlan
   */
  async addPlan(data: AddPlanRequest): Promise<AddPlanResponse> {
    await this.ensureAuthenticated();

    try {
      logger.info('Adding AD plan', { plan_name: data.plan_name });

      const response = await this.client.post<ApiResponse<AddPlanResponse>>('/screenadv/addPlan',
        this.toFormData({
          plan_name: data.plan_name,
          start_date: data.start_date,
          end_date: data.end_date,
          details: JSON.stringify(data.details),
          equipment_group: data.equipment_group,
        })
      );

      if (response.data.code === 1 && response.data.data) {
        logger.info('AD plan added successfully', { id: response.data.data.id });
        return response.data.data;
      } else {
        throw new Error(response.data.msg || 'Failed to add plan');
      }
    } catch (error) {
      logger.error('Failed to add plan', { error, data });
      throw error;
    }
  }

  /**
   * Edit AD Plan
   * Endpoint: POST /screenadv/editPlan
   */
  async editPlan(data: EditPlanRequest): Promise<void> {
    await this.ensureAuthenticated();

    try {
      logger.info('Editing AD plan', { id: data.id });

      const response = await this.client.post<ApiResponse>('/screenadv/editPlan',
        this.toFormData({
          id: data.id,
          plan_name: data.plan_name,
          start_date: data.start_date,
          end_date: data.end_date,
          details: JSON.stringify(data.details),
          equipment_group: data.equipment_group,
        })
      );

      if (response.data.code !== 1) {
        throw new Error(response.data.msg || 'Failed to edit plan');
      }

      logger.info('AD plan edited successfully', { id: data.id });
    } catch (error) {
      logger.error('Failed to edit plan', { error, data });
      throw error;
    }
  }

  /**
   * Delete AD Plan
   * Endpoint: POST /screenadv/deletePlan
   */
  async deletePlan(data: DeletePlanRequest): Promise<void> {
    await this.ensureAuthenticated();

    try {
      logger.info('Deleting AD plan', { id: data.id });

      const response = await this.client.post<ApiResponse>('/screenadv/deletePlan', this.toFormData(data));

      if (response.data.code !== 1) {
        throw new Error(response.data.msg || 'Failed to delete plan');
      }

      logger.info('AD plan deleted successfully', { id: data.id });
    } catch (error) {
      logger.error('Failed to delete plan', { error, data });
      throw error;
    }
  }

  /**
   * Get Plan Detail
   * Endpoint: POST /screenadv/plandetail
   */
  async getPlanDetail(data: PlanDetailRequest): Promise<PlanInfo> {
    await this.ensureAuthenticated();

    try {
      logger.info('Getting plan detail', { id: data.id });

      const response = await this.client.post<ApiResponse<PlanInfo>>(
        '/screenadv/plandetail',
        this.toFormData(data)
      );

      if (response.data.code === 1 && response.data.data) {
        return response.data.data;
      } else {
        throw new Error(response.data.msg || 'Failed to get plan detail');
      }
    } catch (error) {
      logger.error('Failed to get plan detail', { error, data });
      throw error;
    }
  }

  /**
   * Get Plan List
   * Endpoint: GET /screenadv/planList
   */
  async getPlanList(params?: PlanListRequest): Promise<PlanListResponse> {
    try {
      await this.ensureAuthenticated();

      logger.info('Getting plan list', { params, authenticated: this.isAuthenticated(), hasToken: !!this.token });

      const response = await this.client.get<ApiResponse<PlanListResponse>>(
        '/screenadv/planList',
        { params: { page: 1, ...params } }
      );

      if (response.data.code === 1 && response.data.data) {
        logger.info('Plan list retrieved successfully', { count: response.data.data.list?.length });
        return response.data.data;
      } else {
        const errorMsg = response.data.msg || 'Failed to get plan list';
        logger.error('Plan list API returned error', { code: response.data.code, msg: errorMsg });
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      logger.error('Failed to get plan list', {
        error: error.message || error,
        params,
        authenticated: this.isAuthenticated(),
        hasToken: !!this.token,
        stack: error.stack
      });
      throw error;
    }
  }

  // ==================== SYSTEM SETTINGS ====================

  /**
   * Get System Configuration
   * Endpoint: POST /set/info
   */
  async getSystemConfig(data: GetSystemConfigRequest): Promise<SystemConfig> {
    await this.ensureAuthenticated();

    try {
      logger.info('Getting system config', { type: data.type });

      const response = await this.client.post<ApiResponse<SystemConfig>>('/set/info', this.toFormData(data));

      if (response.data.code === 1 && response.data.data) {
        return response.data.data;
      } else {
        throw new Error(response.data.msg || 'Failed to get system config');
      }
    } catch (error) {
      logger.error('Failed to get system config', { error, data });
      throw error;
    }
  }

  /**
   * Set System Configuration
   * Endpoint: POST /set/save
   */
  async setSystemConfig(data: SetSystemConfigRequest): Promise<void> {
    await this.ensureAuthenticated();

    try {
      logger.info('Setting system config', { type: data.type });

      // Prepare payload based on type
      let payload: any = { type: data.type };

      switch (data.type) {
        case 'battery_power':
          payload.battery_power = data.battery_power;
          break;
        case 'webhook':
          payload.webhook = data.webhook;
          break;
        case 'qrcode_color':
          payload.qrcodeColor = data.qrcodeColor;
          break;
        case 'screen_default':
          payload = {
            ...payload,
            default_vertical: data.default_vertical,
            default_bottom: data.default_bottom,
            rent_success_vertical: data.rent_success_vertical,
            rent_fail_vertical: data.rent_fail_vertical,
            back_success_vertical: data.back_success_vertical,
            back_fail_vertical: data.back_fail_vertical,
            default_cross: data.default_cross,
            default_left_cross: data.default_left_cross,
          };
          break;
      }

      const response = await this.client.post<ApiResponse>('/set/save', this.toFormData(payload));

      if (response.data.code !== 1) {
        throw new Error(response.data.msg || 'Failed to set system config');
      }

      logger.info('System config updated successfully', { type: data.type });
    } catch (error) {
      logger.error('Failed to set system config', { error, data });
      throw error;
    }
  }
}

// Create and initialize singleton instance
const wsChargeApiService = new WsChargeApiService();

// Auto-initialize on startup (non-blocking)
wsChargeApiService.initialize().catch((error) => {
  logger.error('Failed to initialize WsCharge API service on startup', { error });
});

export { wsChargeApiService };
