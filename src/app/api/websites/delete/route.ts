import { NextRequest, NextResponse } from 'next/server';
import { requireApiKeyUser } from '@/lib/api-auth';
import { deleteWebsite } from '@/lib/services/websites';

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireApiKeyUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();
    await deleteWebsite(body.websiteId, user.id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Website not found') {
      return NextResponse.json({ error: 'Website not found' }, { status: 404 });
    }
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
