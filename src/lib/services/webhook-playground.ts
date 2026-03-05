import { db } from '@/lib/db';
import type { Prisma } from '../../../.generated/prisma/client';

export async function storeWebhookPayload(data: {
  payload: Prisma.InputJsonValue;
  headers: Prisma.InputJsonValue;
  method: string;
  url: string;
  status: string;
  response?: Prisma.InputJsonValue;
}) {
  await db.fcoWebhookPlayground.create({
    data: {
      payload: data.payload,
      headers: data.headers,
      method: data.method,
      url: data.url,
      status: data.status,
      response: data.response,
    },
  });

  // Keep only last 100 payloads
  const count = await db.fcoWebhookPlayground.count();
  if (count > 100) {
    const toDelete = await db.fcoWebhookPlayground.findMany({
      orderBy: { receivedAt: 'desc' },
      skip: 100,
      select: { id: true },
    });
    if (toDelete.length > 0) {
      await db.fcoWebhookPlayground.deleteMany({
        where: { id: { in: toDelete.map(p => p.id) } },
      });
    }
  }
}

export async function getWebhookPayloads(limit = 50) {
  return db.fcoWebhookPlayground.findMany({
    orderBy: { receivedAt: 'desc' },
    take: limit,
  });
}

export async function clearWebhookPayloads() {
  const result = await db.fcoWebhookPlayground.deleteMany();
  return { deleted: result.count };
}
