import Exa from 'exa-js';
import type { QuickScrapeResult } from './quick-scrape';

export async function scrapeWithExa(url: string): Promise<QuickScrapeResult> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    throw new Error('EXA_API_KEY is not set. Add it to your .env.local to use the Exa provider.');
  }

  const exa = new Exa(apiKey);
  const result = await exa.getContents([url], {
    text: { maxCharacters: 15000 },
  });

  const page = result.results[0];
  if (!page) {
    throw new Error('Exa returned no results for this URL.');
  }

  return {
    provider: 'exa',
    url: page.url || url,
    title: page.title || '',
    description: '',
    content: page.text || '',
    scrapedAt: new Date().toISOString(),
  };
}
