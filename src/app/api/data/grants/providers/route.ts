import { NextRequest, NextResponse } from 'next/server';
import { requireSession, unauthorized, badRequest, serverError } from '@/lib/api-auth';
import { db } from '@/lib/db';

export async function GET() {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const providers = await db.grantProvider.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { grantSchemes: true, discoveredPages: true } },
      },
    });
    return NextResponse.json(providers);
  } catch (error) {
    console.error('GET /api/data/grants/providers error:', error);
    return serverError();
  }
}

export async function POST(request: NextRequest) {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    if (!body.name || !body.domain) return badRequest('name and domain are required');

    // Normalize domain
    const domain = body.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
    const websiteUrl = body.websiteUrl || `https://${domain}`;

    const provider = await db.grantProvider.create({
      data: {
        userId: user.id,
        name: body.name,
        domain,
        websiteUrl,
        knownListingUrls: body.knownListingUrls || [],
        checkFrequency: body.checkFrequency || 'weekly',
        notes: body.notes || null,
      },
    });

    return NextResponse.json(provider, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return badRequest('Provider with this domain already exists');
    }
    console.error('POST /api/data/grants/providers error:', error);
    return serverError();
  }
}
