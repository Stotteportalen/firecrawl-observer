import { db } from '@/lib/db';
import { getFirecrawlClient } from '@/lib/services/firecrawl';
import { handleJobCompletion, handleJobFailure } from './handlers';
import { registerAllHandlers } from './register-handlers';
import type { JobQueue } from './types';

// ─── Configuration ───────────────────────────────────────────
const MAX_CONCURRENT = 50;
const MAX_PER_MINUTE = 400;
const POLL_INTERVAL_MS = 500;
const BATCH_DEQUEUE_SIZE = 10;

// ─── Rate Limiter (sliding window) ──────────────────────────
const requestTimestamps: number[] = [];

function canMakeRequest(): boolean {
  const now = Date.now();
  // Remove timestamps older than 1 minute
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - 60000) {
    requestTimestamps.shift();
  }
  return requestTimestamps.length < MAX_PER_MINUTE;
}

function recordRequest() {
  requestTimestamps.push(Date.now());
}

// ─── Worker State ────────────────────────────────────────────
let isRunning = false;
let activeJobs = 0;
let pollTimer: ReturnType<typeof setTimeout> | null = null;

export function ensureWorkerRunning() {
  if (isRunning) return;
  registerAllHandlers();
  isRunning = true;
  console.log('[JobQueue] Worker started');
  schedulePoll();
}

export function stopWorker() {
  isRunning = false;
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  console.log('[JobQueue] Worker stopped');
}

function schedulePoll() {
  if (!isRunning) return;
  pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
}

async function poll() {
  if (!isRunning) return;

  try {
    const availableSlots = MAX_CONCURRENT - activeJobs;
    if (availableSlots <= 0 || !canMakeRequest()) {
      schedulePoll();
      return;
    }

    const toDequeue = Math.min(availableSlots, BATCH_DEQUEUE_SIZE);

    // Atomically claim jobs using updateMany with status filter
    const now = new Date();
    const pendingJobs = await db.jobQueue.findMany({
      where: {
        status: 'pending',
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: now } },
        ],
      },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'asc' },
      ],
      take: toDequeue,
    });

    if (pendingJobs.length === 0) {
      // Check if there are any non-terminal jobs left
      const remaining = await db.jobQueue.count({
        where: { status: { in: ['pending', 'running'] } },
      });
      if (remaining === 0 && activeJobs === 0) {
        console.log('[JobQueue] No more jobs, worker going idle');
        isRunning = false;
        return;
      }
      schedulePoll();
      return;
    }

    // Claim each job individually (prevents race conditions)
    for (const job of pendingJobs) {
      if (!canMakeRequest()) break;

      try {
        // Optimistic lock: only claim if still pending
        const claimed = await db.jobQueue.updateMany({
          where: { id: job.id, status: 'pending' },
          data: {
            status: 'running',
            startedAt: new Date(),
            attempts: { increment: 1 },
          },
        });

        if (claimed.count === 0) continue; // Another process claimed it

        activeJobs++;
        recordRequest();

        // Execute in background — don't await
        executeJob(job).finally(() => {
          activeJobs--;
        });
      } catch (err) {
        console.error(`[JobQueue] Failed to claim job ${job.id}:`, err);
      }
    }
  } catch (err) {
    console.error('[JobQueue] Poll error:', err);
  }

  schedulePoll();
}

async function executeJob(job: JobQueue) {
  try {
    const firecrawl = await getFirecrawlClient(job.userId);
    const options = (job.options as Record<string, unknown>) || {};
    let result: Record<string, unknown>;

    switch (job.type) {
      case 'scrape': {
        if (!job.url) throw new Error('scrape job requires url');
        const scrapeResult = await firecrawl.scrapeUrl(job.url, options as Parameters<typeof firecrawl.scrapeUrl>[1]);
        result = scrapeResult as unknown as Record<string, unknown>;
        break;
      }
      case 'map': {
        if (!job.url) throw new Error('map job requires url');
        const mapResult = await firecrawl.mapUrl(job.url, options as Parameters<typeof firecrawl.mapUrl>[1]);
        result = mapResult as unknown as Record<string, unknown>;
        break;
      }
      case 'crawl': {
        if (!job.url) throw new Error('crawl job requires url');
        const crawlResult = await firecrawl.crawlUrl(job.url, options as Parameters<typeof firecrawl.crawlUrl>[1]);
        result = crawlResult as unknown as Record<string, unknown>;
        break;
      }
      case 'batch_scrape': {
        const urls = (job.urls as string[]) || [];
        if (urls.length === 0) throw new Error('batch_scrape job requires urls');
        const batchResult = await firecrawl.batchScrapeUrls(urls, options as Parameters<typeof firecrawl.batchScrapeUrls>[1]);
        result = batchResult as unknown as Record<string, unknown>;
        break;
      }
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }

    // Mark completed and store result
    await db.jobQueue.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        result: result as unknown as import('../../../../.generated/prisma/client').Prisma.InputJsonValue,
      },
    });

    // Re-fetch the updated job for the handler
    const updatedJob = await db.jobQueue.findUniqueOrThrow({ where: { id: job.id } });
    await handleJobCompletion(updatedJob, result);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const errorMessage = error.message;

    console.error(`[JobQueue] Job ${job.id} failed (attempt ${job.attempts + 1}):`, errorMessage);

    // Determine if retryable
    const isRetryable = isRetryableError(errorMessage);
    const attemptsUsed = job.attempts + 1; // already incremented when claimed
    const canRetry = isRetryable && attemptsUsed < job.maxAttempts;

    if (canRetry) {
      // Exponential backoff: 1s, 4s, 16s
      const backoffMs = Math.pow(4, attemptsUsed - 1) * 1000;
      const nextRetryAt = new Date(Date.now() + backoffMs);

      await db.jobQueue.update({
        where: { id: job.id },
        data: {
          status: 'pending',
          nextRetryAt,
          error: errorMessage,
        },
      });

      console.log(`[JobQueue] Job ${job.id} scheduled for retry at ${nextRetryAt.toISOString()}`);
    } else {
      await db.jobQueue.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: errorMessage,
        },
      });

      const failedJob = await db.jobQueue.findUniqueOrThrow({ where: { id: job.id } });
      await handleJobFailure(failedJob, errorMessage);
    }

    // If 429, temporarily pause to respect rate limits
    if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit')) {
      console.warn('[JobQueue] Rate limit hit, pausing for 10s');
      // Clear recent timestamps to slow down
      requestTimestamps.length = 0;
      // Fill with fake timestamps to block new requests for ~10s
      const now = Date.now();
      for (let i = 0; i < MAX_PER_MINUTE; i++) {
        requestTimestamps.push(now - 50000 + i); // expire over next 10s
      }
    }
  }
}

function isRetryableError(message: string): boolean {
  // 408 Timeout, 429 Rate Limited, 5xx Server Errors
  if (message.includes('408') || message.includes('timed out')) return true;
  if (message.includes('429') || message.toLowerCase().includes('rate limit')) return true;
  if (/status code: 5\d\d/.test(message)) return true;
  if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) return true;
  if (message.includes('ETIMEDOUT') || message.includes('ECONNRESET')) return true;
  return false;
}
