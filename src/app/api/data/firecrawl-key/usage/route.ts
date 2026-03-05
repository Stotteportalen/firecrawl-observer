import { NextResponse } from 'next/server';
import { requireSession, unauthorized, serverError } from '@/lib/api-auth';
import { getTokenUsage } from '@/lib/services/firecrawl-keys';

export async function GET() {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const usage = await getTokenUsage(user.id);
    return NextResponse.json(usage);
  } catch (error) {
    console.error('GET /api/data/firecrawl-key/usage error:', error);
    return serverError();
  }
}
