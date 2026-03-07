import { db } from '@/lib/db';
import type { Prisma } from '../../../../../.generated/prisma/client';
import type { JobQueue } from '../types';
import { GrantExtractionSchema } from '../../grants/schemas';

export async function handleExtractionComplete(job: JobQueue, result: Record<string, unknown>) {
  if (!job.sourceId) {
    console.error('[ExtractionHandler] No sourceId (grantSchemeId) on job');
    return;
  }

  if (!result.success) {
    console.error(`[ExtractionHandler] Scrape failed for grant ${job.sourceId}: ${result.error}`);
    return;
  }

  const grant = await db.grantScheme.findUnique({ where: { id: job.sourceId } });
  if (!grant) {
    console.error(`[ExtractionHandler] Grant ${job.sourceId} not found`);
    return;
  }

  // Validate extracted data
  const extractedRaw = result.extract as Record<string, unknown> | undefined;
  let extracted: Record<string, unknown> | undefined;
  try {
    extracted = extractedRaw ? GrantExtractionSchema.parse(extractedRaw) as Record<string, unknown> : undefined;
  } catch {
    console.error('[ExtractionHandler] Extraction validation failed, using raw data:', extractedRaw);
    extracted = extractedRaw;
  }

  // Parse deadline
  let applicationDeadline: Date | null = null;
  if (extracted?.applicationDeadline && typeof extracted.applicationDeadline === 'string') {
    const parsed = new Date(extracted.applicationDeadline);
    if (!isNaN(parsed.getTime())) {
      applicationDeadline = parsed;
    }
  }

  // Determine status
  let status = 'unknown';
  if (extracted?.status) {
    status = String(extracted.status);
  }
  if (status === 'unknown' && applicationDeadline && applicationDeadline < new Date()) {
    status = 'closed';
  }

  const name = extracted?.name ? String(extracted.name) : grant.name;

  const updateData: Prisma.GrantSchemeUpdateInput = {
    name,
    providerName: extracted?.providerName ? String(extracted.providerName) : grant.providerName,
    summary: (extracted?.summary as string | null) ?? null,
    fullMarkdown: (result.markdown as string) || null,
    applicationDeadline,
    isRollingDeadline: extracted?.isRollingDeadline ? Boolean(extracted.isRollingDeadline) : false,
    status,
    fundingType: (extracted?.fundingType as string | null) ?? null,
    ragContent: (extracted?.ragContent as string | null) ?? null,
    extractedJson: extractedRaw as Prisma.InputJsonValue || undefined,
    lastExtractedAt: new Date(),
    lastScrapedAt: new Date(),
  };

  await db.grantScheme.update({
    where: { id: job.sourceId },
    data: updateData,
  });
}
