import { NextRequest, NextResponse } from 'next/server';
import { requireSession, unauthorized, badRequest, serverError } from '@/lib/api-auth';
import { getUserApiKeys, createApiKey, deleteApiKey } from '@/lib/services/api-keys';

export async function GET() {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const keys = await getUserApiKeys(user.id);
    return NextResponse.json(keys);
  } catch (error) {
    console.error('GET /api/data/api-keys error:', error);
    return serverError();
  }
}

export async function POST(request: NextRequest) {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    if (!body.name) return badRequest('name is required');
    const key = await createApiKey(user.id, body.name);
    return NextResponse.json(key, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    if (!body.keyId) return badRequest('keyId is required');
    await deleteApiKey(body.keyId, user.id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
  }
}
