import { NextRequest, NextResponse } from 'next/server';
import { requireSession, unauthorized, serverError } from '@/lib/api-auth';
import { classifySinglePage } from '@/lib/services/grants/discovery';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    await params; // consume params (providerId verified inside classifySinglePage via page ownership)
    const { pageId } = await request.json();

    if (!pageId || typeof pageId !== 'string') {
      return NextResponse.json({ error: 'pageId is required' }, { status: 400 });
    }

    const result = await classifySinglePage(pageId, user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('POST pages/classify error:', error);
    return serverError();
  }
}
