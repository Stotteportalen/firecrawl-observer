import { db } from '@/lib/db';
import type { Prisma } from '../../../../.generated/prisma/client';
import { getFirecrawlClient } from '@/lib/services/firecrawl';
import { getUserSettingsInternal } from '@/lib/services/user-settings';
import { EXTRACTION_SYSTEM_PROMPT, CHANGE_ANALYSIS_SYSTEM_PROMPT, buildChangeAnalysisPrompt } from './prompts';
import { GrantExtractionSchema, ChangeAnalysisSchema, FIRECRAWL_GRANT_EXTRACT_SCHEMA } from './schemas';

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
 * Check a single provider's grants for updates using batchScrapeUrls.
 */
async function checkProviderGrants(
  providerId: string,
  userId: string,
  grants: Array<{ id: string; sourceUrl: string; name: string; providerName: string }>
) {
  const firecrawl = await getFirecrawlClient(userId);
  const urls = grants.map(g => g.sourceUrl);

  // Process in batches of 10
  const BATCH_SIZE = 10;
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batchUrls = urls.slice(i, i + BATCH_SIZE);
    const batchGrants = grants.slice(i, i + BATCH_SIZE);

    try {
      // No `actions` here — intentional. fullMarkdown was already populated with
      // accordion content during extraction (extractGrantData uses GRANT_SCRAPE_ACTIONS).
      // Monitoring focuses on change detection via headings/metadata, and skipping
      // actions preserves batch efficiency (~8s saved per URL).
      const result = await firecrawl.batchScrapeUrls(batchUrls, {
        formats: ['markdown', 'extract', 'changeTracking'],
        extract: {
          schema: FIRECRAWL_GRANT_EXTRACT_SCHEMA,
          systemPrompt: EXTRACTION_SYSTEM_PROMPT,
        },
        changeTrackingOptions: {
          modes: ['git-diff'],
        },
      }) as unknown as {
        success: boolean;
        data?: Array<{
          url?: string;
          markdown?: string;
          extract?: Record<string, unknown>;
          changeTracking?: {
            changeStatus?: string;
            diff?: { text?: string; json?: unknown };
          };
          metadata?: { statusCode?: number };
        }>;
      };

      if (!result.success || !result.data) {
        console.error(`Batch scrape failed for provider ${providerId}`);
        continue;
      }

      for (let j = 0; j < result.data.length; j++) {
        const scrapeResult = result.data[j];
        const grant = batchGrants[j];
        if (!grant) continue;

        await processGrantScrapeResult(grant, scrapeResult, userId);
      }
    } catch (error) {
      console.error(`Batch scrape error for provider ${providerId}:`, error);
    }

    // Small delay between batches
    if (i + BATCH_SIZE < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

async function processGrantScrapeResult(
  grant: { id: string; sourceUrl: string; name: string; providerName: string },
  scrapeResult: {
    url?: string;
    markdown?: string;
    extract?: Record<string, unknown>;
    changeTracking?: {
      changeStatus?: string;
      diff?: { text?: string; json?: unknown };
    };
    metadata?: { statusCode?: number };
  },
  userId: string
) {
  const changeStatus = scrapeResult.changeTracking?.changeStatus;

  // Handle removed/404 pages
  if (changeStatus === 'removed' || scrapeResult.metadata?.statusCode === 404) {
    await db.grantScheme.update({
      where: { id: grant.id },
      data: {
        isArchived: true,
        archivedReason: 'Page no longer available',
        lastScrapedAt: new Date(),
      },
    });

    await db.grantChangeEvent.create({
      data: {
        grantSchemeId: grant.id,
        changeType: 'grant_removed',
        summary: `Grant page "${grant.name}" is no longer available`,
      },
    });
    return;
  }

  // Update last scraped time
  const updateData: Prisma.GrantSchemeUpdateInput = {
    lastScrapedAt: new Date(),
  };

  // If content changed, process the changes
  if (changeStatus === 'changed' && scrapeResult.changeTracking?.diff) {
    const diffText = scrapeResult.changeTracking.diff.text || '';

    // Update with new extraction data
    if (scrapeResult.extract) {
      try {
        const extracted = GrantExtractionSchema.parse(scrapeResult.extract);

        let applicationDeadline: Date | null = null;
        if (extracted.applicationDeadline) {
          const parsed = new Date(extracted.applicationDeadline);
          if (!isNaN(parsed.getTime())) applicationDeadline = parsed;
        }

        updateData.name = extracted.name;
        updateData.providerName = extracted.providerName;
        updateData.summary = extracted.summary;
        updateData.status = extracted.status;
        updateData.fundingType = extracted.fundingType;
        updateData.applicationDeadline = applicationDeadline;
        updateData.isRollingDeadline = extracted.isRollingDeadline;
        updateData.ragContent = extracted.ragContent;
        updateData.extractedJson = scrapeResult.extract as Prisma.InputJsonValue;
        updateData.lastExtractedAt = new Date();
      } catch {
        console.error(`Extraction validation failed for ${grant.name}`);
      }
    }

    if (scrapeResult.markdown) {
      updateData.fullMarkdown = scrapeResult.markdown;
    }

    updateData.lastChangeAt = new Date();
    updateData.changeCount = { increment: 1 };

    // Analyze the change
    let changeSummary = `Content updated for "${grant.name}"`;
    let changeType = 'content_updated';

    try {
      const analysis = await analyzeChange(grant.name, diffText, userId);
      if (analysis) {
        changeSummary = analysis.summary;
        changeType = analysis.changeTypes[0] || 'content_updated';
      }
    } catch {
      // Use default summary
    }

    await db.grantChangeEvent.create({
      data: {
        grantSchemeId: grant.id,
        changeType,
        summary: changeSummary,
        diffText,
      },
    });
  }

  // Always update markdown if available and status is 'same'
  if (changeStatus === 'same' && scrapeResult.markdown) {
    // Don't overwrite on 'same' — just update timestamp
  }

  await db.grantScheme.update({
    where: { id: grant.id },
    data: updateData,
  });
}

async function analyzeChange(grantName: string, diffText: string, userId: string) {
  const userSettings = await getUserSettingsInternal(userId);
  if (!userSettings?.aiApiKey) return null;

  const baseUrl = (userSettings.aiBaseUrl as string) || 'https://api.openai.com/v1';
  const apiUrl = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userSettings.aiApiKey as string}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: userSettings.aiModel || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: CHANGE_ANALYSIS_SYSTEM_PROMPT },
          { role: 'user', content: buildChangeAnalysisPrompt(grantName, diffText) },
        ],
        temperature: 0.2,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    return ChangeAnalysisSchema.parse(parsed);
  } catch {
    return null;
  }
}

/**
 * Re-discover a provider's domain to find new pages.
 */
export async function rediscoverProviderDomain(providerId: string, userId: string) {
  const { discoverGrantPages } = await import('./discovery');
  return discoverGrantPages(providerId, userId);
}
