import { NextRequest, NextResponse } from 'next/server';
import { requireSession, unauthorized, badRequest, serverError } from '@/lib/api-auth';
import { extractGrantData } from '@/lib/services/grants/extraction';

const MAX_IDS = 100;

export async function POST(request: NextRequest) {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const ids: string[] = body.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return badRequest('ids must be a non-empty array');
    }
    if (ids.length > MAX_IDS) {
      return badRequest(`Maximum ${MAX_IDS} grants per request`);
    }

    // Each extractGrantData now enqueues a job and returns immediately
    const results = await Promise.allSettled(
      ids.map(id => extractGrantData(id, user.id))
    );

    const enqueued = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return NextResponse.json({
      success: true,
      message: `${enqueued} extraction jobs enqueued`,
      enqueued,
      failed,
    });
  } catch (error) {
    console.error('POST /api/data/grants/schemes/bulk-extract error:', error);
    return serverError();
  }
}
