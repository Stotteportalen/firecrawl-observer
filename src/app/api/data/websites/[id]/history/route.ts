import { NextRequest, NextResponse } from 'next/server';
import { requireSession, unauthorized, serverError } from '@/lib/api-auth';
import { getWebsiteScrapeHistory } from '@/lib/services/websites';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10');
    const history = await getWebsiteScrapeHistory(id, user.id, limit);
    return NextResponse.json(history);
  } catch (error) {
    console.error('GET /api/data/websites/[id]/history error:', error);
    return serverError();
  }
}
