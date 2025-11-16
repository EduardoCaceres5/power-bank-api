import { Request, Response, NextFunction } from 'express';
import { wsChargeApiService } from '../services/wscharge-api.service';
import { logger } from '../lib/logger';

/**
 * WsCharge API Controller
 * Handles HTTP requests for WsCharge power bank cabinet management
 */
export class WsChargeApiController {
  // ==================== AUTHENTICATION ====================

  /**
   * Login to WsCharge API (Manual/Override)
   * POST /api/v1/wscharge/auth/login
   *
   * Note: This is optional. If WSCHARGE_USERNAME and WSCHARGE_PASSWORD are set in .env,
   * the service will auto-login on startup and on first API call.
   * Use this endpoint to manually login with different credentials or to force a re-login.
   */
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, password } = req.body;

      if (!name || !password) {
        return res.status(400).json({
          success: false,
          error: 'Name and password are required',
        });
      }

      const result = await wsChargeApiService.login({ name, password });

      res.json({
        success: true,
        data: result,
        message: 'Login successful. Token valid for 30 minutes.',
      });
    } catch (error) {
      logger.error('Login error', { error });
      next(error);
    }
  }

  /**
   * Check authentication status
   * GET /api/v1/wscharge/auth/status
   */
  static async getAuthStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const isAuthenticated = wsChargeApiService.isAuthenticated();

      res.json({
        success: true,
        data: {
          authenticated: isAuthenticated,
        },
      });
    } catch (error) {
      logger.error('Auth status error', { error });
      next(error);
    }
  }

  // ==================== DEVICE MANAGEMENT ====================

  /**
   * Add a new cabinet
   * POST /api/v1/wscharge/cabinets
   */
  static async addCabinet(req: Request, res: Response, next: NextFunction) {
    try {
      const { cabinet_id, qrcode, model, sim } = req.body;

      if (!cabinet_id || !qrcode || !model) {
        return res.status(400).json({
          success: false,
          error: 'cabinet_id, qrcode, and model are required',
        });
      }

      const result = await wsChargeApiService.addCabinet({
        cabinet_id,
        qrcode,
        model,
        sim,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Add cabinet error', { error });
      next(error);
    }
  }

  /**
   * Edit cabinet information
   * PUT /api/v1/wscharge/cabinets/:cabinetId
   */
  static async editCabinet(req: Request, res: Response, next: NextFunction) {
    try {
      const { cabinetId } = req.params;
      const { qrcode, model, sim } = req.body;

      if (!qrcode || !model) {
        return res.status(400).json({
          success: false,
          error: 'qrcode and model are required',
        });
      }

      await wsChargeApiService.editCabinet({
        cabinet_id: cabinetId,
        qrcode,
        model,
        sim,
      });

      res.json({
        success: true,
        message: 'Cabinet updated successfully',
      });
    } catch (error) {
      logger.error('Edit cabinet error', { error });
      next(error);
    }
  }

  /**
   * Get cabinet information
   * GET /api/v1/wscharge/cabinets/:cabinetId
   */
  static async getCabinetInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const { cabinetId } = req.params;

      const result = await wsChargeApiService.getCabinetInfo({
        cabinet_id: cabinetId,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Get cabinet info error', { error });
      next(error);
    }
  }

  /**
   * Delete cabinet
   * DELETE /api/v1/wscharge/cabinets/:cabinetId
   */
  static async deleteCabinet(req: Request, res: Response, next: NextFunction) {
    try {
      const { cabinetId } = req.params;

      await wsChargeApiService.deleteCabinet({
        cabinet_id: cabinetId,
      });

      res.json({
        success: true,
        message: 'Cabinet deleted successfully',
      });
    } catch (error) {
      logger.error('Delete cabinet error', { error });
      next(error);
    }
  }

  /**
   * Get cabinet list
   * GET /api/v1/wscharge/cabinets
   */
  static async getCabinetList(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        page = 1,
        page_size = 20,
        cabinet_id,
        qrcode,
        model,
        is_online,
      } = req.query;

      const result = await wsChargeApiService.getCabinetList({
        page: Number(page),
        page_size: Number(page_size),
        cabinet_id: cabinet_id as string,
        qrcode: qrcode as string,
        model: model as string,
        is_online: is_online ? Number(is_online) : undefined,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Get cabinet list error', { error });
      next(error);
    }
  }

  /**
   * Get battery list
   * GET /api/v1/wscharge/batteries
   */
  static async getBatteryList(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = 1, page_size = 20, device_id } = req.query;

      const result = await wsChargeApiService.getBatteryList({
        page: Number(page),
        page_size: Number(page_size),
        device_id: device_id as string,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Get battery list error', { error });
      next(error);
    }
  }

  // ==================== DEVICE OPERATIONS ====================

  /**
   * Issue command to cabinet
   * POST /api/v1/wscharge/cabinets/:cabinetId/command
   */
  static async issueCommand(req: Request, res: Response, next: NextFunction) {
    try {
      const { cabinetId } = req.params;
      const { type, lock_id, order_no } = req.body;

      if (!type || !['restart', 'borrow', 'open', 'openAll'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'Valid command type is required (restart, borrow, open, openAll)',
        });
      }

      // Validate required fields based on command type
      if ((type === 'borrow' || type === 'open') && lock_id === undefined) {
        return res.status(400).json({
          success: false,
          error: `lock_id is required for ${type} command`,
        });
      }

      if (type === 'borrow' && !order_no) {
        return res.status(400).json({
          success: false,
          error: 'order_no is required for borrow command',
        });
      }

      const result = await wsChargeApiService.issueCommand({
        cabinet_id: cabinetId,
        type,
        lock_id,
        order_no,
      });

      res.json({
        success: true,
        data: result,
        message: `Command ${type} issued successfully`,
      });
    } catch (error) {
      logger.error('Issue command error', { error });
      next(error);
    }
  }

  /**
   * Get cabinet details (current power bank information)
   * GET /api/v1/wscharge/cabinets/:cabinetId/details
   */
  static async getCabinetDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const { cabinetId } = req.params;

      const result = await wsChargeApiService.getCabinetDetails({
        cabinet_id: cabinetId,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Get cabinet details error', { error });
      next(error);
    }
  }

  // ==================== SCREEN MANAGEMENT - AD MATERIALS ====================

  /**
   * Add AD material
   * POST /api/v1/wscharge/screen/materials
   */
  static async addMaterial(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, path, type } = req.body;

      if (!path || !type || !['image', 'video'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'path and type (image/video) are required',
        });
      }

      if (!path.startsWith('https://')) {
        return res.status(400).json({
          success: false,
          error: 'path must be an HTTPS URL',
        });
      }

      const result = await wsChargeApiService.addMaterial({
        name,
        path,
        type,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Add material error', { error });
      next(error);
    }
  }

  /**
   * Delete AD material
   * DELETE /api/v1/wscharge/screen/materials/:materialId
   */
  static async deleteMaterial(req: Request, res: Response, next: NextFunction) {
    try {
      const { materialId } = req.params;

      await wsChargeApiService.deleteMaterial({
        id: Number(materialId),
      });

      res.json({
        success: true,
        message: 'Material deleted successfully',
      });
    } catch (error) {
      logger.error('Delete material error', { error });
      next(error);
    }
  }

  /**
   * Get material list
   * GET /api/v1/wscharge/screen/materials
   */
  static async getMaterialList(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = 1, page_size = 20, type, name } = req.query;

      const result = await wsChargeApiService.getMaterialList({
        page: Number(page),
        page_size: Number(page_size),
        type: type as 'image' | 'video',
        name: name as string,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Get material list error', { error });
      next(error);
    }
  }

  // ==================== SCREEN MANAGEMENT - AD GROUPS ====================

  /**
   * Add AD group
   * POST /api/v1/wscharge/screen/groups
   */
  static async addGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, details } = req.body;

      if (!name || !details || !Array.isArray(details)) {
        return res.status(400).json({
          success: false,
          error: 'name and details array are required',
        });
      }

      const result = await wsChargeApiService.addGroup({
        name,
        details,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Add group error', { error });
      next(error);
    }
  }

  /**
   * Edit AD group
   * PUT /api/v1/wscharge/screen/groups/:groupId
   */
  static async editGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const { groupId } = req.params;
      const { name, details } = req.body;

      if (!name || !details || !Array.isArray(details)) {
        return res.status(400).json({
          success: false,
          error: 'name and details array are required',
        });
      }

      await wsChargeApiService.editGroup({
        id: Number(groupId),
        name,
        details,
      });

      res.json({
        success: true,
        message: 'Group updated successfully',
      });
    } catch (error) {
      logger.error('Edit group error', { error });
      next(error);
    }
  }

  /**
   * Delete AD group
   * DELETE /api/v1/wscharge/screen/groups/:groupId
   */
  static async deleteGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const { groupId } = req.params;

      await wsChargeApiService.deleteGroup({
        id: Number(groupId),
      });

      res.json({
        success: true,
        message: 'Group deleted successfully',
      });
    } catch (error) {
      logger.error('Delete group error', { error });
      next(error);
    }
  }

  /**
   * Get group detail
   * GET /api/v1/wscharge/screen/groups/:groupId
   */
  static async getGroupDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const { groupId } = req.params;

      const result = await wsChargeApiService.getGroupDetail({
        id: Number(groupId),
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Get group detail error', { error });
      next(error);
    }
  }

  /**
   * Get group list
   * GET /api/v1/wscharge/screen/groups
   */
  static async getGroupList(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = 1, page_size = 20, name } = req.query;

      const result = await wsChargeApiService.getGroupList({
        page: Number(page),
        page_size: Number(page_size),
        name: name as string,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Get group list error', { error });
      next(error);
    }
  }

  // ==================== SCREEN MANAGEMENT - AD PLANS ====================

  /**
   * Add AD plan
   * POST /api/v1/wscharge/screen/plans
   */
  static async addPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const { plan_name, start_date, end_date, details, equipment_group } = req.body;

      if (!plan_name || !start_date || !end_date || !details || !equipment_group) {
        return res.status(400).json({
          success: false,
          error:
            'plan_name, start_date, end_date, details, and equipment_group are required',
        });
      }

      // Validate equipment_group is not "undefined" or empty string
      if (equipment_group === 'undefined' || equipment_group.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'equipment_group must contain valid cabinet IDs (comma-separated)',
        });
      }

      const result = await wsChargeApiService.addPlan({
        plan_name,
        start_date,
        end_date,
        details,
        equipment_group,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Add plan error', { error });
      next(error);
    }
  }

  /**
   * Edit AD plan
   * PUT /api/v1/wscharge/screen/plans/:planId
   */
  static async editPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const { planId } = req.params;
      const { plan_name, start_date, end_date, details, equipment_group } = req.body;

      if (!plan_name || !start_date || !end_date || !details || !equipment_group) {
        return res.status(400).json({
          success: false,
          error:
            'plan_name, start_date, end_date, details, and equipment_group are required',
        });
      }

      // Validate equipment_group is not "undefined" or empty string
      if (equipment_group === 'undefined' || equipment_group.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'equipment_group must contain valid cabinet IDs (comma-separated)',
        });
      }

      await wsChargeApiService.editPlan({
        id: Number(planId),
        plan_name,
        start_date,
        end_date,
        details,
        equipment_group,
      });

      res.json({
        success: true,
        message: 'Plan updated successfully',
      });
    } catch (error) {
      logger.error('Edit plan error', { error });
      next(error);
    }
  }

  /**
   * Delete AD plan
   * DELETE /api/v1/wscharge/screen/plans/:planId
   */
  static async deletePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const { planId } = req.params;

      await wsChargeApiService.deletePlan({
        id: Number(planId),
      });

      res.json({
        success: true,
        message: 'Plan deleted successfully',
      });
    } catch (error) {
      logger.error('Delete plan error', { error });
      next(error);
    }
  }

  /**
   * Get plan detail
   * GET /api/v1/wscharge/screen/plans/:planId
   */
  static async getPlanDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const { planId } = req.params;

      const result = await wsChargeApiService.getPlanDetail({
        id: Number(planId),
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Get plan detail error', { error });
      next(error);
    }
  }

  /**
   * Get plan list
   * GET /api/v1/wscharge/screen/plans
   */
  static async getPlanList(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = 1, name } = req.query;

      const result = await wsChargeApiService.getPlanList({
        page: Number(page),
        name: name as string,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Get plan list error', { error });
      next(error);
    }
  }

  // ==================== SYSTEM SETTINGS ====================

  /**
   * Get system configuration
   * GET /api/v1/wscharge/settings/:type
   */
  static async getSystemConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const { type } = req.params;

      const validTypes = ['battery_power', 'screen_default', 'webhook', 'qrcode_color'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
        });
      }

      const result = await wsChargeApiService.getSystemConfig({
        type: type as any,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Get system config error', { error });
      next(error);
    }
  }

  /**
   * Set system configuration
   * POST /api/v1/wscharge/settings
   */
  static async setSystemConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const { type, ...configData } = req.body;

      const validTypes = ['battery_power', 'screen_default', 'webhook', 'qrcode_color'];
      if (!type || !validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: `type is required and must be one of: ${validTypes.join(', ')}`,
        });
      }

      await wsChargeApiService.setSystemConfig({
        type,
        ...configData,
      });

      res.json({
        success: true,
        message: 'System configuration updated successfully',
      });
    } catch (error) {
      logger.error('Set system config error', { error });
      next(error);
    }
  }
}
