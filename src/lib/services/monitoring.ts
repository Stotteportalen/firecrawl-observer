import { db } from '@/lib/db';
import { scrapeWithProvider } from './firecrawl';
import { performCrawl } from './crawl';

export async function getWebsitesToCheck() {
  const now = new Date();

  const activeWebsites = await db.fcoWebsite.findMany({
    where: { isActive: true },
  });

  return activeWebsites.filter((website) => {
    if (website.isPaused) return false;
    if (!website.lastChecked) return true;

    const timeSinceLastCheck = now.getTime() - website.lastChecked.getTime();
    const intervalInMs = website.checkInterval * 60 * 1000;

    return timeSinceLastCheck >= intervalInMs;
  });
}

export async function checkActiveWebsites() {
  const websites = await getWebsitesToCheck();

  if (websites.length > 0) {
    console.log(`Checking ${websites.length} websites`);
  }

  for (const website of websites) {
    try {
      const provider = website.scrapeProvider || 'firecrawl';

      if (website.monitorType === 'full_site' && provider === 'firecrawl') {
        performCrawl(website.id, website.userId).catch(err =>
          console.error(`Failed crawl for ${website.url}:`, err)
        );
      } else if (website.monitorType === 'full_site') {
        // Jina/Exa don't support crawling — fall back to single-page scrape
        console.warn(`Full-site crawl not supported for provider "${provider}", falling back to single-page scrape for ${website.url}`);
        scrapeWithProvider(website.id, website.url, website.userId, provider).catch(err =>
          console.error(`Failed scrape for ${website.url}:`, err)
        );
      } else {
        scrapeWithProvider(website.id, website.url, website.userId, provider).catch(err =>
          console.error(`Failed scrape for ${website.url}:`, err)
        );
      }
    } catch (error) {
      console.error(`Failed to schedule check for ${website.url}:`, error);
    }
  }
}
