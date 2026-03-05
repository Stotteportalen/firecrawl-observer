import { NextResponse } from 'next/server';
import { requireSession, unauthorized, serverError } from '@/lib/api-auth';
import { db } from '@/lib/db';

export async function GET() {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const changes = await db.grantChangeEvent.findMany({
      where: {
        grantScheme: {
          provider: { userId: user.id },
        },
      },
      include: {
        grantScheme: {
          select: { id: true, name: true, providerName: true },
        },
      },
      orderBy: { detectedAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(changes);
  } catch (error) {
    console.error('GET /api/data/grants/changes error:', error);
    return serverError();
  }
}
