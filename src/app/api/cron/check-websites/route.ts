import { NextRequest, NextResponse } from 'next/server';
import { checkActiveWebsites } from '@/lib/services/monitoring';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await checkActiveWebsites();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cron check-websites error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
