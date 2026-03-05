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
      include: {
        provider: { select: { id: true, name: true, domain: true, userId: true } },
        discoveredPages: { select: { id: true, url: true, title: true, classificationScore: true } },
        changeEvents: { orderBy: { detectedAt: 'desc' }, take: 20 },
      },
    });

    if (!scheme || scheme.provider.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(scheme);
  } catch (error) {
    console.error('GET /api/data/grants/schemes/[id] error:', error);
    return serverError();
  }
}
