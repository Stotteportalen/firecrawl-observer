import { NextResponse } from 'next/server';
import { requireSession, unauthorized, serverError } from '@/lib/api-auth';
import { getLatestScrapeForWebsites } from '@/lib/services/websites';

export async function GET() {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const latestScrapes = await getLatestScrapeForWebsites(user.id);
    return NextResponse.json(latestScrapes);
  } catch (error) {
    console.error('GET /api/data/latest-scrapes error:', error);
    return serverError();
  }
}
