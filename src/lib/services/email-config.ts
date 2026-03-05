import { Resend } from 'resend';
import { db } from '@/lib/db';

export async function getEmailConfig(userId: string) {
  return db.fcoEmailConfig.findUnique({ where: { userId } });
}

export async function getEmailConfigInternal(userId: string) {
  return db.fcoEmailConfig.findUnique({ where: { userId } });
}

export async function updateEmailConfig(userId: string, email: string) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }

  const verificationToken = Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
  const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.fcoEmailConfig.upsert({
    where: { userId },
    update: {
      email,
      isVerified: false,
      verificationToken,
      verificationExpiry,
    },
    create: {
      userId,
      email,
      isVerified: false,
      verificationToken,
      verificationExpiry,
    },
  });

  // Send verification email (fire and forget)
  sendVerificationEmail(email, verificationToken).catch(err =>
    console.error('Failed to send verification email:', err)
  );

  return { success: true, message: 'Verification email sent' };
}

export async function verifyEmail(token: string) {
  const config = await db.fcoEmailConfig.findFirst({
    where: { verificationToken: token },
  });

  if (!config) throw new Error('Invalid verification token');
  if (config.verificationExpiry && config.verificationExpiry < new Date()) {
    throw new Error('Verification token has expired');
  }

  await db.fcoEmailConfig.update({
    where: { id: config.id },
    data: {
      isVerified: true,
      verificationToken: null,
      verificationExpiry: null,
    },
  });

  return { success: true, message: 'Email verified successfully' };
}

export async function resendVerificationEmail(userId: string) {
  const config = await db.fcoEmailConfig.findUnique({ where: { userId } });
  if (!config) throw new Error('No email configuration found');
  if (config.isVerified) throw new Error('Email is already verified');

  const verificationToken = Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
  const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.fcoEmailConfig.update({
    where: { id: config.id },
    data: { verificationToken, verificationExpiry },
  });

  await sendVerificationEmail(config.email, verificationToken);

  return { success: true, message: 'Verification email resent' };
}

async function sendVerificationEmail(email: string, token: string) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error('RESEND_API_KEY not configured');
    return;
  }

  const resend = new Resend(resendApiKey);
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/verify-email?token=${token}`;

  await resend.emails.send({
    from: `${process.env.APP_NAME || 'Firecrawl Observer'} <${process.env.FROM_EMAIL || 'noreply@example.com'}>`,
    to: email,
    subject: 'Verify your email for Firecrawl Observer',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #EA580C; margin-bottom: 24px;">Verify Your Email</h2>
        <p style="color: #374151; font-size: 16px; line-height: 24px; margin-bottom: 24px;">
          Thank you for setting up email notifications with Firecrawl Observer.
          Please click the button below to verify your email address:
        </p>
        <a href="${verificationUrl}"
           style="display: inline-block; background-color: #EA580C; color: white; padding: 12px 24px;
                  text-decoration: none; border-radius: 6px; font-weight: 500;">
          Verify Email
        </a>
        <p style="color: #6B7280; font-size: 14px; margin-top: 24px;">
          This link will expire in 24 hours. If you didn't request this, please ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 32px 0;">
        <p style="color: #9CA3AF; font-size: 12px;">
          Firecrawl Observer - Website Change Monitoring
        </p>
      </div>
    `,
  });
}
