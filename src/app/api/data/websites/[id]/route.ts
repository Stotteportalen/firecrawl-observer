import { NextRequest, NextResponse } from 'next/server';
import { requireSession, unauthorized, serverError } from '@/lib/api-auth';
import { updateWebsite, deleteWebsite } from '@/lib/services/websites';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const body = await request.json();
    const website = await updateWebsite(id, user.id, body);

    // If changing to full site, trigger initial crawl
    if (body.monitorType === 'full_site') {
      const { performCrawl } = await import('@/lib/services/crawl');
      performCrawl(id, user.id).catch(err => console.error('Crawl error:', err));
    }

    return NextResponse.json(website);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Website not found') {
      return NextResponse.json({ error: 'Website not found' }, { status: 404 });
    }
    console.error('PUT /api/data/websites/[id] error:', error);
    return serverError();
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    await deleteWebsite(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Website not found') {
      return NextResponse.json({ error: 'Website not found' }, { status: 404 });
    }
    console.error('DELETE /api/data/websites/[id] error:', error);
    return serverError();
  }
}
