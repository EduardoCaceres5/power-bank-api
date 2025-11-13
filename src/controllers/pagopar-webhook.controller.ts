import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { pagoparService } from '../services/pagopar.service';

export class PagoparWebhookController {
  /**
   * POST /webhooks/pagopar
   * Procesar notificaciones de Pagopar
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['x-pagopar-signature'] as string;
      const payload = JSON.stringify(req.body);

      // Validar firma del webhook
      if (!pagoparService.validateWebhookSignature(payload, signature)) {
        logger.warn('Invalid Pagopar webhook signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      const { event, transaction_id, preauth_id, amount, status, timestamp } = req.body;

      logger.info('Pagopar webhook received', {
        event,
        transaction_id,
        preauth_id,
        status,
      });

      // Procesar según el tipo de evento
      switch (event) {
        case 'transaction.approved':
          await this.handleTransactionApproved(transaction_id, amount);
          break;

        case 'transaction.rejected':
          await this.handleTransactionRejected(transaction_id);
          break;

        case 'preauth.approved':
          await this.handlePreAuthApproved(preauth_id, amount);
          break;

        case 'preauth.captured':
          await this.handlePreAuthCaptured(preauth_id, amount);
          break;

        case 'preauth.voided':
          await this.handlePreAuthVoided(preauth_id);
          break;

        default:
          logger.warn('Unhandled Pagopar webhook event', { event });
      }

      res.json({ received: true });
    } catch (error: any) {
      logger.error('Error processing Pagopar webhook', { error });
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  private async handleTransactionApproved(transactionId: string, amount: number): Promise<void> {
    const transaction = await prisma.transaction.findFirst({
      where: { pagoparTransactionId: transactionId },
    });

    if (transaction) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'COMPLETED' },
      });

      logger.info('Pagopar transaction approved', { transactionId });
    }
  }

  private async handleTransactionRejected(transactionId: string): Promise<void> {
    const transaction = await prisma.transaction.findFirst({
      where: { pagoparTransactionId: transactionId },
    });

    if (transaction) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' },
      });

      // Cancelar rental asociado si existe
      if (transaction.rentalId) {
        await prisma.rental.update({
          where: { id: transaction.rentalId },
          data: { status: 'CANCELLED' },
        });
      }

      logger.info('Pagopar transaction rejected', { transactionId });
    }
  }

  private async handlePreAuthApproved(preAuthId: string, amount: number): Promise<void> {
    const transaction = await prisma.transaction.findFirst({
      where: { pagoparTransactionId: preAuthId },
    });

    if (transaction) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'PENDING' }, // Pendiente de captura
      });

      logger.info('Pagopar preauth approved', { preAuthId });
    }
  }

  private async handlePreAuthCaptured(preAuthId: string, amount: number): Promise<void> {
    const transaction = await prisma.transaction.findFirst({
      where: { pagoparTransactionId: preAuthId },
    });

    if (transaction) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'COMPLETED',
          amount, // Actualizar con el monto capturado
        },
      });

      logger.info('Pagopar preauth captured', { preAuthId, amount });
    }
  }

  private async handlePreAuthVoided(preAuthId: string): Promise<void> {
    const transaction = await prisma.transaction.findFirst({
      where: { pagoparTransactionId: preAuthId },
    });

    if (transaction) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'CANCELLED' },
      });

      // Cancelar rental asociado si existe
      if (transaction.rentalId) {
        await prisma.rental.update({
          where: { id: transaction.rentalId },
          data: { status: 'CANCELLED' },
        });
      }

      logger.info('Pagopar preauth voided', { preAuthId });
    }
  }
}

export const pagoparWebhookController = new PagoparWebhookController();
