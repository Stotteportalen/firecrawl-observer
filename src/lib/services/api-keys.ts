import { db } from '@/lib/db';

function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'fc_';
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

export async function getUserApiKeys(userId: string) {
  const apiKeys = await db.fcoApiKey.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return apiKeys.map(key => ({
    id: key.id,
    name: key.name,
    keyPreview: `${key.key.slice(0, 7)}...${key.key.slice(-4)}`,
    lastUsed: key.lastUsed,
    createdAt: key.createdAt,
  }));
}

export async function createApiKey(userId: string, name: string) {
  const existingKeys = await db.fcoApiKey.findMany({ where: { userId } });
  if (existingKeys.length >= 5) {
    throw new Error('Maximum of 5 API keys allowed per user');
  }

  const apiKey = generateApiKey();

  const record = await db.fcoApiKey.create({
    data: {
      userId,
      key: apiKey,
      name,
    },
  });

  return {
    id: record.id,
    key: apiKey,
    name,
  };
}

export async function deleteApiKey(keyId: string, userId: string) {
  const apiKey = await db.fcoApiKey.findUnique({ where: { id: keyId } });
  if (!apiKey || apiKey.userId !== userId) {
    throw new Error('API key not found');
  }
  await db.fcoApiKey.delete({ where: { id: keyId } });
}

export async function validateApiKeyAndGetUser(apiKey: string) {
  const keyRecord = await db.fcoApiKey.findUnique({ where: { key: apiKey } });
  if (!keyRecord) return null;

  // Update last used
  await db.fcoApiKey.update({
    where: { id: keyRecord.id },
    data: { lastUsed: new Date() },
  });

  return db.fcoUser.findUnique({ where: { id: keyRecord.userId } });
}
