import { PrismaClient } from '@prisma/client';

// Singleton pattern para Prisma Client
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Configurar logs de Prisma basado en variables de entorno
const getPrismaLogLevel = () => {
  if (process.env.PRISMA_LOG_QUERIES === 'true') {
    return ['query', 'error', 'warn'];
  }
  return process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'];
};

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: getPrismaLogLevel() as any,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
