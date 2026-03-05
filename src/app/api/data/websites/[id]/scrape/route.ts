import { NextRequest, NextResponse } from 'next/server';
import { requireSession, unauthorized, serverError } from '@/lib/api-auth';
import { triggerScrape } from '@/lib/services/firecrawl';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const result = await triggerScrape(id, user.id);
    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Website not found') {
      return NextResponse.json({ error: 'Website not found' }, { status: 404 });
    }
    console.error('POST /api/data/websites/[id]/scrape error:', error);
    return serverError();
  }
}
