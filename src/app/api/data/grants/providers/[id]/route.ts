import { NextRequest, NextResponse } from 'next/server';
import { requireSession, unauthorized, serverError } from '@/lib/api-auth';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const provider = await db.grantProvider.findUnique({
      where: { id },
      include: {
        _count: { select: { grantSchemes: true, discoveredPages: true } },
      },
    });

    if (!provider || provider.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(provider);
  } catch (error) {
    console.error('GET /api/data/grants/providers/[id] error:', error);
    return serverError();
  }
}

export async function PUT(
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
    const updated = await db.grantProvider.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.websiteUrl && { websiteUrl: body.websiteUrl }),
        ...(body.knownListingUrls && { knownListingUrls: body.knownListingUrls }),
        ...(body.checkFrequency && { checkFrequency: body.checkFrequency }),
        ...(body.status && { status: body.status }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.ignorePatterns !== undefined && { ignorePatterns: body.ignorePatterns }),
        ...(body.discoveryLimit !== undefined && { discoveryLimit: body.discoveryLimit }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT /api/data/grants/providers/[id] error:', error);
    return serverError();
  }
}

export async function DELETE(
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

    await db.grantProvider.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/data/grants/providers/[id] error:', error);
    return serverError();
  }
}
