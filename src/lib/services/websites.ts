import { db } from '@/lib/db';
import type { Prisma } from '../../../.generated/prisma/client';

export async function getUserWebsites(userId: string) {
  return db.fcoWebsite.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getWebsite(websiteId: string, userId: string) {
  const website = await db.fcoWebsite.findUnique({ where: { id: websiteId } });
  if (!website || website.userId !== userId) return null;
  return website;
}

export async function createWebsite(userId: string, data: {
  url: string;
  name: string;
  checkInterval: number;
  notificationPreference?: string;
  webhookUrl?: string;
  monitorType?: string;
  crawlLimit?: number;
  crawlDepth?: number;
  scrapeProvider?: string;
}) {
  // Get user settings for default webhook
  let webhookUrl = data.webhookUrl;
  if (!webhookUrl && data.notificationPreference && ['webhook', 'both'].includes(data.notificationPreference)) {
    const userSettings = await db.fcoUserSettings.findUnique({ where: { userId } });
    if (userSettings?.defaultWebhookUrl) {
      webhookUrl = userSettings.defaultWebhookUrl;
    }
  }

  return db.fcoWebsite.create({
    data: {
      url: data.url,
      name: data.name,
      userId,
      isActive: true,
      checkInterval: data.checkInterval,
      notificationPreference: data.notificationPreference || 'none',
      webhookUrl,
      monitorType: data.monitorType || 'single_page',
      scrapeProvider: data.scrapeProvider || 'firecrawl',
      crawlLimit: data.crawlLimit,
      crawlDepth: data.crawlDepth,
    },
  });
}

export async function updateWebsite(websiteId: string, userId: string, data: {
  notificationPreference?: string;
  webhookUrl?: string;
  checkInterval?: number;
  monitorType?: string;
  crawlLimit?: number;
  crawlDepth?: number;
  scrapeProvider?: string;
}) {
  const website = await db.fcoWebsite.findUnique({ where: { id: websiteId } });
  if (!website || website.userId !== userId) throw new Error('Website not found');

  return db.fcoWebsite.update({
    where: { id: websiteId },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });
}

export async function deleteWebsite(websiteId: string, userId: string) {
  const website = await db.fcoWebsite.findUnique({ where: { id: websiteId } });
  if (!website || website.userId !== userId) throw new Error('Website not found');

  // Cascade delete handles related data (scrapeResults, changeAlerts, crawlSessions)
  await db.fcoWebsite.delete({ where: { id: websiteId } });
}

export async function pauseWebsite(websiteId: string, userId: string, isPaused: boolean) {
  const website = await db.fcoWebsite.findUnique({ where: { id: websiteId } });
  if (!website || website.userId !== userId) throw new Error('Website not found');

  await db.fcoWebsite.update({
    where: { id: websiteId },
    data: { isPaused, updatedAt: new Date() },
  });
  return isPaused;
}

export async function toggleWebsiteActive(websiteId: string, userId: string) {
  const website = await db.fcoWebsite.findUnique({ where: { id: websiteId } });
  if (!website || website.userId !== userId) throw new Error('Website not found');

  await db.fcoWebsite.update({
    where: { id: websiteId },
    data: { isActive: !website.isActive, updatedAt: new Date() },
  });
  return !website.isActive;
}

export async function updateLastChecked(websiteId: string) {
  await db.fcoWebsite.update({
    where: { id: websiteId },
    data: { lastChecked: new Date(), updatedAt: new Date() },
  });
}

// Scrape results

export async function removeCheckingStatus(websiteId: string) {
  await db.fcoScrapeResult.deleteMany({
    where: { websiteId, changeStatus: 'checking' },
  });
}

export async function createCheckingStatus(websiteId: string, userId: string) {
  return db.fcoScrapeResult.create({
    data: {
      websiteId,
      userId,
      markdown: 'Checking for changes...',
      changeStatus: 'checking',
      visibility: 'visible',
      scrapedAt: new Date(),
    },
  });
}

export async function storeScrapeResult(data: {
  websiteId: string;
  userId: string;
  markdown: string;
  changeStatus: string;
  visibility: string;
  previousScrapeAt?: Date;
  scrapedAt: Date;
  firecrawlMetadata?: Prisma.InputJsonValue;
  ogImage?: string;
  title?: string;
  description?: string;
  url?: string;
  diffText?: string;
  diffJson?: Prisma.InputJsonValue;
}) {
  // Remove any checking status entries first
  await removeCheckingStatus(data.websiteId);

  const scrapeResult = await db.fcoScrapeResult.create({ data });

  // Update website last checked time
  await db.fcoWebsite.update({
    where: { id: data.websiteId },
    data: { lastChecked: data.scrapedAt, updatedAt: new Date() },
  });

  return scrapeResult;
}

export async function updateScrapeResultAIAnalysis(scrapeResultId: string, analysis: {
  meaningfulChangeScore: number;
  isMeaningfulChange: boolean;
  reasoning: string;
  analyzedAt: Date;
  model: string;
}) {
  await db.fcoScrapeResult.update({
    where: { id: scrapeResultId },
    data: {
      aiMeaningfulChangeScore: analysis.meaningfulChangeScore,
      aiIsMeaningfulChange: analysis.isMeaningfulChange,
      aiReasoning: analysis.reasoning,
      aiAnalyzedAt: analysis.analyzedAt,
      aiModel: analysis.model,
    },
  });
}

export async function getScrapeResult(scrapeResultId: string) {
  return db.fcoScrapeResult.findUnique({ where: { id: scrapeResultId } });
}

// Change alerts

export async function createChangeAlert(data: {
  websiteId: string;
  userId: string;
  scrapeResultId: string;
  changeType: string;
  summary: string;
}) {
  await db.fcoChangeAlert.create({
    data: {
      ...data,
      isRead: false,
    },
  });
}

export async function getUnreadAlerts(userId: string) {
  const alerts = await db.fcoChangeAlert.findMany({
    where: { userId, isRead: false },
    include: { website: { select: { name: true, url: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return alerts.map(alert => ({
    ...alert,
    websiteName: alert.website.name,
    websiteUrl: alert.website.url,
  }));
}

export async function markAlertAsRead(alertId: string, userId: string) {
  const alert = await db.fcoChangeAlert.findUnique({ where: { id: alertId } });
  if (!alert || alert.userId !== userId) throw new Error('Alert not found');

  await db.fcoChangeAlert.update({
    where: { id: alertId },
    data: { isRead: true },
  });
}

// Scrape history

export async function getWebsiteScrapeHistory(websiteId: string, userId: string, limit = 10) {
  const website = await db.fcoWebsite.findUnique({ where: { id: websiteId } });
  if (!website || website.userId !== userId) return [];

  return db.fcoScrapeResult.findMany({
    where: { websiteId },
    orderBy: { scrapedAt: 'desc' },
    take: limit,
  });
}

export async function getAllScrapeHistory(userId: string) {
  const websites = await db.fcoWebsite.findMany({
    where: { userId },
  });
  const websiteMap = new Map(websites.map(w => [w.id, w]));

  const allScrapes = await db.fcoScrapeResult.findMany({
    where: { userId },
    orderBy: { scrapedAt: 'desc' },
    take: 100,
  });

  // Group scrapes by website
  const scrapesByWebsite = new Map<string, typeof allScrapes>();
  for (const scrape of allScrapes) {
    if (!scrapesByWebsite.has(scrape.websiteId)) {
      scrapesByWebsite.set(scrape.websiteId, []);
    }
    scrapesByWebsite.get(scrape.websiteId)!.push(scrape);
  }

  return allScrapes.map((scrape) => {
    const websiteScrapes = scrapesByWebsite.get(scrape.websiteId) || [];
    const scrapeIndex = websiteScrapes.findIndex(s => s.id === scrape.id);
    const isFirstScrape = scrapeIndex === websiteScrapes.length - 1;

    return {
      ...scrape,
      websiteName: websiteMap.get(scrape.websiteId)?.name || 'Unknown',
      websiteUrl: scrape.url || websiteMap.get(scrape.websiteId)?.url || '',
      isFirstScrape,
      scrapeNumber: websiteScrapes.length - scrapeIndex,
      totalScrapes: websiteScrapes.length,
    };
  });
}

export async function getLatestScrapeForWebsites(userId: string) {
  const websites = await db.fcoWebsite.findMany({ where: { userId } });

  const latestScrapes: Record<string, unknown> = {};

  for (const website of websites) {
    const latestScrape = await db.fcoScrapeResult.findFirst({
      where: { websiteId: website.id },
      orderBy: { scrapedAt: 'desc' },
    });

    if (latestScrape) {
      latestScrapes[website.id] = latestScrape;
    }
  }

  return latestScrapes;
}
