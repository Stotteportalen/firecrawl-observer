import { db } from '@/lib/db';
import type { Prisma } from '../../../../.generated/prisma/client';
import { getFirecrawlClient } from '@/lib/services/firecrawl';
import { EXTRACTION_SYSTEM_PROMPT } from './prompts';
import { GrantExtractionSchema, FIRECRAWL_GRANT_EXTRACT_SCHEMA, GRANT_SCRAPE_ACTIONS, GRANT_SCRAPE_WAIT_FOR } from './schemas';

/**
 * Extract structured grant data from a confirmed grant page.
 * Uses Firecrawl scrapeUrl with both 'markdown' and 'extract' formats in one call.
 */
export async function extractGrantData(grantSchemeId: string, userId: string) {
  const grant = await db.grantScheme.findUnique({
    where: { id: grantSchemeId },
    include: { provider: true },
  });

  if (!grant || grant.provider.userId !== userId) {
    throw new Error('Grant scheme not found');
  }

  const firecrawl = await getFirecrawlClient(userId);

  const result = await firecrawl.scrapeUrl(grant.sourceUrl, {
    formats: ['markdown', 'extract'],
    extract: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      schema: FIRECRAWL_GRANT_EXTRACT_SCHEMA as any,
      systemPrompt: EXTRACTION_SYSTEM_PROMPT,
    },
    waitFor: GRANT_SCRAPE_WAIT_FOR,
    actions: [...GRANT_SCRAPE_ACTIONS],
  }) as unknown as {
    success: boolean;
    markdown?: string;
    extract?: Record<string, unknown>;
    error?: string;
  };

  if (!result.success) {
    throw new Error(`Extraction failed: ${result.error || 'Unknown error'}`);
  }

  // Validate extracted data
  const extractedRaw = result.extract;
  let extracted;
  try {
    extracted = GrantExtractionSchema.parse(extractedRaw);
  } catch {
    console.error('Extraction validation failed, using raw data:', extractedRaw);
    extracted = extractedRaw as Record<string, unknown>;
  }

  // Parse deadline
  let applicationDeadline: Date | null = null;
  if (extracted && typeof extracted === 'object' && 'applicationDeadline' in extracted) {
    const deadlineStr = (extracted as Record<string, unknown>).applicationDeadline;
    if (typeof deadlineStr === 'string') {
      const parsed = new Date(deadlineStr);
      if (!isNaN(parsed.getTime())) {
        applicationDeadline = parsed;
      }
    }
  }

  // Determine status from extraction or deadline
  let status = 'unknown';
  if (extracted && typeof extracted === 'object' && 'status' in extracted) {
    status = String((extracted as Record<string, unknown>).status || 'unknown');
  }
  // If deadline is in the past and status is unknown, mark as closed
  if (status === 'unknown' && applicationDeadline && applicationDeadline < new Date()) {
    status = 'closed';
  }

  const name = (extracted && typeof extracted === 'object' && 'name' in extracted)
    ? String((extracted as Record<string, unknown>).name)
    : grant.name;

  const updateData: Prisma.GrantSchemeUpdateInput = {
    name,
    providerName: (extracted && typeof extracted === 'object' && 'providerName' in extracted)
      ? String((extracted as Record<string, unknown>).providerName)
      : grant.providerName,
    summary: (extracted && typeof extracted === 'object' && 'summary' in extracted)
      ? ((extracted as Record<string, unknown>).summary as string | null)
      : null,
    fullMarkdown: result.markdown || null,
    applicationDeadline,
    isRollingDeadline: (extracted && typeof extracted === 'object' && 'isRollingDeadline' in extracted)
      ? Boolean((extracted as Record<string, unknown>).isRollingDeadline)
      : false,
    status,
    fundingType: (extracted && typeof extracted === 'object' && 'fundingType' in extracted)
      ? ((extracted as Record<string, unknown>).fundingType as string | null)
      : null,
    ragContent: (extracted && typeof extracted === 'object' && 'ragContent' in extracted)
      ? ((extracted as Record<string, unknown>).ragContent as string | null)
      : null,
    extractedJson: extractedRaw as Prisma.InputJsonValue || undefined,
    lastExtractedAt: new Date(),
    lastScrapedAt: new Date(),
  };

  const updated = await db.grantScheme.update({
    where: { id: grantSchemeId },
    data: updateData,
  });

  return { success: true, grantScheme: updated };
}
