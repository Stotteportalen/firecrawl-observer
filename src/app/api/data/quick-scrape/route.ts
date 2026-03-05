import { NextRequest, NextResponse } from 'next/server';
import { requireSession, unauthorized, badRequest, serverError } from '@/lib/api-auth';
import { quickScrape, type ScrapeProvider } from '@/lib/services/quick-scrape';

const VALID_PROVIDERS: ScrapeProvider[] = ['firecrawl', 'jina', 'exa'];

export async function POST(request: NextRequest) {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const { url, provider } = body as { url?: string; provider?: string };

    if (!url || typeof url !== 'string') {
      return badRequest('URL is required');
    }

    try {
      new URL(url);
    } catch {
      return badRequest('Invalid URL format');
    }

    if (!provider || !VALID_PROVIDERS.includes(provider as ScrapeProvider)) {
      return badRequest(`Provider must be one of: ${VALID_PROVIDERS.join(', ')}`);
    }

    const result = await quickScrape(url, provider as ScrapeProvider, user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/data/quick-scrape error:', error);
    const message = error instanceof Error ? error.message : 'Scrape failed';
    return serverError(message);
  }
}
