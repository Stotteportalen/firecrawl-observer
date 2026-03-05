import { NextRequest, NextResponse } from 'next/server';
import { requireSession, unauthorized, badRequest, serverError } from '@/lib/api-auth';
import { extractGrantData } from '@/lib/services/grants/extraction';

const MAX_IDS = 20;

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

    const results = await Promise.allSettled(
      ids.map(id => extractGrantData(id, user.id))
    );

    const mapped = ids.map((id, i) => {
      const result = results[i];
      if (result.status === 'fulfilled') {
        return { id, success: true };
      }
      return { id, success: false, error: result.reason?.message || 'Extraction failed' };
    });

    return NextResponse.json({ success: true, results: mapped });
  } catch (error) {
    console.error('POST /api/data/grants/schemes/bulk-extract error:', error);
    return serverError();
  }
}
