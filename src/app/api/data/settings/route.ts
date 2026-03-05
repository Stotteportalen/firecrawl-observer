import { NextRequest, NextResponse } from 'next/server';
import { requireSession, unauthorized, serverError } from '@/lib/api-auth';
import {
  getUserSettings,
  updateDefaultWebhook,
  toggleEmailNotifications,
  updateEmailTemplate,
  updateAISettings,
  updateNotificationFiltering,
} from '@/lib/services/user-settings';

export async function GET() {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const settings = await getUserSettings(user.id);
    return NextResponse.json(settings);
  } catch (error) {
    console.error('GET /api/data/settings error:', error);
    return serverError();
  }
}

export async function PUT(request: NextRequest) {
  const user = await requireSession();
  if (!user) return unauthorized();

  try {
    const body = await request.json();

    // Determine which settings to update based on the action field
    switch (body.action) {
      case 'updateWebhook':
        return NextResponse.json(await updateDefaultWebhook(user.id, body.webhookUrl));
      case 'toggleEmail':
        return NextResponse.json(await toggleEmailNotifications(user.id, body.enabled));
      case 'updateTemplate':
        return NextResponse.json(await updateEmailTemplate(user.id, body.template));
      case 'updateAI':
        return NextResponse.json(await updateAISettings(user.id, {
          enabled: body.enabled,
          model: body.model,
          baseUrl: body.baseUrl,
          systemPrompt: body.systemPrompt,
          threshold: body.threshold,
          apiKey: body.apiKey,
        }));
      case 'updateNotificationFiltering':
        return NextResponse.json(await updateNotificationFiltering(user.id, {
          emailOnlyIfMeaningful: body.emailOnlyIfMeaningful,
          webhookOnlyIfMeaningful: body.webhookOnlyIfMeaningful,
        }));
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('PUT /api/data/settings error:', error);
    return serverError();
  }
}
