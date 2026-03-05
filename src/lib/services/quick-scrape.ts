import { getFirecrawlClient } from './firecrawl';
import { scrapeWithJina } from './jina';
import { scrapeWithExa } from './exa';

export type ScrapeProvider = 'firecrawl' | 'jina' | 'exa';

export interface QuickScrapeResult {
  provider: ScrapeProvider;
  url: string;
  title: string;
  description: string;
  content: string;
  scrapedAt: string;
}

async function scrapeWithFirecrawl(url: string, userId: string): Promise<QuickScrapeResult> {
  const firecrawl = await getFirecrawlClient(userId);

  const result = (await firecrawl.scrapeUrl(url, {
    formats: ['markdown'],
  })) as unknown as Record<string, unknown>;

  if (!result.success) {
    throw new Error(`Firecrawl scrape failed: ${result.error}`);
  }

  const metadata = result.metadata as Record<string, unknown> | undefined;

  return {
    provider: 'firecrawl',
    url,
    title: (metadata?.title as string) || '',
    description: (metadata?.description as string) || '',
    content: (result.markdown as string) || '',
    scrapedAt: new Date().toISOString(),
  };
}

export async function quickScrape(
  url: string,
  provider: ScrapeProvider,
  userId: string,
): Promise<QuickScrapeResult> {
  switch (provider) {
    case 'jina':
      return scrapeWithJina(url);
    case 'exa':
      return scrapeWithExa(url);
    case 'firecrawl':
      return scrapeWithFirecrawl(url, userId);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
