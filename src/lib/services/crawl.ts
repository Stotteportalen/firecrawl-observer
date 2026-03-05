import { db } from '@/lib/db';
import type { Prisma } from '../../../.generated/prisma/client';
import { getFirecrawlClient } from './firecrawl';
import { storeScrapeResult, createChangeAlert, updateLastChecked, getWebsite } from './websites';

export async function createCrawlSession(websiteId: string, userId: string) {
  return db.fcoCrawlSession.create({
    data: {
      websiteId,
      userId,
      status: 'running',
      pagesFound: 0,
    },
  });
}

export async function completeCrawlSession(sessionId: string, pagesFound: number, websiteId: string) {
  await db.fcoCrawlSession.update({
    where: { id: sessionId },
    data: {
      completedAt: new Date(),
      status: 'completed',
      pagesFound,
    },
  });

  await db.fcoWebsite.update({
    where: { id: websiteId },
    data: {
      totalPages: pagesFound,
      lastCrawlAt: new Date(),
      lastChecked: new Date(),
    },
  });
}

export async function failCrawlSession(sessionId: string, error: string) {
  await db.fcoCrawlSession.update({
    where: { id: sessionId },
    data: {
      completedAt: new Date(),
      status: 'failed',
      error,
    },
  });
}

interface CrawlPage {
  url?: string;
  markdown?: string;
  metadata?: Record<string, unknown>;
  changeTracking?: {
    changeStatus?: string;
    visibility?: string;
    previousScrapeAt?: string;
    diff?: { text?: string; json?: unknown };
  };
}

async function processCrawlPages(
  pages: CrawlPage[],
  websiteId: string,
  userId: string,
) {
  for (const page of pages) {
    const pageUrl = page.url || (page.metadata?.url as string | undefined);
    if (!pageUrl || !page.markdown) continue;

    const scrapeResult = await storeScrapeResult({
      websiteId,
      userId,
      markdown: page.markdown,
      changeStatus: page.changeTracking?.changeStatus || 'new',
      visibility: page.changeTracking?.visibility || 'visible',
      previousScrapeAt: page.changeTracking?.previousScrapeAt
        ? new Date(page.changeTracking.previousScrapeAt)
        : undefined,
      scrapedAt: new Date(),
      firecrawlMetadata: page.metadata as Prisma.InputJsonValue | undefined,
      ogImage: page.metadata?.ogImage as string | undefined,
      title: page.metadata?.title as string | undefined,
      description: page.metadata?.description as string | undefined,
      url: pageUrl,
      diffText: page.changeTracking?.diff?.text || undefined,
      diffJson: (page.changeTracking?.diff?.json as Prisma.InputJsonValue) || undefined,
    });

    if (page.changeTracking?.changeStatus === 'changed' && page.changeTracking?.diff) {
      await createChangeAlert({
        websiteId,
        userId,
        scrapeResultId: scrapeResult.id,
        changeType: 'content_changed',
        summary: (page.changeTracking.diff.text?.substring(0, 200) + '...') || 'Page content changed',
      });
    }
  }
}

async function pollCrawlJobStatus(
  firecrawl: { checkCrawlStatus: (jobId: string) => Promise<unknown> },
  jobId: string,
  sessionId: string,
  websiteId: string,
  userId: string,
) {
  const MAX_ATTEMPTS = 60; // 10 minutes max
  const POLL_INTERVAL_MS = 10000;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`Checking crawl job status: ${jobId} (attempt ${attempt})`);

    try {
      const status = await firecrawl.checkCrawlStatus(jobId) as Record<string, unknown>;

      if (status.status === 'completed' && status.data) {
        const pages = status.data as CrawlPage[];
        console.log(`Crawl completed with ${pages.length} pages`);
        await processCrawlPages(pages, websiteId, userId);
        await completeCrawlSession(sessionId, pages.length, websiteId);
        return { success: true, pagesFound: pages.length };
      } else if (status.status === 'failed' || status.status === 'error') {
        throw new Error(`Crawl job failed: ${status.error || 'Unknown error'}`);
      }

      // Still in progress — wait before polling again
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    } catch (error) {
      await failCrawlSession(sessionId, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  await failCrawlSession(sessionId, 'Crawl job timed out after 10 minutes');
  throw new Error('Crawl job timed out after 10 minutes');
}

export async function performCrawl(websiteId: string, userId: string) {
  const website = await getWebsite(websiteId, userId);
  if (!website || website.monitorType !== 'full_site') {
    throw new Error('Website not found or not a full site monitor');
  }

  await updateLastChecked(websiteId);

  const session = await createCrawlSession(websiteId, userId);

  try {
    const firecrawl = await getFirecrawlClient(userId);

    const crawlResponse = await firecrawl.crawlUrl(website.url, {
      limit: website.crawlLimit || 10,
      maxDepth: website.crawlDepth || 3,
      scrapeOptions: {
        formats: ['markdown', 'changeTracking'],
      },
    }) as unknown as Record<string, unknown>;

    // Check if async job
    if (crawlResponse.jobId || crawlResponse.id) {
      const jobId = (crawlResponse.jobId || crawlResponse.id) as string;
      console.log(`Crawl started with job ID: ${jobId}`);

      await db.fcoCrawlSession.update({
        where: { id: session.id },
        data: { jobId },
      });

      return pollCrawlJobStatus(firecrawl, jobId, session.id, websiteId, userId);
    }

    // Synchronous result
    if (!crawlResponse.success) {
      throw new Error(`Firecrawl crawl failed: ${crawlResponse.error}`);
    }

    const pages = (crawlResponse.data || []) as CrawlPage[];
    await processCrawlPages(pages, websiteId, userId);
    await completeCrawlSession(session.id, pages.length, websiteId);

    return { success: true, pagesFound: pages.length };
  } catch (error) {
    await failCrawlSession(session.id, error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}
