import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../.generated/prisma/client';

const prismaClientSingleton = () => {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: true,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    transactionOptions: {
      maxWait: 5000,
      timeout: 10000,
    },
  });
};

declare const globalThis: {
  dbGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const db = globalThis.dbGlobal ?? prismaClientSingleton();

export { db };

if (process.env.NODE_ENV !== 'production') globalThis.dbGlobal = db;
