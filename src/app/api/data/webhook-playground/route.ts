import { NextResponse } from 'next/server';
import { requireSession, unauthorized, serverError } from '@/lib/api-auth';
import { getWebhookPayloads, clearWebhookPayloads } from '@/lib/services/webhook-playground';

export async function GET() {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const payloads = await getWebhookPayloads();
    return NextResponse.json(payloads);
  } catch (error) {
    console.error('GET /api/data/webhook-playground error:', error);
    return serverError();
  }
}

export async function DELETE() {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const result = await clearWebhookPayloads();
    return NextResponse.json(result);
  } catch (error) {
    console.error('DELETE /api/data/webhook-playground error:', error);
    return serverError();
  }
}
