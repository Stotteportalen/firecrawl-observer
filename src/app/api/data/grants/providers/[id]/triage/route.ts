import { NextRequest, NextResponse } from 'next/server';
import { requireSession, unauthorized, serverError } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { runTriageForProvider, addIgnorePattern, bulkReviewPages } from '@/lib/services/grants/discovery';

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

    const body = await request.json();
    const { action } = body;

    if (action === 'analyze') {
      const model = body.model === 'gemini-2.5-pro' ? 'gemini-2.5-pro' : 'claude-sonnet-4';
      const result = await runTriageForProvider(id, user.id, model as 'claude-sonnet-4' | 'gemini-2.5-pro');
      return NextResponse.json(result);
    }

    if (action === 'apply_ignore') {
      const { pattern } = body;
      if (!pattern || typeof pattern !== 'string') {
        return NextResponse.json({ error: 'Pattern is required' }, { status: 400 });
      }
      const result = await addIgnorePattern(id, user.id, pattern);
      return NextResponse.json(result);
    }

    if (action === 'apply_grants') {
      const { pageIds } = body;
      if (!Array.isArray(pageIds) || pageIds.length === 0) {
        return NextResponse.json({ error: 'pageIds array is required' }, { status: 400 });
      }
      const reviews = pageIds.map((pageId: string) => ({ pageId, decision: 'grant' as const }));
      const results = await bulkReviewPages(id, user.id, reviews);
      return NextResponse.json({ results });
    }

    return NextResponse.json({ error: 'Invalid action. Use: analyze, apply_ignore, apply_grants' }, { status: 400 });
  } catch (error) {
    console.error('POST /api/data/grants/providers/[id]/triage error:', error);
    return serverError();
  }
}
