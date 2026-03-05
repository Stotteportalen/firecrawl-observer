import { NextRequest, NextResponse } from 'next/server';
import { verifyEmail } from '@/lib/services/email-config';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/settings?error=missing-token', request.url));
  }

  try {
    const result = await verifyEmail(token);

    if (!result?.success) {
      return NextResponse.redirect(new URL('/settings?section=notifications&error=verification-failed', request.url));
    }

    return NextResponse.redirect(new URL('/settings?section=notifications&verified=true', request.url));
  } catch (error) {
    console.error('Email verification error:', error);

    const errorMessage = error instanceof Error ? error.message : '';
    if (errorMessage.includes('expired')) {
      return NextResponse.redirect(new URL('/settings?section=notifications&error=token-expired', request.url));
    } else if (errorMessage.includes('Invalid')) {
      return NextResponse.redirect(new URL('/settings?section=notifications&error=invalid-token', request.url));
    }

    return NextResponse.redirect(new URL('/settings?section=notifications&error=verification-error', request.url));
  }
}
