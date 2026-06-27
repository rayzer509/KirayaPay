import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

// Persist the client on globalThis so hot-reload (dev) and warm Lambda
// invocations (prod) both reuse the same instance instead of opening
// a new connection on every module evaluation.
globalForPrisma.prisma = prisma;
