import { NextRequest, NextResponse } from 'next/server';
import { requireSession, unauthorized, serverError } from '@/lib/api-auth';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const scheme = await db.grantScheme.findUnique({
      where: { id },
      include: { provider: { select: { userId: true } } },
    });

    if (!scheme || scheme.provider.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const changes = await db.grantChangeEvent.findMany({
      where: { grantSchemeId: id },
      orderBy: { detectedAt: 'desc' },
    });

    return NextResponse.json(changes);
  } catch (error) {
    console.error('GET /api/data/grants/schemes/[id]/changes error:', error);
    return serverError();
  }
}
