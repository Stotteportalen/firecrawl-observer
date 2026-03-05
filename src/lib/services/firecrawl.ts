import FirecrawlApp from '@mendable/firecrawl-js';
import { db } from '@/lib/db';
import type { Prisma } from '../../../.generated/prisma/client';
import {
  storeScrapeResult,
  createChangeAlert,
  createCheckingStatus,
  updateLastChecked,
  getWebsite,
} from './websites';
import { analyzeChange } from './ai-analysis';
import { sendWebhookNotification, sendEmailNotification } from './notifications';
import { getUserSettingsInternal } from './user-settings';
import { getEmailConfigInternal } from './email-config';
import { scrapeWithJina } from './jina';
import { scrapeWithExa } from './exa';
import { computeMarkdownDiff } from './diff';

export async function getFirecrawlClient(userId: string): Promise<FirecrawlApp> {
  // Try to get user's API key
  const userKey = await db.fcoFirecrawlApiKey.findUnique({ where: { userId } });

  if (userKey) {
    // Update last used
    await db.fcoFirecrawlApiKey.update({
      where: { id: userKey.id },
      data: { lastUsed: new Date() },
    });
    return new FirecrawlApp({ apiKey: userKey.encryptedKey });
  }

  // Fallback to environment variable
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error('No Firecrawl API key found. Please add your API key in settings.');
  }
  return new FirecrawlApp({ apiKey });
}

export async function scrapeUrl(websiteId: string, url: string, userId: string) {
  const firecrawl = await getFirecrawlClient(userId);

  try {
    const result = await firecrawl.scrapeUrl(url, {
      formats: ['markdown', 'changeTracking'],
      changeTrackingOptions: {
        modes: ['git-diff'],
      },
    }) as unknown as Record<string, unknown>;

    if (!result.success) {
      throw new Error(`Firecrawl scrape failed: ${result.error}`);
    }

    const markdown = (result?.markdown as string) || '';
    const changeTracking = result?.changeTracking as Record<string, unknown> | undefined;
    const metadata = result?.metadata as Record<string, unknown> | undefined;

    const diff = changeTracking?.diff as Record<string, unknown> | undefined;

    if (changeTracking?.changeStatus === 'changed') {
      console.log(`Change detected for ${url}: ${changeTracking.changeStatus}`);
    }

    const scrapeResult = await storeScrapeResult({
      websiteId,
      userId,
      markdown,
      changeStatus: (changeTracking?.changeStatus as string) || 'new',
      visibility: (changeTracking?.visibility as string) || 'visible',
      previousScrapeAt: changeTracking?.previousScrapeAt
        ? new Date(changeTracking.previousScrapeAt as string)
        : undefined,
      scrapedAt: new Date(),
      firecrawlMetadata: metadata as Prisma.InputJsonValue | undefined,
      ogImage: (metadata?.ogImage as string) || undefined,
      title: (metadata?.title as string) || undefined,
      description: (metadata?.description as string) || undefined,
      url,
      diffText: (diff?.text as string) || undefined,
      diffJson: (diff?.json as Prisma.InputJsonValue) || undefined,
    });

    // If content changed, create alert and send notifications
    if (changeTracking?.changeStatus === 'changed' || diff) {
      const diffText = diff?.text as string | undefined;
      const diffPreview = diffText
        ? diffText.substring(0, 200) + (diffText.length > 200 ? '...' : '')
        : 'Website content has changed since last check';

      await createChangeAlert({
        websiteId,
        userId,
        scrapeResultId: scrapeResult.id,
        changeType: 'content_changed',
        summary: diffPreview,
      });

      // Trigger AI analysis if enabled and there's a diff
      if (diff) {
        // Fire and forget — don't block on AI analysis
        analyzeChange({
          userId,
          scrapeResultId: scrapeResult.id,
          websiteName: (metadata?.title as string) || url,
          websiteUrl: url,
          diff: diff as { text: string; json: unknown },
        }).catch(err => console.error('AI analysis error:', err));
      }

      const userSettings = await getUserSettingsInternal(userId);

      // If AI analysis is NOT enabled, send notifications immediately
      if (!userSettings?.aiAnalysisEnabled || !diff) {
        const website = await getWebsite(websiteId, userId);

        if (website && website.notificationPreference !== 'none') {
          // Send webhook
          if ((website.notificationPreference === 'webhook' || website.notificationPreference === 'both') && website.webhookUrl) {
            sendWebhookNotification({
              webhookUrl: website.webhookUrl,
              websiteId,
              websiteName: website.name,
              websiteUrl: url,
              scrapeResultId: scrapeResult.id,
              changeType: 'content_changed',
              changeStatus: (changeTracking?.changeStatus as string) || 'changed',
              diff: diff as { text: string; json: unknown } | undefined,
              title: metadata?.title as string | undefined,
              description: metadata?.description as string | undefined,
              markdown,
              scrapedAt: new Date(),
            }).catch(err => console.error('Webhook error:', err));
          }

          // Send email
          if (website.notificationPreference === 'email' || website.notificationPreference === 'both') {
            const emailConfig = await getEmailConfigInternal(userId);
            if (emailConfig?.email && emailConfig.isVerified) {
              sendEmailNotification({
                email: emailConfig.email,
                websiteName: website.name,
                websiteUrl: url,
                changeType: 'content_changed',
                changeStatus: (changeTracking?.changeStatus as string) || 'changed',
                diff: diff as { text: string; json: unknown } | undefined,
                title: metadata?.title as string | undefined,
                scrapedAt: new Date(),
                userId,
              }).catch(err => console.error('Email error:', err));
            }
          }
        }
      }
    }

    return {
      success: true,
      scrapeResultId: scrapeResult.id,
      changeStatus: changeTracking?.changeStatus as string | undefined,
      visibility: changeTracking?.visibility as string | undefined,
      previousScrapeAt: changeTracking?.previousScrapeAt as string | undefined,
    };
  } catch (error) {
    console.error('Firecrawl scrape error:', error);
    throw error;
  }
}

export async function scrapeWithProvider(
  websiteId: string,
  url: string,
  userId: string,
  provider: string
) {
  // Firecrawl uses its own built-in change tracking
  if (provider === 'firecrawl') {
    return scrapeUrl(websiteId, url, userId);
  }

  // Jina / Exa: scrape, compute diff against previous result, run same alert pipeline
  const rawResult =
    provider === 'exa'
      ? await scrapeWithExa(url)
      : await scrapeWithJina(url);

  // Fetch the most recent non-checking scrape for this website
  const previousScrape = await db.fcoScrapeResult.findFirst({
    where: { websiteId, changeStatus: { not: 'checking' } },
    orderBy: { scrapedAt: 'desc' },
  });

  const { changeStatus, diffText } = computeMarkdownDiff(
    previousScrape?.markdown,
    rawResult.content
  );

  const scrapeResult = await storeScrapeResult({
    websiteId,
    userId,
    markdown: rawResult.content,
    changeStatus,
    visibility: 'visible',
    previousScrapeAt: previousScrape?.scrapedAt ?? undefined,
    scrapedAt: new Date(),
    title: rawResult.title || undefined,
    description: rawResult.description || undefined,
    url,
    diffText: diffText ?? undefined,
  });

  // If content changed, create alert and send notifications (same flow as Firecrawl)
  if (changeStatus === 'changed' && diffText) {
    const diffPreview =
      diffText.substring(0, 200) + (diffText.length > 200 ? '...' : '');

    await createChangeAlert({
      websiteId,
      userId,
      scrapeResultId: scrapeResult.id,
      changeType: 'content_changed',
      summary: diffPreview,
    });

    // Trigger AI analysis
    analyzeChange({
      userId,
      scrapeResultId: scrapeResult.id,
      websiteName: rawResult.title || url,
      websiteUrl: url,
      diff: { text: diffText, json: null },
    }).catch(err => console.error('AI analysis error:', err));

    const userSettings = await getUserSettingsInternal(userId);

    if (!userSettings?.aiAnalysisEnabled) {
      const website = await getWebsite(websiteId, userId);

      if (website && website.notificationPreference !== 'none') {
        if (
          (website.notificationPreference === 'webhook' ||
            website.notificationPreference === 'both') &&
          website.webhookUrl
        ) {
          sendWebhookNotification({
            webhookUrl: website.webhookUrl,
            websiteId,
            websiteName: website.name,
            websiteUrl: url,
            scrapeResultId: scrapeResult.id,
            changeType: 'content_changed',
            changeStatus,
            diff: { text: diffText, json: null },
            title: rawResult.title || undefined,
            description: rawResult.description || undefined,
            markdown: rawResult.content,
            scrapedAt: new Date(),
          }).catch(err => console.error('Webhook error:', err));
        }

        if (
          website.notificationPreference === 'email' ||
          website.notificationPreference === 'both'
        ) {
          const emailConfig = await getEmailConfigInternal(userId);
          if (emailConfig?.email && emailConfig.isVerified) {
            sendEmailNotification({
              email: emailConfig.email,
              websiteName: website.name,
              websiteUrl: url,
              changeType: 'content_changed',
              changeStatus,
              diff: { text: diffText, json: null },
              title: rawResult.title || undefined,
              scrapedAt: new Date(),
              userId,
            }).catch(err => console.error('Email error:', err));
          }
        }
      }
    }
  }

  return {
    success: true,
    scrapeResultId: scrapeResult.id,
    changeStatus,
  };
}

export async function triggerScrape(websiteId: string, userId: string) {
  const website = await getWebsite(websiteId, userId);
  if (!website) throw new Error('Website not found');

  // Create immediate checking status entry
  await createCheckingStatus(websiteId, userId);
  await updateLastChecked(websiteId);

  const provider = (website as Record<string, unknown>).scrapeProvider as string || 'firecrawl';

  if (website.monitorType === 'full_site' && provider === 'firecrawl') {
    // Import dynamically to avoid circular dependency
    const { performCrawl } = await import('./crawl');
    // Fire and forget
    performCrawl(websiteId, userId).catch(err =>
      console.error('Crawl error:', err)
    );
  } else if (website.monitorType === 'full_site') {
    // Jina/Exa don't support crawling — fall back to single-page scrape
    console.warn(`Full-site crawl not supported for provider "${provider}", falling back to single-page scrape`);
    scrapeWithProvider(websiteId, website.url, userId, provider).catch(err =>
      console.error('Scrape error:', err)
    );
  } else {
    // Single page: dispatch to provider-aware function
    scrapeWithProvider(websiteId, website.url, userId, provider).catch(err =>
      console.error('Scrape error:', err)
    );
  }

  return { success: true };
}
