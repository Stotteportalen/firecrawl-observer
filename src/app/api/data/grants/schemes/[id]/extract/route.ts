import { NextRequest, NextResponse } from 'next/server';
import { requireSession, unauthorized, serverError } from '@/lib/api-auth';
import { extractGrantData } from '@/lib/services/grants/extraction';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const result = await extractGrantData(id, user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/data/grants/schemes/[id]/extract error:', error);
    return serverError();
  }
}
