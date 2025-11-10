import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { AppError } from '../middleware/error.middleware';
import { stripeService } from './stripe.service';
import { Rental, RentalStatus } from '@prisma/client';

export class RentalService {
  /**
   * Crear una nueva renta
   */
  async createRental(
    userId: string,
    cabinetId: string,
    slotNumber: number
  ): Promise<Rental> {
    // Verificar que el usuario no tenga rentas activas
    const activeRental = await prisma.rental.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
    });

    if (activeRental) {
      throw new AppError(400, 'You already have an active rental');
    }

    // Verificar que el gabinete existe y está online
    const cabinet = await prisma.cabinet.findUnique({
      where: { id: cabinetId },
      include: {
        slots: {
          where: { slotNumber },
          include: {
            powerBank: true,
          },
        },
      },
    });

    if (!cabinet) {
      throw new AppError(404, 'Cabinet not found');
    }

    if (cabinet.status !== 'ONLINE') {
      throw new AppError(400, 'Cabinet is not available');
    }

    const slot = cabinet.slots[0];
    if (!slot) {
      throw new AppError(404, 'Slot not found');
    }

    const powerBank = slot.powerBank;
    if (!powerBank) {
      throw new AppError(400, 'No power bank in this slot');
    }

    if (powerBank.status !== 'AVAILABLE') {
      throw new AppError(400, 'Power bank is not available');
    }

    // Obtener pricing plan activo
    const pricingPlan = await prisma.pricingPlan.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!pricingPlan) {
      throw new AppError(500, 'No pricing plan configured');
    }

    // Crear Payment Intent
    const paymentIntent = await stripeService.createPaymentIntent(
      userId,
      Number(pricingPlan.basePrice)
    );

    // Calcular due date
    const dueAt = new Date();
    dueAt.setHours(dueAt.getHours() + 24); // 24 horas por defecto

    // Crear renta
    const rental = await prisma.rental.create({
      data: {
        userId,
        cabinetId,
        powerBankId: powerBank.id,
        rentalCabinetId: cabinetId,
        basePrice: pricingPlan.basePrice,
        dueAt,
        status: 'ACTIVE',
      },
      include: {
        powerBank: true,
        cabinet: true,
      },
    });

    // Crear transacción
    await prisma.transaction.create({
      data: {
        userId,
        rentalId: rental.id,
        stripePaymentIntentId: paymentIntent.id,
        amount: pricingPlan.basePrice,
        currency: 'usd',
        status: 'PENDING',
        type: 'RENTAL',
      },
    });

    // Actualizar contador de rentas del power bank
    await prisma.powerBank.update({
      where: { id: powerBank.id },
      data: {
        totalRentals: { increment: 1 },
      },
    });

    logger.info('Renta creada', { rentalId: rental.id, userId, powerBankId: powerBank.id });

    return rental;
  }

  /**
   * Completar una renta (cuando se devuelve el power bank)
   */
  async completeRental(rentalId: string): Promise<Rental> {
    const rental = await prisma.rental.findUnique({
      where: { id: rentalId },
      include: {
        powerBank: true,
        transactions: true,
      },
    });

    if (!rental) {
      throw new AppError(404, 'Rental not found');
    }

    if (rental.status !== 'ACTIVE') {
      throw new AppError(400, 'Rental is not active');
    }

    // Calcular tiempo total y posibles cargos adicionales
    const returnedAt = new Date();
    const rentalDuration = returnedAt.getTime() - rental.rentedAt.getTime();
    const hours = Math.ceil(rentalDuration / (1000 * 60 * 60));

    // Obtener pricing plan
    const pricingPlan = await prisma.pricingPlan.findFirst({
      where: { isActive: true },
    });

    let lateFee = 0;
    if (rental.dueAt && returnedAt > rental.dueAt) {
      const lateHours = Math.ceil(
        (returnedAt.getTime() - rental.dueAt.getTime()) / (1000 * 60 * 60)
      );
      lateFee = Number(pricingPlan?.lateFeePerhour || 0) * lateHours;
    }

    // Calcular total
    const hourlyCharge = Number(pricingPlan?.hourlyRate || 0) * hours;
    const totalAmount = Number(rental.basePrice) + hourlyCharge + lateFee;

    // Actualizar renta
    const updatedRental = await prisma.rental.update({
      where: { id: rentalId },
      data: {
        status: 'COMPLETED',
        returnedAt,
        lateFee,
        totalAmount,
      },
    });

    // Crear transacción por cargos adicionales si existen
    if (lateFee > 0) {
      await prisma.transaction.create({
        data: {
          userId: rental.userId,
          rentalId: rental.id,
          amount: lateFee,
          currency: 'usd',
          status: 'PENDING',
          type: 'LATE_FEE',
          description: `Late fee for ${Math.ceil(
            (returnedAt.getTime() - rental.dueAt!.getTime()) / (1000 * 60 * 60)
          )} hours`,
        },
      });
    }

    logger.info('Renta completada', {
      rentalId,
      duration: hours,
      totalAmount,
      lateFee,
    });

    return updatedRental;
  }

  /**
   * Obtener rentas del usuario
   */
  async getUserRentals(userId: string, status?: RentalStatus): Promise<Rental[]> {
    return prisma.rental.findMany({
      where: {
        userId,
        ...(status && { status }),
      },
      include: {
        powerBank: true,
        cabinet: true,
        transactions: true,
      },
      orderBy: {
        rentedAt: 'desc',
      },
    });
  }

  /**
   * Obtener renta activa del usuario
   */
  async getActiveRental(userId: string): Promise<Rental | null> {
    return prisma.rental.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
      include: {
        powerBank: true,
        cabinet: true,
        transactions: true,
      },
    });
  }

  /**
   * Reportar power bank como perdido
   */
  async reportLost(rentalId: string): Promise<void> {
    const rental = await prisma.rental.findUnique({
      where: { id: rentalId },
    });

    if (!rental) {
      throw new AppError(404, 'Rental not found');
    }

    // Obtener pricing plan
    const pricingPlan = await prisma.pricingPlan.findFirst({
      where: { isActive: true },
    });

    const lostFee = Number(pricingPlan?.lostFee || 50);

    // Crear cargo por pérdida
    const paymentIntent = await stripeService.createPaymentIntent(rental.userId, lostFee);

    // Actualizar renta
    await prisma.rental.update({
      where: { id: rentalId },
      data: {
        status: 'LOST',
      },
    });

    // Actualizar power bank
    await prisma.powerBank.update({
      where: { id: rental.powerBankId },
      data: {
        status: 'LOST',
      },
    });

    // Crear transacción
    await prisma.transaction.create({
      data: {
        userId: rental.userId,
        rentalId: rental.id,
        stripePaymentIntentId: paymentIntent.id,
        amount: lostFee,
        currency: 'usd',
        status: 'PENDING',
        type: 'LOST_FEE',
        description: 'Charge for lost power bank',
      },
    });

    logger.info('Power bank reportado como perdido', { rentalId, lostFee });
  }
}

export const rentalService = new RentalService();
