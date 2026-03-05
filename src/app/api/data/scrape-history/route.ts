import { NextResponse } from 'next/server';
import { requireSession, unauthorized, serverError } from '@/lib/api-auth';
import { getAllScrapeHistory } from '@/lib/services/websites';

export async function GET() {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const history = await getAllScrapeHistory(user.id);
    return NextResponse.json(history);
  } catch (error) {
    console.error('GET /api/data/scrape-history error:', error);
    return serverError();
  }
}
