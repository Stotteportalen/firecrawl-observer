import type { JobQueue } from '../types';

/**
 * General scrape handler — results are stored in the job's `result` field.
 * The caller (firecrawl.ts scrapeUrl/scrapeWithProvider) reads results from the job.
 * This handler is intentionally minimal since the website scraping pipeline
 * has complex notification/alert logic that stays in firecrawl.ts.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function handleScrapeComplete(_job: JobQueue, _result: Record<string, unknown>) {
  // Website scraping results are processed by the calling function
  // which polls for job completion. No additional handling needed here.
}
