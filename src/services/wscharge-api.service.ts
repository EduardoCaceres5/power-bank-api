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
        logger.error('Error en interceptor de request', { error });
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
            logger.warn('Token expirado, se requiere volver a iniciar sesión');
            this.clearAuth();
            // Optionally trigger auto re-login here
          }

          logger.error('Respuesta de error de API', {
            code,
            msg,
            url: error.config?.url,
            method: error.config?.method,
          });
        } else if (error.request) {
          logger.error('Sin respuesta de API', {
            url: error.config?.url,
            method: error.config?.method,
          });
        } else {
          logger.error('Error al configurar request de API', { message: error.message });
        }

        return Promise.reject(error);
      }
    );

    logger.info('Servicio de API WsCharge inicializado', { baseURL });
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
      logger.info('Intentando iniciar sesión en API WsCharge', { name: credentials.name });

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

        logger.info('Inicio de sesión exitoso en API WsCharge', {
          ocode: this.ocode,
          tokenExpiresAt: this.tokenExpiresAt,
        });

        return response.data.data;
      } else {
        throw new Error(response.data.msg || 'Error al iniciar sesión');
      }
    } catch (error) {
      logger.error('Error al iniciar sesión', { error });
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
    // Only clear ocode if it wasn't set from environment
    if (!process.env.WSCHARGE_OCODE) {
      this.ocode = null;
    }
    this.tokenExpiresAt = null;
    logger.info('Autenticación limpiada', { preservedOcode: !!this.ocode });
  }

  /**
   * Ensure authenticated before making API calls
   * Auto-login using credentials from environment variables
   * @returns true if authenticated successfully, false otherwise
   */
  private async ensureAuthenticated(): Promise<boolean> {
    const isAuth = this.isAuthenticated();
    logger.debug('Verificando estado de autenticación', {
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
        const error = 'Sin autenticación y credenciales de WsCharge no encontradas. Por favor configure las variables de entorno WSCHARGE_USERNAME y WSCHARGE_PASSWORD';
        logger.error(error);
        return false;
      }

      try {
        logger.info('Token expirado o ausente, intentando inicio de sesión automático', { username });
        await this.login({ name: username, password });
        logger.info('Inicio de sesión automático exitoso', {
          hasToken: !!this.token,
          tokenExpiresAt: this.tokenExpiresAt
        });
        return true;
      } catch (error: any) {
        logger.error('Error en inicio de sesión automático', {
          error: error.message || error,
          username,
          stack: error.stack
        });
        return false;
      }
    } else {
      logger.debug('Ya autenticado, omitiendo inicio de sesión');
      return true;
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
        logger.info('Inicializando servicio de API WsCharge con inicio de sesión automático');
        await this.login({ name: username, password });
      } catch (error) {
        logger.error('Error al iniciar sesión automáticamente en la inicialización', { error });
        // Don't throw - allow service to start, will retry on first API call
      }
    } else {
      logger.warn('Credenciales de WsCharge no encontradas en el entorno. Se requiere inicio de sesión manual o se iniciará sesión automáticamente en la primera llamada a la API.');
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
      logger.info('Agregando gabinete', { cabinet_id: data.cabinet_id });

      const response = await this.client.post<ApiResponse<AddCabinetResponse>>(
        '/equipment/add',
        this.toFormData(data)
      );

      if (response.data.code === 1 && response.data.data) {
        logger.info('Gabinete agregado exitosamente', { cabinet_id: data.cabinet_id });
        return response.data.data;
      } else {
        throw new Error(response.data.msg || 'Failed to add cabinet');
      }
    } catch (error) {
      logger.error('Error al agregar gabinete', { error, data });
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
      logger.info('Editando gabinete', { cabinet_id: data.cabinet_id });

      const response = await this.client.post<ApiResponse>('/equipment/edit', this.toFormData(data));

      if (response.data.code !== 1) {
        throw new Error(response.data.msg || 'Failed to edit cabinet');
      }

      logger.info('Gabinete editado exitosamente', { cabinet_id: data.cabinet_id });
    } catch (error) {
      logger.error('Error al editar gabinete', { error, data });
      throw error;
    }
  }

  /**
   * Get Cabinet Information
   * Endpoint: POST /equipment/info
   */
  async getCabinetInfo(data: CabinetInfoRequest): Promise<CabinetInfo> {
    try {
      await this.ensureAuthenticated();

      logger.info('Obteniendo información del gabinete', { cabinet_id: data.cabinet_id, authenticated: this.isAuthenticated(), hasToken: !!this.token });

      const response = await this.client.post<ApiResponse<CabinetInfo>>('/equipment/info', this.toFormData(data));

      // Handle 401 in response body (token expired)
      if (response.data.code === 401) {
        logger.warn('Token expirado durante getCabinetInfo, limpiando autenticación y reintentando');
        this.clearAuth();

        // Retry once after re-authentication
        await this.ensureAuthenticated();
        const retryResponse = await this.client.post<ApiResponse<CabinetInfo>>('/equipment/info', this.toFormData(data));

        if (retryResponse.data.code === 1 && retryResponse.data.data) {
          logger.info('Información del gabinete obtenida exitosamente después del reintento');
          return retryResponse.data.data;
        } else {
          const errorMsg = retryResponse.data.msg || 'Failed to get cabinet info after retry';
          logger.error('API de información del gabinete retornó error después del reintento', { code: retryResponse.data.code, msg: errorMsg });
          throw new Error(errorMsg);
        }
      }

      if (response.data.code === 1 && response.data.data) {
        logger.info('Información del gabinete obtenida exitosamente');
        return response.data.data;
      } else {
        const errorMsg = response.data.msg || 'Failed to get cabinet info';
        logger.error('API de información del gabinete retornó error', { code: response.data.code, msg: errorMsg });
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      logger.error('Error al obtener información del gabinete', {
        error: error.message || error,
        data,
        authenticated: this.isAuthenticated(),
        hasToken: !!this.token,
        stack: error.stack
      });
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
      logger.info('Eliminando gabinete', { cabinet_id: data.cabinet_id });

      const response = await this.client.post<ApiResponse>('/equipment/delete', this.toFormData(data));

      if (response.data.code !== 1) {
        throw new Error(response.data.msg || 'Failed to delete cabinet');
      }

      logger.info('Gabinete eliminado exitosamente', { cabinet_id: data.cabinet_id });
    } catch (error) {
      logger.error('Error al eliminar gabinete', { error, data });
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

      logger.info('Obteniendo lista de gabinetes', { params, authenticated: this.isAuthenticated(), hasToken: !!this.token });

      const response = await this.client.get<ApiResponse<CabinetListResponse>>(
        '/equipment/index',
        { params: { page: 1, ...params } }
      );

      // Handle 401 in response body (token expired)
      if (response.data.code === 401) {
        logger.warn('Token expirado durante getCabinetList, limpiando autenticación y reintentando');
        this.clearAuth();

        // Retry once after re-authentication
        await this.ensureAuthenticated();
        const retryResponse = await this.client.get<ApiResponse<CabinetListResponse>>(
          '/equipment/index',
          { params: { page: 1, ...params } }
        );

        if (retryResponse.data.code === 1 && retryResponse.data.data) {
          logger.info('Lista de gabinetes obtenida exitosamente después del reintento', { count: retryResponse.data.data.list?.length });
          return retryResponse.data.data;
        } else {
          const errorMsg = retryResponse.data.msg || 'Failed to get cabinet list after retry';
          logger.error('API de lista de gabinetes retornó error después del reintento', { code: retryResponse.data.code, msg: errorMsg });
          throw new Error(errorMsg);
        }
      }

      if (response.data.code === 1 && response.data.data) {
        logger.info('Lista de gabinetes obtenida exitosamente', { count: response.data.data.list?.length });
        return response.data.data;
      } else {
        const errorMsg = response.data.msg || 'Failed to get cabinet list';
        logger.error('API de lista de gabinetes retornó error', { code: response.data.code, msg: errorMsg });
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      logger.error('Error al obtener lista de gabinetes', {
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

      logger.info('Obteniendo lista de baterías', { params, authenticated: this.isAuthenticated(), hasToken: !!this.token });

      const response = await this.client.get<ApiResponse<BatteryListResponse>>(
        '/equipment/batteryList',
        { params: { page: 1, ...params } }
      );

      // Handle 401 in response body (token expired)
      if (response.data.code === 401) {
        logger.warn('Token expirado durante getBatteryList, limpiando autenticación y reintentando');
        this.clearAuth();

        // Retry once after re-authentication
        await this.ensureAuthenticated();
        const retryResponse = await this.client.get<ApiResponse<BatteryListResponse>>(
          '/equipment/batteryList',
          { params: { page: 1, ...params } }
        );

        if (retryResponse.data.code === 1 && retryResponse.data.data) {
          logger.info('Lista de baterías obtenida exitosamente después del reintento', { count: retryResponse.data.data.list?.length });
          return retryResponse.data.data;
        } else {
          const errorMsg = retryResponse.data.msg || 'Failed to get battery list after retry';
          logger.error('API de lista de baterías retornó error después del reintento', { code: retryResponse.data.code, msg: errorMsg });
          throw new Error(errorMsg);
        }
      }

      if (response.data.code === 1 && response.data.data) {
        logger.info('Lista de baterías obtenida exitosamente', { count: response.data.data.list?.length });
        return response.data.data;
      } else {
        const errorMsg = response.data.msg || 'Failed to get battery list';
        logger.error('API de lista de baterías retornó error', { code: response.data.code, msg: errorMsg });
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      logger.error('Error al obtener lista de baterías', {
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
    try {
      await this.ensureAuthenticated();

      logger.info('Enviando comando al gabinete', { cabinet_id: data.cabinet_id, type: data.type, authenticated: this.isAuthenticated(), hasToken: !!this.token });

      const response = await this.client.post<ApiResponse<RentCommandResponse>>(
        '/equipment/operate',
        this.toFormData(data)
      );

      // Handle 401 in response body (token expired)
      if (response.data.code === 401) {
        logger.warn('Token expirado durante issueCommand, limpiando autenticación y reintentando');
        this.clearAuth();

        // Retry once after re-authentication
        await this.ensureAuthenticated();
        const retryResponse = await this.client.post<ApiResponse<RentCommandResponse>>(
          '/equipment/operate',
          this.toFormData(data)
        );

        if (retryResponse.data.code === 1) {
          logger.info('Comando enviado exitosamente después del reintento', { cabinet_id: data.cabinet_id, type: data.type });

          // Return data if it's a borrow command
          if (data.type === 'borrow' && retryResponse.data.data) {
            return retryResponse.data.data;
          }
          return;
        } else {
          const errorMsg = retryResponse.data.msg || 'Failed to issue command after retry';
          logger.error('API de comando retornó error después del reintento', { code: retryResponse.data.code, msg: errorMsg });
          throw new Error(errorMsg);
        }
      }

      if (response.data.code === 1) {
        logger.info('Comando enviado exitosamente', { cabinet_id: data.cabinet_id, type: data.type });

        // Return data if it's a borrow command
        if (data.type === 'borrow' && response.data.data) {
          return response.data.data;
        }
      } else {
        const errorMsg = response.data.msg || 'Failed to issue command';
        logger.error('API de comando retornó error', { code: response.data.code, msg: errorMsg });
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      logger.error('Error al enviar comando', {
        error: error.message || error,
        data,
        authenticated: this.isAuthenticated(),
        hasToken: !!this.token,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get Cabinet Details (current power bank information)
   * Endpoint: POST /equipment/detail
   */
  async getCabinetDetails(data: CabinetDetailsRequest): Promise<CabinetDetails> {
    try {
      await this.ensureAuthenticated();

      logger.info('Obteniendo detalles del gabinete', { cabinet_id: data.cabinet_id, authenticated: this.isAuthenticated(), hasToken: !!this.token });

      const response = await this.client.post<ApiResponse<CabinetDetails>>(
        '/equipment/detail',
        this.toFormData(data)
      );

      // Handle 401 in response body (token expired)
      if (response.data.code === 401) {
        logger.warn('Token expirado durante getCabinetDetails, limpiando autenticación y reintentando');
        this.clearAuth();

        // Retry once after re-authentication
        await this.ensureAuthenticated();
        const retryResponse = await this.client.post<ApiResponse<CabinetDetails>>(
          '/equipment/detail',
          this.toFormData(data)
        );

        if (retryResponse.data.code === 1 && retryResponse.data.data) {
          logger.info('Detalles del gabinete obtenidos exitosamente después del reintento');
          return retryResponse.data.data;
        } else {
          const errorMsg = retryResponse.data.msg || 'Failed to get cabinet details after retry';
          logger.error('API de detalles del gabinete retornó error después del reintento', { code: retryResponse.data.code, msg: errorMsg });
          throw new Error(errorMsg);
        }
      }

      if (response.data.code === 1 && response.data.data) {
        logger.info('Detalles del gabinete obtenidos exitosamente');
        return response.data.data;
      } else {
        const errorMsg = response.data.msg || 'Failed to get cabinet details';
        logger.error('API de detalles del gabinete retornó error', { code: response.data.code, msg: errorMsg });
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      logger.error('Error al obtener detalles del gabinete', {
        error: error.message || error,
        data,
        authenticated: this.isAuthenticated(),
        hasToken: !!this.token,
        stack: error.stack
      });
      throw error;
    }
  }

  // ==================== SCREEN MANAGEMENT - AD MATERIALS ====================

  /**
   * Add AD Material
   * Endpoint: POST /screenadv/addMaterial
   */
  async addMaterial(data: AddMaterialRequest): Promise<AddMaterialResponse> {
    try {
      await this.ensureAuthenticated();

      logger.info('Agregando material publicitario', { name: data.name, type: data.type, authenticated: this.isAuthenticated(), hasToken: !!this.token });

      const response = await this.client.post<ApiResponse<AddMaterialResponse>>(
        '/screenadv/addMaterial',
        this.toFormData(data)
      );

      // Handle 401 in response body (token expired)
      if (response.data.code === 401) {
        logger.warn('Token expirado durante addMaterial, limpiando autenticación y reintentando');
        this.clearAuth();

        // Retry once after re-authentication
        await this.ensureAuthenticated();
        const retryResponse = await this.client.post<ApiResponse<AddMaterialResponse>>(
          '/screenadv/addMaterial',
          this.toFormData(data)
        );

        if (retryResponse.data.code === 1 && retryResponse.data.data) {
          logger.info('Material publicitario agregado exitosamente después del reintento', { id: retryResponse.data.data.id });
          return retryResponse.data.data;
        } else {
          const errorMsg = retryResponse.data.msg || 'Failed to add material after retry';
          logger.error('API de agregar material retornó error después del reintento', { code: retryResponse.data.code, msg: errorMsg });
          throw new Error(errorMsg);
        }
      }

      if (response.data.code === 1 && response.data.data) {
        logger.info('Material publicitario agregado exitosamente', { id: response.data.data.id });
        return response.data.data;
      } else {
        const errorMsg = response.data.msg || 'Failed to add material';
        logger.error('API de agregar material retornó error', { code: response.data.code, msg: errorMsg });
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      logger.error('Error al agregar material', {
        error: error.message || error,
        data,
        authenticated: this.isAuthenticated(),
        hasToken: !!this.token,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Delete AD Material
   * Endpoint: POST /screenadv/deleteMaterial
   * Also deletes the file from Cloudinary if it's a Cloudinary URL
   */
  async deleteMaterial(data: DeleteMaterialRequest): Promise<void> {
    try {
      await this.ensureAuthenticated();

      logger.info('Eliminando material publicitario', { id: data.id, authenticated: this.isAuthenticated(), hasToken: !!this.token });

      // First, get material info to retrieve the file URL for Cloudinary deletion
      let materialUrl: string | null = null;
      let materialType: 'image' | 'video' = 'image';

      try {
        const materialList = await this.getMaterialList({ page: 1, page_size: 1000 });
        const material = materialList.list.find(m => m.id === data.id);

        if (material) {
          materialUrl = material.file;
          materialType = material.type;
          logger.info('Material encontrado para eliminación de Cloudinary', {
            id: data.id,
            url: materialUrl,
            type: materialType
          });
        }
      } catch (error: any) {
        logger.warn('No se pudo obtener información del material antes de eliminarlo', {
          id: data.id,
          error: error.message
        });
      }

      const response = await this.client.post<ApiResponse>('/screenadv/deleteMaterial', this.toFormData(data));

      // Handle 401 in response body (token expired)
      if (response.data.code === 401) {
        logger.warn('Token expirado durante deleteMaterial, limpiando autenticación y reintentando');
        this.clearAuth();

        // Retry once after re-authentication
        await this.ensureAuthenticated();
        const retryResponse = await this.client.post<ApiResponse>('/screenadv/deleteMaterial', this.toFormData(data));

        if (retryResponse.data.code === 1) {
          logger.info('Material publicitario eliminado exitosamente después del reintento', { id: data.id });

          // Delete from Cloudinary if URL is available
          await this.deleteFromCloudinaryIfApplicable(materialUrl, materialType);

          return;
        } else {
          const errorMsg = retryResponse.data.msg || 'Failed to delete material after retry';
          logger.error('API de eliminar material retornó error después del reintento', { code: retryResponse.data.code, msg: errorMsg });
          throw new Error(errorMsg);
        }
      }

      if (response.data.code === 1) {
        logger.info('Material publicitario eliminado exitosamente', { id: data.id });

        // Delete from Cloudinary if URL is available
        await this.deleteFromCloudinaryIfApplicable(materialUrl, materialType);
      } else {
        const errorMsg = response.data.msg || 'Failed to delete material';
        logger.error('API de eliminar material retornó error', { code: response.data.code, msg: errorMsg });
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      logger.error('Error al eliminar material', {
        error: error.message || error,
        data,
        authenticated: this.isAuthenticated(),
        hasToken: !!this.token,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Helper method to delete file from Cloudinary if it's a Cloudinary URL
   */
  private async deleteFromCloudinaryIfApplicable(
    url: string | null,
    resourceType: 'image' | 'video'
  ): Promise<void> {
    if (!url) {
      return;
    }

    // Check if it's a Cloudinary URL
    if (!url.includes('cloudinary.com')) {
      logger.info('URL no es de Cloudinary, omitiendo eliminación', { url });
      return;
    }

    try {
      // Extract publicId from Cloudinary URL
      // Example URL: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/file.jpg
      // publicId would be: folder/file
      const publicId = this.extractPublicIdFromCloudinaryUrl(url);

      if (!publicId) {
        logger.warn('No se pudo extraer publicId de la URL de Cloudinary', { url });
        return;
      }

      // Import cloudinaryService dynamically to avoid circular dependencies
      const { cloudinaryService } = await import('./cloudinary.service');

      if (!cloudinaryService.isConfigured()) {
        logger.warn('Cloudinary no está configurado, omitiendo eliminación', { publicId });
        return;
      }

      await cloudinaryService.deleteFile(publicId, resourceType);
      logger.info('Archivo eliminado exitosamente de Cloudinary', { publicId, resourceType });
    } catch (error: any) {
      // Don't throw error, just log it - we don't want to fail the whole operation
      // if Cloudinary deletion fails
      logger.error('Error al eliminar archivo de Cloudinary (no crítico)', {
        error: error.message || error,
        url,
        resourceType
      });
    }
  }

  /**
   * Extract public ID from Cloudinary URL
   */
  private extractPublicIdFromCloudinaryUrl(url: string): string | null {
    try {
      // Cloudinary URL format:
      // https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/{transformations}/{version}/{public_id}.{format}
      // or: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/{public_id}.{format}

      const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);

      if (match && match[1]) {
        // Remove any transformation parameters
        const publicId = match[1].split('/').filter(part => !part.startsWith('v') || part.length > 10).join('/');
        return publicId;
      }

      return null;
    } catch (error) {
      logger.error('Error al extraer publicId de URL de Cloudinary', { url, error });
      return null;
    }
  }

  /**
   * Get Material List
   * Endpoint: GET /screenadv/materialList
   */
  async getMaterialList(params?: MaterialListRequest): Promise<MaterialListResponse> {
    try {
      await this.ensureAuthenticated();

      logger.info('Obteniendo lista de materiales', { params, authenticated: this.isAuthenticated(), hasToken: !!this.token });

      const response = await this.client.get<ApiResponse<MaterialListResponse>>(
        '/screenadv/materialList',
        { params: { page: 1, ...params } }
      );

      // Handle 401 in response body (token expired)
      if (response.data.code === 401) {
        logger.warn('Token expirado durante getMaterialList, limpiando autenticación y reintentando');
        this.clearAuth();

        // Retry once after re-authentication
        await this.ensureAuthenticated();
        const retryResponse = await this.client.get<ApiResponse<MaterialListResponse>>(
          '/screenadv/materialList',
          { params: { page: 1, ...params } }
        );

        if (retryResponse.data.code === 1 && retryResponse.data.data) {
          logger.info('Lista de materiales obtenida exitosamente después del reintento', { count: retryResponse.data.data.list?.length });
          return retryResponse.data.data;
        } else {
          const errorMsg = retryResponse.data.msg || 'Failed to get material list after retry';
          logger.error('API de lista de materiales retornó error después del reintento', { code: retryResponse.data.code, msg: errorMsg });
          throw new Error(errorMsg);
        }
      }

      if (response.data.code === 1 && response.data.data) {
        logger.info('Lista de materiales obtenida exitosamente', { count: response.data.data.list?.length });
        return response.data.data;
      } else {
        const errorMsg = response.data.msg || 'Failed to get material list';
        logger.error('API de lista de materiales retornó error', { code: response.data.code, msg: errorMsg });
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      logger.error('Error al obtener lista de materiales', {
        error: error.message || error,
        params,
        authenticated: this.isAuthenticated(),
        hasToken: !!this.token,
        stack: error.stack
      });
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
      logger.info('Agregando grupo publicitario', { name: data.name });

      const response = await this.client.post<ApiResponse<AddGroupResponse>>(
        '/screenadv/addGroup',
        this.toFormData({
          name: data.name,
          details: JSON.stringify(data.details),
        })
      );

      if (response.data.code === 1 && response.data.data) {
        logger.info('Grupo publicitario agregado exitosamente', { id: response.data.data.id });
        return response.data.data;
      } else {
        throw new Error(response.data.msg || 'Failed to add group');
      }
    } catch (error) {
      logger.error('Error al agregar grupo', { error, data });
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
      logger.info('Editando grupo publicitario', { id: data.id });

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

      logger.info('Grupo publicitario editado exitosamente', { id: data.id });
    } catch (error) {
      logger.error('Error al editar grupo', { error, data });
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
      logger.info('Eliminando grupo publicitario', { id: data.id });

      const response = await this.client.post<ApiResponse>('/screenadv/deleteGroup', this.toFormData(data));

      if (response.data.code !== 1) {
        throw new Error(response.data.msg || 'Failed to delete group');
      }

      logger.info('Grupo publicitario eliminado exitosamente', { id: data.id });
    } catch (error) {
      logger.error('Error al eliminar grupo', { error, data });
      throw error;
    }
  }

  /**
   * Get Group Detail
   * Endpoint: POST /screenadv/groupDetail
   */
  async getGroupDetail(data: GroupDetailRequest): Promise<GroupDetail> {
    try {
      await this.ensureAuthenticated();

      logger.info('Obteniendo detalle del grupo', { id: data.id, authenticated: this.isAuthenticated(), hasToken: !!this.token });

      const response = await this.client.post<ApiResponse<GroupDetail>>(
        '/screenadv/groupDetail',
        this.toFormData(data)
      );

      // Handle 401 in response body (token expired)
      if (response.data.code === 401) {
        logger.warn('Token expirado durante getGroupDetail, limpiando autenticación y reintentando');
        this.clearAuth();

        // Retry once after re-authentication
        await this.ensureAuthenticated();
        const retryResponse = await this.client.post<ApiResponse<GroupDetail>>(
          '/screenadv/groupDetail',
          this.toFormData(data)
        );

        if (retryResponse.data.code === 1 && retryResponse.data.data) {
          logger.info('Detalle del grupo obtenido exitosamente después del reintento');
          return retryResponse.data.data;
        } else {
          const errorMsg = retryResponse.data.msg || 'Failed to get group detail after retry';
          logger.error('API de detalle del grupo retornó error después del reintento', { code: retryResponse.data.code, msg: errorMsg });
          throw new Error(errorMsg);
        }
      }

      if (response.data.code === 1 && response.data.data) {
        logger.info('Detalle del grupo obtenido exitosamente');
        return response.data.data;
      } else {
        const errorMsg = response.data.msg || 'Failed to get group detail';
        logger.error('API de detalle del grupo retornó error', { code: response.data.code, msg: errorMsg });
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      logger.error('Error al obtener detalle del grupo', {
        error: error.message || error,
        data,
        authenticated: this.isAuthenticated(),
        hasToken: !!this.token,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get Group List
   * Endpoint: GET /screenadv/groupList
   */
  async getGroupList(params?: GroupListRequest): Promise<GroupListResponse> {
    try {
      await this.ensureAuthenticated();

      logger.info('Obteniendo lista de grupos', { params, authenticated: this.isAuthenticated(), hasToken: !!this.token });

      const response = await this.client.get<ApiResponse<GroupListResponse>>(
        '/screenadv/groupList',
        { params: { page: 1, ...params } }
      );

      // Handle 401 in response body (token expired)
      if (response.data.code === 401) {
        logger.warn('Token expirado durante getGroupList, limpiando autenticación y reintentando');
        this.clearAuth();

        // Retry once after re-authentication
        await this.ensureAuthenticated();
        const retryResponse = await this.client.get<ApiResponse<GroupListResponse>>(
          '/screenadv/groupList',
          { params: { page: 1, ...params } }
        );

        if (retryResponse.data.code === 1 && retryResponse.data.data) {
          logger.info('Lista de grupos obtenida exitosamente después del reintento', { count: retryResponse.data.data.list?.length });
          return retryResponse.data.data;
        } else {
          const errorMsg = retryResponse.data.msg || 'Failed to get group list after retry';
          logger.error('API de lista de grupos retornó error después del reintento', { code: retryResponse.data.code, msg: errorMsg });
          throw new Error(errorMsg);
        }
      }

      if (response.data.code === 1 && response.data.data) {
        logger.info('Lista de grupos obtenida exitosamente', { count: response.data.data.list?.length });
        return response.data.data;
      } else {
        const errorMsg = response.data.msg || 'Failed to get group list';
        logger.error('API de lista de grupos retornó error', { code: response.data.code, msg: errorMsg });
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      logger.error('Error al obtener lista de grupos', {
        error: error.message || error,
        params,
        authenticated: this.isAuthenticated(),
        hasToken: !!this.token,
        stack: error.stack
      });
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
      logger.info('Agregando plan publicitario', { plan_name: data.plan_name });

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
        logger.info('Plan publicitario agregado exitosamente', { id: response.data.data.id });
        return response.data.data;
      } else {
        throw new Error(response.data.msg || 'Failed to add plan');
      }
    } catch (error) {
      logger.error('Error al agregar plan', { error, data });
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
      logger.info('Editando plan publicitario', { id: data.id });

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

      logger.info('Plan publicitario editado exitosamente', { id: data.id });
    } catch (error) {
      logger.error('Error al editar plan', { error, data });
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
      logger.info('Eliminando plan publicitario', { id: data.id });

      const response = await this.client.post<ApiResponse>('/screenadv/deletePlan', this.toFormData(data));

      if (response.data.code !== 1) {
        throw new Error(response.data.msg || 'Failed to delete plan');
      }

      logger.info('Plan publicitario eliminado exitosamente', { id: data.id });
    } catch (error) {
      logger.error('Error al eliminar plan', { error, data });
      throw error;
    }
  }

  /**
   * Get Plan Detail
   * Endpoint: POST /screenadv/plandetail
   */
  async getPlanDetail(data: PlanDetailRequest): Promise<PlanInfo> {
    try {
      await this.ensureAuthenticated();

      logger.info('Obteniendo detalle del plan', { id: data.id, authenticated: this.isAuthenticated(), hasToken: !!this.token });

      const response = await this.client.post<ApiResponse<PlanInfo>>(
        '/screenadv/plandetail',
        this.toFormData(data)
      );

      // Handle 401 in response body (token expired)
      if (response.data.code === 401) {
        logger.warn('Token expirado durante getPlanDetail, limpiando autenticación y reintentando');
        this.clearAuth();

        // Retry once after re-authentication
        await this.ensureAuthenticated();
        const retryResponse = await this.client.post<ApiResponse<PlanInfo>>(
          '/screenadv/plandetail',
          this.toFormData(data)
        );

        if (retryResponse.data.code === 1 && retryResponse.data.data) {
          logger.info('Detalle del plan obtenido exitosamente después del reintento');
          return retryResponse.data.data;
        } else {
          const errorMsg = retryResponse.data.msg || 'Failed to get plan detail after retry';
          logger.error('API de detalle del plan retornó error después del reintento', { code: retryResponse.data.code, msg: errorMsg });
          throw new Error(errorMsg);
        }
      }

      if (response.data.code === 1 && response.data.data) {
        logger.info('Detalle del plan obtenido exitosamente');
        return response.data.data;
      } else {
        const errorMsg = response.data.msg || 'Failed to get plan detail';
        logger.error('API de detalle del plan retornó error', { code: response.data.code, msg: errorMsg });
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      logger.error('Error al obtener detalle del plan', {
        error: error.message || error,
        data,
        authenticated: this.isAuthenticated(),
        hasToken: !!this.token,
        stack: error.stack
      });
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

      // Handle 401 in response body (token expired)
      if (response.data.code === 401) {
        logger.warn('Token expirado durante getPlanList, limpiando autenticación y reintentando');
        this.clearAuth();

        // Retry once after re-authentication
        await this.ensureAuthenticated();
        const retryResponse = await this.client.get<ApiResponse<PlanListResponse>>(
          '/screenadv/planList',
          { params: { page: 1, ...params } }
        );

        if (retryResponse.data.code === 1 && retryResponse.data.data) {
          logger.info('Lista de planes obtenida exitosamente después del reintento', { count: retryResponse.data.data.list?.length });
          return retryResponse.data.data;
        } else {
          const errorMsg = retryResponse.data.msg || 'Failed to get plan list after retry';
          logger.error('API de lista de planes retornó error después del reintento', { code: retryResponse.data.code, msg: errorMsg });
          throw new Error(errorMsg);
        }
      }

      if (response.data.code === 1 && response.data.data) {
        logger.info('Lista de planes obtenida exitosamente', { count: response.data.data.list?.length });
        return response.data.data;
      } else {
        const errorMsg = response.data.msg || 'Failed to get plan list';
        logger.error('API de lista de planes retornó error', { code: response.data.code, msg: errorMsg });
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      logger.error('Error al obtener lista de planes', {
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
    try {
      await this.ensureAuthenticated();

      logger.info('Obteniendo configuración del sistema', { type: data.type, authenticated: this.isAuthenticated(), hasToken: !!this.token });

      const response = await this.client.post<ApiResponse<SystemConfig>>('/set/info', this.toFormData(data));

      // Handle 401 in response body (token expired)
      if (response.data.code === 401) {
        logger.warn('Token expirado durante getSystemConfig, limpiando autenticación y reintentando');
        this.clearAuth();

        // Retry once after re-authentication
        await this.ensureAuthenticated();
        const retryResponse = await this.client.post<ApiResponse<SystemConfig>>('/set/info', this.toFormData(data));

        if (retryResponse.data.code === 1 && retryResponse.data.data) {
          logger.info('Configuración del sistema obtenida exitosamente después del reintento');
          return retryResponse.data.data;
        } else {
          const errorMsg = retryResponse.data.msg || 'Failed to get system config after retry';
          logger.error('API de configuración del sistema retornó error después del reintento', { code: retryResponse.data.code, msg: errorMsg });
          throw new Error(errorMsg);
        }
      }

      if (response.data.code === 1 && response.data.data) {
        logger.info('Configuración del sistema obtenida exitosamente');
        return response.data.data;
      } else {
        const errorMsg = response.data.msg || 'Failed to get system config';
        logger.error('API de configuración del sistema retornó error', { code: response.data.code, msg: errorMsg });
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      logger.error('Error al obtener configuración del sistema', {
        error: error.message || error,
        data,
        authenticated: this.isAuthenticated(),
        hasToken: !!this.token,
        stack: error.stack
      });
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
      logger.info('Configurando sistema', { type: data.type });

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
          payload.qrcode_color = data.qrcodeColor;
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

      logger.info('Configuración del sistema actualizada exitosamente', { type: data.type });
    } catch (error) {
      logger.error('Error al configurar sistema', { error, data });
      throw error;
    }
  }
}

// Create and initialize singleton instance
const wsChargeApiService = new WsChargeApiService();

// Auto-initialize on startup (non-blocking)
wsChargeApiService.initialize().catch((error) => {
  logger.error('Error al inicializar servicio de API WsCharge en el arranque', { error });
});

export { wsChargeApiService };
