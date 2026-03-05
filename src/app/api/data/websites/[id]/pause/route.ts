import { NextRequest, NextResponse } from 'next/server';
import { requireSession, unauthorized, serverError } from '@/lib/api-auth';
import { pauseWebsite } from '@/lib/services/websites';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const body = await request.json();
    const isPaused = await pauseWebsite(id, user.id, body.isPaused);
    return NextResponse.json({ isPaused });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Website not found') {
      return NextResponse.json({ error: 'Website not found' }, { status: 404 });
    }
    console.error('POST /api/data/websites/[id]/pause error:', error);
    return serverError();
  }
}
