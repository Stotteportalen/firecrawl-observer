import { db } from '@/lib/db';
import { enqueueJob } from '@/lib/services/job-queue';
import { EXTRACTION_SYSTEM_PROMPT } from './prompts';
import { FIRECRAWL_GRANT_EXTRACT_SCHEMA, GRANT_SCRAPE_ACTIONS, GRANT_SCRAPE_WAIT_FOR } from './schemas';

/**
 * Extract structured grant data from a confirmed grant page.
 * Enqueues a Firecrawl scrape job — result processing happens in the extraction handler.
 */
export async function extractGrantData(grantSchemeId: string, userId: string) {
  const grant = await db.grantScheme.findUnique({
    where: { id: grantSchemeId },
    include: { provider: true },
  });

  if (!grant || grant.provider.userId !== userId) {
    throw new Error('Grant scheme not found');
  }

  const job = await enqueueJob({
    userId,
    type: 'scrape',
    url: grant.sourceUrl,
    options: {
      formats: ['markdown', 'extract'],
      extract: {
        schema: FIRECRAWL_GRANT_EXTRACT_SCHEMA,
        systemPrompt: EXTRACTION_SYSTEM_PROMPT,
      },
      waitFor: GRANT_SCRAPE_WAIT_FOR,
      actions: [...GRANT_SCRAPE_ACTIONS],
    },
    sourceType: 'extraction',
    sourceId: grantSchemeId,
    priority: 1, // User-triggered
  });

  return { success: true, jobId: job.id };
}
