import type { QuickScrapeResult } from './quick-scrape';

interface JinaResponse {
  data: {
    title: string;
    description: string;
    url: string;
    content: string;
  };
}

export async function scrapeWithJina(url: string): Promise<QuickScrapeResult> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Engine': 'cf-browser-rendering',
    'X-Return-Format': 'markdown',
    'X-Retain-Images': 'none',
  };

  const apiKey = process.env.JINA_API_KEY;
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(`https://r.jina.ai/${url}`, { headers });

  if (!response.ok) {
    throw new Error(`Jina scrape failed: ${response.status} ${response.statusText}`);
  }

  const json: JinaResponse = await response.json();

  return {
    provider: 'jina',
    url: json.data.url || url,
    title: json.data.title || '',
    description: json.data.description || '',
    content: json.data.content || '',
    scrapedAt: new Date().toISOString(),
  };
}
