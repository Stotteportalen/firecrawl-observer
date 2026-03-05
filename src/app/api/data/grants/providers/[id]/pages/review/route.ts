import { NextRequest, NextResponse } from 'next/server';
import { requireSession, unauthorized, badRequest, serverError } from '@/lib/api-auth';
import { confirmGrantPage, bulkReviewPages } from '@/lib/services/grants/discovery';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const body = await request.json();

    // Bulk review: { reviews: [{ pageId, decision }] }
    if (body.reviews && Array.isArray(body.reviews)) {
      const results = await bulkReviewPages(id, user.id, body.reviews);
      return NextResponse.json({ results });
    }

    // Single review: { pageId, decision }
    if (!body.pageId || !body.decision) {
      return badRequest('pageId and decision are required');
    }
    if (!['grant', 'not_grant'].includes(body.decision)) {
      return badRequest('decision must be "grant" or "not_grant"');
    }

    const result = await confirmGrantPage(body.pageId, user.id, body.decision);
    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/data/grants/providers/[id]/pages/review error:', error);
    return serverError();
  }
}
