import { db } from '@/lib/db';
import type { JobQueue } from '../types';
import { enqueueJob } from '../enqueue';
import { matchesIgnorePattern } from '../../grants/discovery';
import { scoreUrlRelevance } from '../../grants/url-scoring';

export async function handleDiscoveryComplete(job: JobQueue, result: Record<string, unknown>) {
  if (!job.sourceId) return;

  const provider = await db.grantProvider.findUnique({ where: { id: job.sourceId } });
  if (!provider) return;

  const mapLinks = (result.links as string[]) || [];
  const isMapJob = job.type === 'map';

  if (isMapJob && (!result.success || mapLinks.length === 0)) {
    await db.grantProvider.update({
      where: { id: job.sourceId },
      data: { status: 'error' },
    });
    return;
  }

  if (isMapJob) {
    // Store all discovered URLs
    const allUrls = [...new Set(mapLinks)];

    for (const url of allUrls) {
      try {
        const ignored = matchesIgnorePattern(url, provider.ignorePatterns);
        const relevanceScore = scoreUrlRelevance(url);
        await db.discoveredPage.upsert({
          where: { providerId_url: { providerId: provider.id, url } },
          create: {
            providerId: provider.id,
            url,
            classificationStatus: ignored ? 'confirmed_not_grant' : 'pending',
            urlRelevanceScore: relevanceScore,
          },
          update: {},
        });
      } catch (err) {
        console.error(`[DiscoveryHandler] Failed to store page ${url}:`, err);
      }
    }

    // Now enqueue listing URL scrapes if there are known listing URLs
    if (provider.knownListingUrls.length > 0) {
      for (const listingUrl of provider.knownListingUrls) {
        await enqueueJob({
          userId: job.userId,
          type: 'scrape',
          url: listingUrl,
          options: { formats: ['links'] },
          sourceType: 'discovery_listing',
          sourceId: provider.id,
          priority: 5,
        });
      }
    } else {
      // No listings to scrape, finalize
      await finalizeDiscovery(provider.id, allUrls.length);
    }
  }
}

export async function handleDiscoveryListingComplete(job: JobQueue, result: Record<string, unknown>) {
  if (!job.sourceId) return;

  const provider = await db.grantProvider.findUnique({ where: { id: job.sourceId } });
  if (!provider) return;

  // Extract links from listing page
  const links = (result.links as string[]) || [];

  for (const url of links) {
    try {
      const ignored = matchesIgnorePattern(url, provider.ignorePatterns);
      const relevanceScore = scoreUrlRelevance(url);
      await db.discoveredPage.upsert({
        where: { providerId_url: { providerId: provider.id, url } },
        create: {
          providerId: provider.id,
          url,
          classificationStatus: ignored ? 'confirmed_not_grant' : 'pending',
          urlRelevanceScore: relevanceScore,
        },
        update: {},
      });
    } catch {
      // Ignore duplicates
    }
  }

  // Check if all listing jobs for this provider are done
  const pendingListingJobs = await db.jobQueue.count({
    where: {
      sourceType: 'discovery_listing',
      sourceId: provider.id,
      status: { in: ['pending', 'running'] },
    },
  });

  if (pendingListingJobs === 0) {
    const totalPages = await db.discoveredPage.count({ where: { providerId: provider.id } });
    await finalizeDiscovery(provider.id, totalPages);
  }
}

async function finalizeDiscovery(providerId: string, totalUrls: number) {
  await db.grantProvider.update({
    where: { id: providerId },
    data: {
      status: 'active',
      lastDiscoveryAt: new Date(),
      totalPagesFound: totalUrls,
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function handleDiscoveryFailure(job: JobQueue, _error: string) {
  if (!job.sourceId) return;

  // Only mark provider as error if it's the main map job
  if (job.type === 'map') {
    await db.grantProvider.update({
      where: { id: job.sourceId },
      data: { status: 'error' },
    });
  }
}
