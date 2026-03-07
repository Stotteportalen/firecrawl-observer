import type { JobQueue } from '../types';

/**
 * Crawl handler — crawl jobs return async job IDs that need polling.
 * The crawl pipeline (crawl.ts) handles its own polling via checkCrawlStatus.
 * This handler is intentionally minimal.
 */
export async function handleCrawlComplete(_job: JobQueue, _result: Record<string, unknown>) {
  // Crawl results are processed by crawl.ts which handles polling and page processing.
}
