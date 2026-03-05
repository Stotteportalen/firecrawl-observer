import { NextRequest, NextResponse } from 'next/server';
import { requireSession, unauthorized, badRequest, serverError } from '@/lib/api-auth';
import { getUserFirecrawlKey, setFirecrawlKey, deleteFirecrawlKey } from '@/lib/services/firecrawl-keys';

export async function GET() {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const key = await getUserFirecrawlKey(user.id);
    return NextResponse.json(key);
  } catch (error) {
    console.error('GET /api/data/firecrawl-key error:', error);
    return serverError();
  }
}

export async function PUT(request: NextRequest) {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    if (!body.apiKey) return badRequest('apiKey is required');
    const result = await setFirecrawlKey(user.id, body.apiKey);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
  }
}

export async function DELETE() {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const result = await deleteFirecrawlKey(user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('DELETE /api/data/firecrawl-key error:', error);
    return serverError();
  }
}
