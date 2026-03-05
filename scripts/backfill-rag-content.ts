/**
 * Backfill RAG Content
 *
 * Re-extracts grant data for all grants that have fullMarkdown but no ragContent.
 * Uses the existing extractGrantData() function which now includes ragContent
 * in the Firecrawl extraction schema.
 *
 * Run: npx tsx scripts/backfill-rag-content.ts
 */

import { db } from '../src/lib/db';
import { extractGrantData } from '../src/lib/services/grants/extraction';

async function backfill() {
  // Find grants with content but no ragContent
  const grants = await db.grantScheme.findMany({
    where: {
      fullMarkdown: { not: null },
      ragContent: null,
      isArchived: false,
    },
    select: { id: true, name: true, provider: { select: { userId: true } } },
  });

  console.log(`Found ${grants.length} grants to backfill`);

  let success = 0;
  let failed = 0;

  for (const grant of grants) {
    try {
      console.log(`Extracting: ${grant.name} (${grant.id})`);
      await extractGrantData(grant.id, grant.provider.userId);
      success++;
      console.log(`  ✓ Done`);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      failed++;
      console.error(`  ✗ Failed: ${(error as Error).message}`);
    }
  }

  console.log(`\nBackfill complete: ${success} success, ${failed} failed`);
  process.exit(0);
}

backfill().catch(err => {
  console.error('Backfill error:', err);
  process.exit(1);
});
