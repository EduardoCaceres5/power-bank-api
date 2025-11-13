import { Router } from 'express';
import { pagoparWebhookController } from '../controllers/pagopar-webhook.controller';

const router = Router();

/**
 * POST /webhooks/pagopar
 * Procesar webhooks de Pagopar
 */
router.post('/pagopar', (req, res) => pagoparWebhookController.handleWebhook(req, res));

export default router;
