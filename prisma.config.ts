import dotenv from 'dotenv';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Load .env.local first (higher priority), then .env as fallback
dotenv.config({ path: '.env.local' });
dotenv.config();

export default defineConfig({
  datasource: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  },

  schema: path.join('prisma', 'schema.prisma'),

  migrations: {
    path: path.join('prisma', 'migrations'),
  },
});
