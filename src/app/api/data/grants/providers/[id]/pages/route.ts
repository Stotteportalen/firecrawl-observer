import { NextRequest, NextResponse } from 'next/server';
import { requireSession, unauthorized, serverError } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { scoreUrlRelevance } from '@/lib/services/grants/url-scoring';
import { matchesIgnorePattern } from '@/lib/services/grants/discovery';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const provider = await db.grantProvider.findUnique({ where: { id } });
    if (!provider || provider.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status'); // pending, classified, confirmed_grant, confirmed_not_grant
    const isGrant = searchParams.get('isGrant'); // true/false
    const minScore = searchParams.get('minScore');

    const where: Record<string, unknown> = { providerId: id };
    if (status) where.classificationStatus = status;
    if (isGrant !== null && isGrant !== undefined && isGrant !== '') {
      where.isGrantPage = isGrant === 'true';
    }
    if (minScore) {
      where.classificationScore = { gte: parseFloat(minScore) };
    }

    const pages = await db.discoveredPage.findMany({
      where,
      orderBy: [
        { classificationScore: 'desc' },
        { urlRelevanceScore: 'desc' },
        { discoveredAt: 'desc' },
      ],
      include: {
        grantScheme: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(pages);
  } catch (error) {
    console.error('GET /api/data/grants/providers/[id]/pages error:', error);
    return serverError();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const provider = await db.grantProvider.findUnique({ where: { id } });
    if (!provider || provider.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { url, title } = await request.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const ignored = matchesIgnorePattern(url, provider.ignorePatterns);
    const relevanceScore = scoreUrlRelevance(url);

    const page = await db.discoveredPage.upsert({
      where: { providerId_url: { providerId: id, url } },
      create: {
        providerId: id,
        url,
        title: title || null,
        classificationStatus: ignored ? 'confirmed_not_grant' : 'pending',
        urlRelevanceScore: relevanceScore,
      },
      update: {},
    });

    return NextResponse.json(page);
  } catch (error) {
    console.error('POST /api/data/grants/providers/[id]/pages error:', error);
    return serverError();
  }
}
