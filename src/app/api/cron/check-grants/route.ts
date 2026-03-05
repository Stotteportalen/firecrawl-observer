import { NextRequest, NextResponse } from 'next/server';
import { checkGrantsForUpdates } from '@/lib/services/grants/monitoring';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await checkGrantsForUpdates();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cron check-grants error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
