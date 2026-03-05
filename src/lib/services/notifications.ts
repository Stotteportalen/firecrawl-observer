import { Resend } from 'resend';
import { sanitizeHtml } from '@/lib/sanitize';
import { getUserSettingsInternal } from './user-settings';

export async function sendWebhookNotification(params: {
  webhookUrl: string;
  websiteId: string;
  websiteName: string;
  websiteUrl: string;
  scrapeResultId: string;
  changeType: string;
  changeStatus: string;
  diff?: { text: string; json: unknown };
  title?: string;
  description?: string;
  markdown: string;
  scrapedAt: Date;
  aiAnalysis?: {
    meaningfulChangeScore: number;
    isMeaningfulChange: boolean;
    reasoning: string;
    analyzedAt: number;
    model: string;
  };
}) {
  const payload = {
    event: 'website_changed',
    timestamp: new Date().toISOString(),
    website: {
      id: params.websiteId,
      name: params.websiteName,
      url: params.websiteUrl,
    },
    change: {
      detectedAt: params.scrapedAt.toISOString(),
      changeType: params.changeType,
      changeStatus: params.changeStatus,
      summary: params.diff?.text
        ? params.diff.text.substring(0, 200) + (params.diff.text.length > 200 ? '...' : '')
        : 'Website content has changed',
      diff: params.diff ? {
        added: params.diff.text.split('\n')
          .filter((line: string) => line.startsWith('+') && !line.startsWith('+++'))
          .map((line: string) => line.substring(1)),
        removed: params.diff.text.split('\n')
          .filter((line: string) => line.startsWith('-') && !line.startsWith('---'))
          .map((line: string) => line.substring(1)),
      } : undefined,
    },
    scrapeResult: {
      id: params.scrapeResultId,
      title: params.title,
      description: params.description,
      markdown: params.markdown.substring(0, 1000) + (params.markdown.length > 1000 ? '...' : ''),
    },
    aiAnalysis: params.aiAnalysis ? {
      meaningfulChangeScore: params.aiAnalysis.meaningfulChangeScore,
      isMeaningfulChange: params.aiAnalysis.isMeaningfulChange,
      reasoning: params.aiAnalysis.reasoning,
      analyzedAt: new Date(params.aiAnalysis.analyzedAt).toISOString(),
      model: params.aiAnalysis.model,
    } : undefined,
  };

  try {
    console.log(`Sending webhook to ${params.webhookUrl}`);

    const response = await fetch(params.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Firecrawl-Observer/1.0',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`Webhook failed: ${response.status} ${response.statusText}`);
      throw new Error(`Webhook failed with status ${response.status}`);
    }

    console.log('Webhook sent successfully');
    return { success: true, status: response.status };
  } catch (error) {
    console.error('Failed to send webhook:', error);
    throw error;
  }
}

export async function sendEmailNotification(params: {
  email: string;
  websiteName: string;
  websiteUrl: string;
  changeType: string;
  changeStatus: string;
  diff?: { text: string; json: unknown };
  title?: string;
  scrapedAt: Date;
  userId: string;
  aiAnalysis?: {
    meaningfulChangeScore: number;
    isMeaningfulChange: boolean;
    reasoning: string;
    analyzedAt: number;
    model: string;
  };
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error('RESEND_API_KEY not configured');
    return;
  }

  const resend = new Resend(resendApiKey);
  const userSettings = await getUserSettingsInternal(params.userId);

  let htmlContent = '';

  if (userSettings?.emailTemplate) {
    const processedTemplate = (userSettings.emailTemplate as string)
      .replace(/{{websiteName}}/g, params.websiteName)
      .replace(/{{websiteUrl}}/g, params.websiteUrl)
      .replace(/{{changeDate}}/g, params.scrapedAt.toLocaleString())
      .replace(/{{changeType}}/g, params.changeStatus)
      .replace(/{{pageTitle}}/g, params.title || 'N/A')
      .replace(/{{viewChangesUrl}}/g, process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
      .replace(/{{aiMeaningfulScore}}/g, params.aiAnalysis?.meaningfulChangeScore?.toString() || 'N/A')
      .replace(/{{aiIsMeaningful}}/g, params.aiAnalysis?.isMeaningfulChange ? 'Yes' : 'No')
      .replace(/{{aiReasoning}}/g, params.aiAnalysis?.reasoning || 'N/A')
      .replace(/{{aiModel}}/g, params.aiAnalysis?.model || 'N/A')
      .replace(/{{aiAnalyzedAt}}/g, params.aiAnalysis?.analyzedAt ? new Date(params.aiAnalysis.analyzedAt).toLocaleString() : 'N/A');

    htmlContent = sanitizeHtml(processedTemplate);
  } else {
    htmlContent = `
      <h2>Website Change Alert</h2>
      <p>We've detected changes on the website you're monitoring:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h3>${params.websiteName}</h3>
        <p><a href="${params.websiteUrl}">${params.websiteUrl}</a></p>
        <p><strong>Changed at:</strong> ${params.scrapedAt.toLocaleString()}</p>
        ${params.title ? `<p><strong>Page Title:</strong> ${params.title}</p>` : ''}
        ${params.aiAnalysis ? `
          <div style="background: #e8f4f8; border-left: 4px solid #2196F3; padding: 12px; margin: 15px 0;">
            <h4 style="margin: 0 0 8px 0; color: #1976D2;">AI Analysis</h4>
            <p><strong>Meaningful Change:</strong> ${params.aiAnalysis.isMeaningfulChange ? 'Yes' : 'No'} (${params.aiAnalysis.meaningfulChangeScore}% score)</p>
            <p><strong>Reasoning:</strong> ${params.aiAnalysis.reasoning}</p>
            <p style="font-size: 12px; color: #666; margin: 8px 0 0 0;">Analyzed by ${params.aiAnalysis.model} at ${new Date(params.aiAnalysis.analyzedAt).toLocaleString()}</p>
          </div>
        ` : ''}
      </div>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}" style="background: #ff6600; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Changes</a></p>
    `;
  }

  await resend.emails.send({
    from: `${process.env.APP_NAME || 'Firecrawl Observer'} <${process.env.FROM_EMAIL || 'noreply@example.com'}>`,
    to: params.email,
    subject: `Changes detected on ${params.websiteName}`,
    html: htmlContent,
  });
}
