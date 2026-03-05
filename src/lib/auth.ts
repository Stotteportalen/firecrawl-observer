import { betterAuth } from 'better-auth';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { headers } from 'next/headers';
import { cache } from 'react';
import { db } from '@/lib/db';

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || undefined,
  trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS
    ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(',')
    : ['http://localhost:3005'],
  database: prismaAdapter(db, {
    provider: 'postgresql',
  }),

  session: {
    cookieCache: {
      enabled: true,
    },
    modelName: 'FcoSession',
  },

  emailAndPassword: {
    enabled: true,
  },

  onAPIError: {
    onError: (error: unknown) => console.error(error),
  },

  // Map to fco_ prefixed tables
  user: {
    modelName: 'FcoUser',
  },
  account: {
    modelName: 'FcoAccount',
  },
  verification: {
    modelName: 'FcoVerification',
  },
});

export const getServerSession = cache(async () => {
  return auth.api.getSession({
    headers: await headers(),
  });
});

export type Session = typeof auth.$Infer.Session;
