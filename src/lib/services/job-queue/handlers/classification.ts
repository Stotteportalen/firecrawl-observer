import { db } from '@/lib/db';
import type { JobQueue } from '../types';
import { getUserSettingsInternal } from '../../user-settings';
import { scoreUrlRelevance } from '../../grants/url-scoring';
import {
  CLASSIFICATION_SYSTEM_PROMPT,
  buildClassificationUserPrompt,
} from '../../grants/prompts';
import { ClassificationResultSchema } from '../../grants/schemas';

export async function handleClassificationComplete(job: JobQueue, result: Record<string, unknown>) {
  const pageId = job.sourceId;
  if (!pageId) return;

  const page = await db.discoveredPage.findUnique({
    where: { id: pageId },
    include: { provider: true },
  });
  if (!page) return;

  if (!result.success || !result.markdown) {
    await db.discoveredPage.update({
      where: { id: pageId },
      data: {
        classificationStatus: 'classified',
        isGrantPage: false,
        classificationScore: 0,
        classificationReason: 'Failed to scrape',
      },
    });
    return;
  }

  const metadata = result.metadata as Record<string, unknown> | undefined;
  if (metadata?.title) {
    await db.discoveredPage.update({
      where: { id: pageId },
      data: { title: metadata.title as string },
    });
  }

  // Run AI classification
  const userSettings = await getUserSettingsInternal(job.userId);
  if (!userSettings?.aiApiKey) {
    console.error('[ClassificationHandler] No AI API key configured');
    return;
  }

  const classification = await classifyWithAI(
    page.url,
    result.markdown as string,
    userSettings
  );

  if (!classification) return;

  await db.discoveredPage.update({
    where: { id: pageId },
    data: {
      classificationStatus: 'classified',
      isGrantPage: classification.isGrantPage,
      isListingPage: classification.isListingPage,
      classificationScore: classification.confidence,
      classificationReason: classification.reasoning,
      classifiedAt: new Date(),
      title: (metadata?.title as string) || (classification.grantName ?? page.title),
    },
  });

  // If listing page, add linked grant URLs
  if (classification.isListingPage && classification.linkedGrantUrls.length > 0) {
    for (const linkedUrl of classification.linkedGrantUrls) {
      try {
        await db.discoveredPage.upsert({
          where: { providerId_url: { providerId: page.providerId, url: linkedUrl } },
          create: {
            providerId: page.providerId,
            url: linkedUrl,
            classificationStatus: 'pending',
            urlRelevanceScore: scoreUrlRelevance(linkedUrl),
          },
          update: {},
        });
      } catch {
        // Ignore duplicates
      }
    }
  }
}

async function classifyWithAI(
  url: string,
  markdown: string,
  userSettings: Record<string, unknown> & { aiApiKey?: string | null; aiBaseUrl?: string | null; aiModel?: string | null }
) {
  const baseUrl = (userSettings.aiBaseUrl as string) || 'https://api.openai.com/v1';
  const apiUrl = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userSettings.aiApiKey as string}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: userSettings.aiModel || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: CLASSIFICATION_SYSTEM_PROMPT },
          { role: 'user', content: buildClassificationUserPrompt(url, markdown) },
        ],
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error('[ClassificationHandler] AI API error:', await response.text());
      return null;
    }

    const data = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    return ClassificationResultSchema.parse(parsed);
  } catch (error) {
    console.error('[ClassificationHandler] AI classification error:', error);
    return null;
  }
}
