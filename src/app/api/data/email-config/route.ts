import { NextRequest, NextResponse } from 'next/server';
import { requireSession, unauthorized, badRequest, serverError } from '@/lib/api-auth';
import { getEmailConfig, updateEmailConfig, resendVerificationEmail } from '@/lib/services/email-config';

export async function GET() {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const config = await getEmailConfig(user.id);
    return NextResponse.json(config);
  } catch (error) {
    console.error('GET /api/data/email-config error:', error);
    return serverError();
  }
}

export async function PUT(request: NextRequest) {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const body = await request.json();

    if (body.action === 'resend') {
      const result = await resendVerificationEmail(user.id);
      return NextResponse.json(result);
    }

    if (!body.email) return badRequest('email is required');
    const result = await updateEmailConfig(user.id, body.email);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
  }
}
