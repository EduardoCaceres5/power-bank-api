import Stripe from 'stripe';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

export class StripeService {
  /**
   * Crear o obtener Stripe Customer para un usuario
   */
  async getOrCreateCustomer(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Si ya tiene Stripe Customer ID, retornarlo
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    // Crear nuevo customer en Stripe
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.fullName || undefined,
      metadata: {
        userId: user.id,
      },
    });

    // Guardar en DB
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });

    logger.info('Cliente de Stripe creado', { userId, customerId: customer.id });

    return customer.id;
  }

  /**
   * Crear Payment Intent para una renta
   */
  async createPaymentIntent(
    userId: string,
    amount: number,
    currency = 'usd'
  ): Promise<Stripe.PaymentIntent> {
    const customerId = await this.getOrCreateCustomer(userId);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convertir a centavos
      currency,
      customer: customerId,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId,
      },
    });

    logger.info('Intención de pago creada', {
      userId,
      paymentIntentId: paymentIntent.id,
      amount,
    });

    return paymentIntent;
  }

  /**
   * Confirmar un pago
   */
  async confirmPayment(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);

    logger.info('Intención de pago confirmada', { paymentIntentId });

    return paymentIntent;
  }

  /**
   * Crear método de pago
   */
  async attachPaymentMethod(
    userId: string,
    paymentMethodId: string,
    setAsDefault = false
  ): Promise<void> {
    const customerId = await this.getOrCreateCustomer(userId);

    // Adjuntar método de pago al customer
    const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // Guardar en DB
    await prisma.paymentMethod.create({
      data: {
        userId,
        stripePaymentMethodId: paymentMethodId,
        type: paymentMethod.type,
        last4: paymentMethod.card?.last4,
        brand: paymentMethod.card?.brand,
        expiryMonth: paymentMethod.card?.exp_month,
        expiryYear: paymentMethod.card?.exp_year,
        isDefault: setAsDefault,
      },
    });

    // Si es el método por defecto, actualizar en Stripe
    if (setAsDefault) {
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // Quitar flag de default de otros métodos
      await prisma.paymentMethod.updateMany({
        where: {
          userId,
          stripePaymentMethodId: { not: paymentMethodId },
        },
        data: { isDefault: false },
      });
    }

    logger.info('Método de pago adjuntado', { userId, paymentMethodId });
  }

  /**
   * Crear reembolso
   */
  async createRefund(
    paymentIntentId: string,
    amount?: number,
    reason?: string
  ): Promise<Stripe.Refund> {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined,
      reason: reason as Stripe.RefundCreateParams.Reason,
    });

    logger.info('Reembolso creado', { paymentIntentId, refundId: refund.id, amount });

    return refund;
  }

  /**
   * Obtener métodos de pago del usuario
   */
  async getPaymentMethods(userId: string): Promise<Stripe.PaymentMethod[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.stripeCustomerId) {
      return [];
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: 'card',
    });

    return paymentMethods.data;
  }

  /**
   * Eliminar método de pago
   */
  async detachPaymentMethod(paymentMethodId: string): Promise<void> {
    await stripe.paymentMethods.detach(paymentMethodId);

    await prisma.paymentMethod.delete({
      where: { stripePaymentMethodId: paymentMethodId },
    });

    logger.info('Método de pago desvinculado', { paymentMethodId });
  }
}

export const stripeService = new StripeService();
