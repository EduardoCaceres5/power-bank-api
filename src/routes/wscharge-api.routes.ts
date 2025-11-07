import { Router } from 'express';
import { WsChargeApiController } from '../controllers/wscharge-api.controller';

const router = Router();

// ==================== AUTHENTICATION ====================
router.post('/auth/login', WsChargeApiController.login);
router.get('/auth/status', WsChargeApiController.getAuthStatus);

// ==================== DEVICE MANAGEMENT ====================
router.post('/cabinets', WsChargeApiController.addCabinet);
router.get('/cabinets', WsChargeApiController.getCabinetList);
router.get('/cabinets/:cabinetId', WsChargeApiController.getCabinetInfo);
router.put('/cabinets/:cabinetId', WsChargeApiController.editCabinet);
router.delete('/cabinets/:cabinetId', WsChargeApiController.deleteCabinet);

// Battery Management
router.get('/batteries', WsChargeApiController.getBatteryList);

// ==================== DEVICE OPERATIONS ====================
router.post('/cabinets/:cabinetId/command', WsChargeApiController.issueCommand);
router.get('/cabinets/:cabinetId/details', WsChargeApiController.getCabinetDetails);

// ==================== SCREEN MANAGEMENT - AD MATERIALS ====================
router.post('/screen/materials', WsChargeApiController.addMaterial);
router.get('/screen/materials', WsChargeApiController.getMaterialList);
router.delete('/screen/materials/:materialId', WsChargeApiController.deleteMaterial);

// ==================== SCREEN MANAGEMENT - AD GROUPS ====================
router.post('/screen/groups', WsChargeApiController.addGroup);
router.get('/screen/groups', WsChargeApiController.getGroupList);
router.get('/screen/groups/:groupId', WsChargeApiController.getGroupDetail);
router.put('/screen/groups/:groupId', WsChargeApiController.editGroup);
router.delete('/screen/groups/:groupId', WsChargeApiController.deleteGroup);

// ==================== SCREEN MANAGEMENT - AD PLANS ====================
router.post('/screen/plans', WsChargeApiController.addPlan);
router.get('/screen/plans', WsChargeApiController.getPlanList);
router.get('/screen/plans/:planId', WsChargeApiController.getPlanDetail);
router.put('/screen/plans/:planId', WsChargeApiController.editPlan);
router.delete('/screen/plans/:planId', WsChargeApiController.deletePlan);

// ==================== SYSTEM SETTINGS ====================
router.get('/settings/:type', WsChargeApiController.getSystemConfig);
router.post('/settings', WsChargeApiController.setSystemConfig);

export default router;
