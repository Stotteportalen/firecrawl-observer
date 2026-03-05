import { NextRequest, NextResponse } from 'next/server';
import { requireSession, unauthorized, serverError } from '@/lib/api-auth';
import { discoverGrantPages, classifyDiscoveredPages } from '@/lib/services/grants/discovery';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'discover'; // discover | classify

    if (action === 'classify') {
      const result = await classifyDiscoveredPages(id, user.id, body.batchSize || 20);
      return NextResponse.json(result);
    }

    // Fire and forget discovery (can take a while)
    discoverGrantPages(id, user.id).catch(err =>
      console.error('Discovery error:', err)
    );

    return NextResponse.json({ success: true, message: 'Discovery started' });
  } catch (error) {
    console.error('POST /api/data/grants/providers/[id]/discover error:', error);
    return serverError();
  }
}
