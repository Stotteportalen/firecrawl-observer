import { NextRequest, NextResponse } from 'next/server';
import { requireSession, unauthorized, serverError } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { addIgnorePattern, removeIgnorePattern } from '@/lib/services/grants/discovery';

export async function GET(
  _request: NextRequest,
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

    return NextResponse.json({ patterns: provider.ignorePatterns });
  } catch (error) {
    console.error('GET ignore-patterns error:', error);
    return serverError();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const { pattern } = await request.json();

    if (!pattern || typeof pattern !== 'string') {
      return NextResponse.json({ error: 'Pattern is required' }, { status: 400 });
    }

    const result = await addIgnorePattern(id, user.id, pattern);
    return NextResponse.json(result);
  } catch (error) {
    console.error('POST ignore-patterns error:', error);
    return serverError();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const { pattern } = await request.json();

    if (!pattern || typeof pattern !== 'string') {
      return NextResponse.json({ error: 'Pattern is required' }, { status: 400 });
    }

    const result = await removeIgnorePattern(id, user.id, pattern);
    return NextResponse.json(result);
  } catch (error) {
    console.error('DELETE ignore-patterns error:', error);
    return serverError();
  }
}
