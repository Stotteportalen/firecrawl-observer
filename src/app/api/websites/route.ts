import { NextRequest, NextResponse } from 'next/server';
import { requireApiKeyUser } from '@/lib/api-auth';
import { createWebsite } from '@/lib/services/websites';

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiKeyUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();
    const website = await createWebsite(user.id, {
      url: body.url,
      name: body.name,
      checkInterval: body.checkInterval || 60,
      notificationPreference: body.notificationPreference,
      webhookUrl: body.webhookUrl,
      monitorType: body.monitorType,
      crawlLimit: body.crawlLimit,
      crawlDepth: body.crawlDepth,
    });

    if (body.monitorType === 'full_site') {
      const { performCrawl } = await import('@/lib/services/crawl');
      performCrawl(website.id, user.id).catch(err =>
        console.error('Initial crawl error:', err)
      );
    }

    return NextResponse.json({ success: true, websiteId: website.id }, { status: 201 });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Firecrawl Observer API',
    endpoints: {
      'POST /api/websites': 'Add a new website to monitor',
      'POST /api/websites/pause': 'Pause or resume website monitoring',
      'DELETE /api/websites/delete': 'Delete a website from monitoring',
    },
    docs: '/api-docs',
  });
}
