import { updateScrapeResultAIAnalysis, getScrapeResult, getWebsite } from './websites';
import { getUserSettingsInternal } from './user-settings';
import { getEmailConfigInternal } from './email-config';
import { sendWebhookNotification, sendEmailNotification } from './notifications';

export async function analyzeChange(params: {
  userId: string;
  scrapeResultId: string;
  websiteName: string;
  websiteUrl: string;
  diff: { text: string; json: unknown };
}) {
  const userSettings = await getUserSettingsInternal(params.userId);

  if (!userSettings || !userSettings.aiAnalysisEnabled || !userSettings.aiApiKey) {
    return;
  }

  const systemPrompt = userSettings.aiSystemPrompt || `You are an AI assistant specialized in analyzing website changes. Your task is to determine if a detected change is "meaningful" or just noise.

Meaningful changes include:
- Content updates (text, images, prices)
- New features or sections
- Important announcements
- Product availability changes
- Policy updates

NOT meaningful (ignore these):
- Rotating banners/carousels
- Dynamic timestamps
- View counters
- Session IDs
- Random promotional codes
- Cookie consent banners
- Advertising content
- Social media feed updates

Analyze the provided diff and return a JSON response with:
{
  "score": 0-100 (how meaningful the change is),
  "isMeaningful": true/false,
  "reasoning": "Brief explanation of your decision"
}`;

  try {
    const baseUrl = (userSettings.aiBaseUrl as string) || 'https://api.openai.com/v1';
    const apiUrl = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userSettings.aiApiKey as string}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: userSettings.aiModel || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Website: ${params.websiteName} (${params.websiteUrl})

Changes detected:
${params.diff.text}

Please analyze these changes and determine if they are meaningful.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('AI API error:', error);
      return;
    }

    const data = await response.json();
    const aiResponse = JSON.parse(data.choices[0].message.content);

    if (typeof aiResponse.score !== 'number' ||
      typeof aiResponse.isMeaningful !== 'boolean' ||
      typeof aiResponse.reasoning !== 'string') {
      console.error('Invalid AI response format:', aiResponse);
      return;
    }

    const threshold = (userSettings.aiMeaningfulChangeThreshold as number) || 70;
    const isMeaningful = aiResponse.score >= threshold;

    const analysis = {
      meaningfulChangeScore: aiResponse.score as number,
      isMeaningfulChange: isMeaningful,
      reasoning: aiResponse.reasoning as string,
      analyzedAt: new Date(),
      model: (userSettings.aiModel as string) || 'gpt-4o-mini',
    };

    await updateScrapeResultAIAnalysis(params.scrapeResultId, analysis);

    console.log(`AI analysis complete for ${params.websiteName}: Score ${aiResponse.score}, Meaningful: ${isMeaningful}`);

    // Handle AI-based notifications
    await handleAIBasedNotifications({
      userId: params.userId,
      scrapeResultId: params.scrapeResultId,
      websiteName: params.websiteName,
      websiteUrl: params.websiteUrl,
      isMeaningful,
      diff: params.diff,
      aiAnalysis: {
        ...analysis,
        analyzedAt: analysis.analyzedAt.getTime(),
      },
    });
  } catch (error) {
    console.error('Error in AI analysis:', error);
  }
}

async function handleAIBasedNotifications(params: {
  userId: string;
  scrapeResultId: string;
  websiteName: string;
  websiteUrl: string;
  isMeaningful: boolean;
  diff: { text: string; json: unknown };
  aiAnalysis: {
    meaningfulChangeScore: number;
    isMeaningfulChange: boolean;
    reasoning: string;
    analyzedAt: number;
    model: string;
  };
}) {
  try {
    const userSettings = await getUserSettingsInternal(params.userId);
    const scrapeResult = await getScrapeResult(params.scrapeResultId);

    if (!scrapeResult) return;

    const website = await getWebsite(scrapeResult.websiteId, params.userId);
    if (!website || website.notificationPreference === 'none') return;

    const shouldSendWebhook = (website.notificationPreference === 'webhook' || website.notificationPreference === 'both') &&
      website.webhookUrl &&
      (!userSettings?.webhookOnlyIfMeaningful || params.isMeaningful);

    const shouldSendEmail = (website.notificationPreference === 'email' || website.notificationPreference === 'both') &&
      (!userSettings?.emailOnlyIfMeaningful || params.isMeaningful);

    if (shouldSendWebhook && website.webhookUrl) {
      sendWebhookNotification({
        webhookUrl: website.webhookUrl,
        websiteId: scrapeResult.websiteId,
        websiteName: website.name,
        websiteUrl: params.websiteUrl,
        scrapeResultId: params.scrapeResultId,
        changeType: 'content_changed',
        changeStatus: 'changed',
        diff: params.diff,
        title: scrapeResult.title ?? undefined,
        description: scrapeResult.description ?? undefined,
        markdown: scrapeResult.markdown,
        scrapedAt: scrapeResult.scrapedAt,
        aiAnalysis: params.aiAnalysis,
      }).catch(err => console.error('Webhook error:', err));
    }

    if (shouldSendEmail) {
      const emailConfig = await getEmailConfigInternal(params.userId);
      if (emailConfig?.email && emailConfig.isVerified) {
        sendEmailNotification({
          email: emailConfig.email,
          websiteName: website.name,
          websiteUrl: params.websiteUrl,
          changeType: 'content_changed',
          changeStatus: 'changed',
          diff: params.diff,
          title: scrapeResult.title ?? undefined,
          scrapedAt: scrapeResult.scrapedAt,
          userId: params.userId,
          aiAnalysis: params.aiAnalysis,
        }).catch(err => console.error('Email error:', err));
      }
    }
  } catch (error) {
    console.error('Error in AI-based notifications:', error);
  }
}
