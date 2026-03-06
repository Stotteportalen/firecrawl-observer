import { db } from '@/lib/db';
import type { EnqueueJobParams } from './types';
import type { Prisma } from '../../../../.generated/prisma/client';

export async function enqueueJob(params: EnqueueJobParams) {
  const job = await db.jobQueue.create({
    data: {
      userId: params.userId,
      type: params.type,
      url: params.url,
      urls: params.urls as Prisma.InputJsonValue ?? undefined,
      options: params.options as Prisma.InputJsonValue,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      priority: params.priority ?? 5,
      maxAttempts: params.maxAttempts ?? 3,
    },
  });

  // Ensure the worker is running
  const { ensureWorkerRunning } = await import('./worker');
  ensureWorkerRunning();

  return job;
}

export async function enqueueJobs(paramsList: EnqueueJobParams[]) {
  const jobs = await db.$transaction(
    paramsList.map(params =>
      db.jobQueue.create({
        data: {
          userId: params.userId,
          type: params.type,
          url: params.url,
          urls: params.urls as Prisma.InputJsonValue ?? undefined,
          options: params.options as Prisma.InputJsonValue,
          sourceType: params.sourceType,
          sourceId: params.sourceId,
          priority: params.priority ?? 5,
          maxAttempts: params.maxAttempts ?? 3,
        },
      })
    )
  );

  const { ensureWorkerRunning } = await import('./worker');
  ensureWorkerRunning();

  return jobs;
}
