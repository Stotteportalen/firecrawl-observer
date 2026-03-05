import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { validateApiKeyAndGetUser } from '@/lib/services/api-keys';

export async function requireSession() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return null;
  }
  return session.user;
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function serverError(message = 'Internal server error') {
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function requireApiKeyUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const apiKey = authHeader.substring(7);
  return validateApiKeyAndGetUser(apiKey);
}
