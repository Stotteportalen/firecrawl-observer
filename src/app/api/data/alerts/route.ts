import { NextRequest, NextResponse } from 'next/server';
import { requireSession, unauthorized, badRequest, serverError } from '@/lib/api-auth';
import { getUnreadAlerts, markAlertAsRead } from '@/lib/services/websites';

export async function GET() {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const alerts = await getUnreadAlerts(user.id);
    return NextResponse.json(alerts);
  } catch (error) {
    console.error('GET /api/data/alerts error:', error);
    return serverError();
  }
}

export async function PATCH(request: NextRequest) {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    if (!body.alertId) return badRequest('alertId is required');
    await markAlertAsRead(body.alertId, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/data/alerts error:', error);
    return serverError();
  }
}
