import { NextRequest, NextResponse } from 'next/server';
import { requireSession, unauthorized, badRequest, serverError } from '@/lib/api-auth';
import { getUserWebsites, createWebsite } from '@/lib/services/websites';

export async function GET() {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const websites = await getUserWebsites(user.id);
    return NextResponse.json(websites);
  } catch (error) {
    console.error('GET /api/data/websites error:', error);
    return serverError();
  }
}

export async function POST(request: NextRequest) {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    if (!body.url || !body.name) return badRequest('url and name are required');

    const website = await createWebsite(user.id, {
      url: body.url,
      name: body.name,
      checkInterval: body.checkInterval || 60,
      notificationPreference: body.notificationPreference,
      webhookUrl: body.webhookUrl,
      monitorType: body.monitorType,
      crawlLimit: body.crawlLimit,
      crawlDepth: body.crawlDepth,
      scrapeProvider: body.scrapeProvider,
    });

    // If full site, trigger initial crawl
    if (body.monitorType === 'full_site') {
      const { performCrawl } = await import('@/lib/services/crawl');
      performCrawl(website.id, user.id).catch(err =>
        console.error('Initial crawl error:', err)
      );
    }

    return NextResponse.json(website, { status: 201 });
  } catch (error) {
    console.error('POST /api/data/websites error:', error);
    return serverError();
  }
}
