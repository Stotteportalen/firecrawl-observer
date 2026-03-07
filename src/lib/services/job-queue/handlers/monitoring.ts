import { db } from '@/lib/db';
import type { Prisma } from '../../../../../.generated/prisma/client';
import type { JobQueue } from '../types';
import { GrantExtractionSchema, ChangeAnalysisSchema } from '../../grants/schemas';
import { CHANGE_ANALYSIS_SYSTEM_PROMPT, buildChangeAnalysisPrompt } from '../../grants/prompts';
import { getUserSettingsInternal } from '../../user-settings';

interface MonitoringJobOptions {
  grants: Array<{ id: string; sourceUrl: string; name: string; providerName: string }>;
  [key: string]: unknown;
}

export async function handleMonitoringComplete(job: JobQueue, result: Record<string, unknown>) {
  const options = job.options as unknown as MonitoringJobOptions;
  if (!options?.grants || !result.success) return;

  const data = result.data as Array<{
    url?: string;
    markdown?: string;
    extract?: Record<string, unknown>;
    changeTracking?: { changeStatus?: string; diff?: { text?: string; json?: unknown } };
    metadata?: { statusCode?: number };
  }> | undefined;

  if (!data) return;

  for (let j = 0; j < data.length; j++) {
    const scrapeResult = data[j];
    const grant = options.grants[j];
    if (!grant) continue;

    try {
      await processGrantScrapeResult(grant, scrapeResult, job.userId);
    } catch (err) {
      console.error(`[MonitoringHandler] Failed to process grant ${grant.name}:`, err);
    }
  }
}

async function processGrantScrapeResult(
  grant: { id: string; sourceUrl: string; name: string; providerName: string },
  scrapeResult: {
    url?: string;
    markdown?: string;
    extract?: Record<string, unknown>;
    changeTracking?: { changeStatus?: string; diff?: { text?: string; json?: unknown } };
    metadata?: { statusCode?: number };
  },
  userId: string
) {
  const changeStatus = scrapeResult.changeTracking?.changeStatus;

  if (changeStatus === 'removed' || scrapeResult.metadata?.statusCode === 404) {
    await db.grantScheme.update({
      where: { id: grant.id },
      data: { isArchived: true, archivedReason: 'Page no longer available', lastScrapedAt: new Date() },
    });
    await db.grantChangeEvent.create({
      data: { grantSchemeId: grant.id, changeType: 'grant_removed', summary: `Grant page "${grant.name}" is no longer available` },
    });
    return;
  }

  const updateData: Prisma.GrantSchemeUpdateInput = { lastScrapedAt: new Date() };

  if (changeStatus === 'changed' && scrapeResult.changeTracking?.diff) {
    const diffText = scrapeResult.changeTracking.diff.text || '';

    if (scrapeResult.extract) {
      try {
        const extracted = GrantExtractionSchema.parse(scrapeResult.extract);
        let applicationDeadline: Date | null = null;
        if (extracted.applicationDeadline) {
          const parsed = new Date(extracted.applicationDeadline);
          if (!isNaN(parsed.getTime())) applicationDeadline = parsed;
        }
        updateData.name = extracted.name;
        updateData.providerName = extracted.providerName;
        updateData.summary = extracted.summary;
        updateData.status = extracted.status;
        updateData.fundingType = extracted.fundingType;
        updateData.applicationDeadline = applicationDeadline;
        updateData.isRollingDeadline = extracted.isRollingDeadline;
        updateData.ragContent = extracted.ragContent;
        updateData.extractedJson = scrapeResult.extract as Prisma.InputJsonValue;
        updateData.lastExtractedAt = new Date();
      } catch {
        console.error(`[MonitoringHandler] Extraction validation failed for ${grant.name}`);
      }
    }

    if (scrapeResult.markdown) updateData.fullMarkdown = scrapeResult.markdown;
    updateData.lastChangeAt = new Date();
    updateData.changeCount = { increment: 1 };

    let changeSummary = `Content updated for "${grant.name}"`;
    let changeType = 'content_updated';

    try {
      const analysis = await analyzeChange(grant.name, diffText, userId);
      if (analysis) {
        changeSummary = analysis.summary;
        changeType = analysis.changeTypes[0] || 'content_updated';
      }
    } catch { /* Use default */ }

    await db.grantChangeEvent.create({
      data: { grantSchemeId: grant.id, changeType, summary: changeSummary, diffText },
    });
  }

  await db.grantScheme.update({ where: { id: grant.id }, data: updateData });
}

async function analyzeChange(grantName: string, diffText: string, userId: string) {
  const userSettings = await getUserSettingsInternal(userId);
  if (!userSettings?.aiApiKey) return null;

  const baseUrl = (userSettings.aiBaseUrl as string) || 'https://api.openai.com/v1';
  const apiUrl = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userSettings.aiApiKey as string}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: userSettings.aiModel || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: CHANGE_ANALYSIS_SYSTEM_PROMPT },
          { role: 'user', content: buildChangeAnalysisPrompt(grantName, diffText) },
        ],
        temperature: 0.2, max_tokens: 300, response_format: { type: 'json_object' },
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return ChangeAnalysisSchema.parse(JSON.parse(data.choices[0].message.content));
  } catch { return null; }
}
