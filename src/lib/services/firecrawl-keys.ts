import { db } from '@/lib/db';

export async function getUserFirecrawlKey(userId: string) {
  const apiKey = await db.fcoFirecrawlApiKey.findUnique({ where: { userId } });

  if (!apiKey) return null;

  const key = apiKey.encryptedKey;
  return {
    hasKey: true,
    lastUsed: apiKey.lastUsed,
    createdAt: apiKey.createdAt,
    updatedAt: apiKey.updatedAt,
    maskedKey: key.slice(0, 8) + '...' + key.slice(-4),
  };
}

export async function setFirecrawlKey(userId: string, apiKey: string) {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey || trimmedKey.length < 20) {
    throw new Error('Invalid API key format');
  }
  if (!trimmedKey.startsWith('fc-')) {
    throw new Error("Invalid Firecrawl API key format. Keys should start with 'fc-'");
  }

  await db.fcoFirecrawlApiKey.upsert({
    where: { userId },
    update: { encryptedKey: trimmedKey },
    create: {
      userId,
      encryptedKey: trimmedKey,
    },
  });

  return { success: true };
}

export async function deleteFirecrawlKey(userId: string) {
  await db.fcoFirecrawlApiKey.deleteMany({ where: { userId } });
  return { success: true };
}

export async function getTokenUsage(userId: string) {
  const userKey = await db.fcoFirecrawlApiKey.findUnique({ where: { userId } });

  if (!userKey) {
    return { success: false, error: 'No API key found' };
  }

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/team/credit-usage', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${userKey.encryptedKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json() as Record<string, unknown>;
      return { success: false, error: (errorData.error as string) || `API error: ${response.status}` };
    }

    const data = await response.json() as Record<string, unknown>;
    return { success: true, remaining_tokens: (data.data as Record<string, unknown>)?.remaining_credits };
  } catch (error) {
    console.error('Failed to fetch token usage:', error);
    return { success: false, error: 'Failed to fetch token usage' };
  }
}
