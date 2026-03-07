import { db } from '@/lib/db';
import { EXTRACTION_SYSTEM_PROMPT } from './prompts';
import { FIRECRAWL_GRANT_EXTRACT_SCHEMA } from './schemas';

const FREQUENCY_MS: Record<string, number> = {
  weekly: 7 * 24 * 60 * 60 * 1000,
  biweekly: 14 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

/**
 * Check all grants that are due for monitoring based on provider checkFrequency.
 * Uses batchScrapeUrls with changeTracking.
 */
export async function checkGrantsForUpdates() {
  const now = new Date();

  // Find providers with active grants due for check
  const providers = await db.grantProvider.findMany({
    where: { status: 'active' },
    include: {
      grantSchemes: {
        where: { isArchived: false },
        select: { id: true, sourceUrl: true, name: true, providerName: true },
      },
    },
  });

  for (const provider of providers) {
    // Check if due based on frequency
    const intervalMs = FREQUENCY_MS[provider.checkFrequency] || FREQUENCY_MS.weekly;
    const lastCheck = provider.lastDiscoveryAt;

    if (lastCheck && (now.getTime() - lastCheck.getTime()) < intervalMs) {
      continue;
    }

    if (provider.grantSchemes.length === 0) continue;

    try {
      await checkProviderGrants(provider.id, provider.userId, provider.grantSchemes);
    } catch (error) {
      console.error(`Failed to check grants for provider ${provider.name}:`, error);
    }
  }
}

/**
 * Check a single provider's grants for updates by enqueuing batch_scrape jobs.
 */
async function checkProviderGrants(
  providerId: string,
  userId: string,
  grants: Array<{ id: string; sourceUrl: string; name: string; providerName: string }>
) {
  const { enqueueJob } = await import('@/lib/services/job-queue');

  // Process in batches of 10 (same as before, but enqueued)
  const BATCH_SIZE = 10;
  for (let i = 0; i < grants.length; i += BATCH_SIZE) {
    const batchGrants = grants.slice(i, i + BATCH_SIZE);
    const batchUrls = batchGrants.map(g => g.sourceUrl);

    await enqueueJob({
      userId,
      type: 'batch_scrape',
      urls: batchUrls,
      options: {
        formats: ['markdown', 'extract', 'changeTracking'],
        extract: {
          schema: FIRECRAWL_GRANT_EXTRACT_SCHEMA,
          systemPrompt: EXTRACTION_SYSTEM_PROMPT,
        },
        changeTrackingOptions: { modes: ['git-diff'] },
        // Store grant metadata for the handler
        grants: batchGrants,
      },
      sourceType: 'monitoring',
      sourceId: providerId,
      priority: 10, // Background cron
    });
  }
}

/**
 * Re-discover a provider's domain to find new pages.
 */
export async function rediscoverProviderDomain(providerId: string, userId: string) {
  const { discoverGrantPages } = await import('./discovery');
  return discoverGrantPages(providerId, userId);
}
