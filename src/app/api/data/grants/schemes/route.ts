import { NextRequest, NextResponse } from 'next/server';
import { requireSession, unauthorized, serverError } from '@/lib/api-auth';
import { db } from '@/lib/db';
import type { Prisma } from '../../../../../../.generated/prisma/client';

export async function GET(request: NextRequest) {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const fundingType = searchParams.get('fundingType');
    const providerId = searchParams.get('provider');
    const deadlineBefore = searchParams.get('deadlineBefore');
    const hasDeadline = searchParams.get('hasDeadline');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'updatedAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const archived = searchParams.get('archived');

    // Build where clause
    const where: Prisma.GrantSchemeWhereInput = {
      provider: { userId: user.id },
      isArchived: archived === 'true' ? true : false,
    };

    if (status) where.status = status;
    if (fundingType) where.fundingType = fundingType;
    if (providerId) where.providerId = providerId;

    if (deadlineBefore) {
      where.applicationDeadline = { lte: new Date(deadlineBefore) };
    }
    if (hasDeadline === 'true') {
      where.applicationDeadline = { not: null };
    } else if (hasDeadline === 'false') {
      where.applicationDeadline = null;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { ragContent: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Build orderBy
    const orderByMap: Record<string, Prisma.GrantSchemeOrderByWithRelationInput> = {
      deadline: { applicationDeadline: sortOrder },
      provider: { providerName: sortOrder },
      updatedAt: { updatedAt: sortOrder },
      name: { name: sortOrder },
    };

    const schemes = await db.grantScheme.findMany({
      where,
      orderBy: orderByMap[sortBy] || { updatedAt: 'desc' },
      include: {
        provider: { select: { id: true, name: true, domain: true } },
        _count: { select: { changeEvents: true } },
      },
    });

    return NextResponse.json(schemes);
  } catch (error) {
    console.error('GET /api/data/grants/schemes error:', error);
    return serverError();
  }
}
