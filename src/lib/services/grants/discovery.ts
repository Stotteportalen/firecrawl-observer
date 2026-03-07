import { db } from '@/lib/db';
import { getUserSettingsInternal } from '@/lib/services/user-settings';
import {
  TRIAGE_SYSTEM_PROMPT,
  buildTriageUserPrompt,
} from './prompts';
import { TriageResultSchema, type TriageResult } from './schemas';
import { extractGrantData } from './extraction';

/**
 * Discover grant pages on a provider's domain using Firecrawl mapUrl.
 * Enqueues a map job — result processing happens in the discovery handler.
 */
export async function discoverGrantPages(providerId: string, userId: string) {
  const provider = await db.grantProvider.findUnique({ where: { id: providerId } });
  if (!provider || provider.userId !== userId) {
    throw new Error('Provider not found');
  }

  await db.grantProvider.update({
    where: { id: providerId },
    data: { status: 'discovering' },
  });

  const { enqueueJob } = await import('@/lib/services/job-queue');

  await enqueueJob({
    userId,
    type: 'map',
    url: provider.websiteUrl,
    options: {
      search: 'tilskudd støtte grant søknad',
      includeSubdomains: true,
      limit: provider.discoveryLimit || 5000,
    },
    sourceType: 'discovery',
    sourceId: providerId,
    priority: 5,
  });

  return { success: true, message: 'Discovery started' };
}

/**
 * Classify discovered pages using AI to determine which are grant pages.
 * Enqueues scrape jobs — classification happens in the classification handler.
 */
export async function classifyDiscoveredPages(
  providerId: string,
  userId: string,
  batchSize = 20
) {
  const provider = await db.grantProvider.findUnique({ where: { id: providerId } });
  if (!provider || provider.userId !== userId) {
    throw new Error('Provider not found');
  }

  const pendingPages = await db.discoveredPage.findMany({
    where: { providerId, classificationStatus: 'pending' },
    take: batchSize,
  });

  if (pendingPages.length === 0) {
    return { classified: 0 };
  }

  const userSettings = await getUserSettingsInternal(userId);
  if (!userSettings?.aiApiKey) {
    throw new Error('AI API key not configured. Set it in Settings.');
  }

  const { enqueueJob } = await import('@/lib/services/job-queue');

  for (const page of pendingPages) {
    await enqueueJob({
      userId,
      type: 'scrape',
      url: page.url,
      options: { formats: ['markdown'] },
      sourceType: 'classification',
      sourceId: page.id,
      priority: 5,
    });
  }

  return { classified: pendingPages.length, message: 'Classification jobs enqueued' };
}

/**
 * Human confirms/rejects a discovered page.
 * If confirmed as grant: creates a GrantScheme and triggers extraction.
 */
export async function confirmGrantPage(
  pageId: string,
  userId: string,
  decision: 'grant' | 'not_grant'
) {
  const page = await db.discoveredPage.findUnique({
    where: { id: pageId },
    include: { provider: true },
  });

  if (!page || page.provider.userId !== userId) {
    throw new Error('Page not found');
  }

  const status = decision === 'grant' ? 'confirmed_grant' : 'confirmed_not_grant';

  if (decision === 'grant') {
    // Create a GrantScheme for this confirmed page
    const grantScheme = await db.grantScheme.create({
      data: {
        providerId: page.providerId,
        sourceUrl: page.url,
        name: page.title || 'Untitled Grant',
        providerName: page.provider.name,
        status: 'unknown',
      },
    });

    await db.discoveredPage.update({
      where: { id: pageId },
      data: {
        classificationStatus: status,
        humanVerified: true,
        humanDecision: decision,
        grantSchemeId: grantScheme.id,
      },
    });

    // Update provider grant count
    const grantCount = await db.grantScheme.count({ where: { providerId: page.providerId } });
    await db.grantProvider.update({
      where: { id: page.providerId },
      data: { totalGrantsFound: grantCount },
    });

    // Fire-and-forget: auto-extract grant data from the confirmed page
    extractGrantData(grantScheme.id, userId).catch(err =>
      console.error('Auto-extraction error:', err)
    );

    return { grantSchemeId: grantScheme.id };
  } else {
    await db.discoveredPage.update({
      where: { id: pageId },
      data: {
        classificationStatus: status,
        humanVerified: true,
        humanDecision: decision,
      },
    });

    return { grantSchemeId: null };
  }
}

/**
 * Bulk review: confirm/reject multiple pages at once.
 */
export async function bulkReviewPages(
  providerId: string,
  userId: string,
  reviews: Array<{ pageId: string; decision: 'grant' | 'not_grant' }>
) {
  const provider = await db.grantProvider.findUnique({ where: { id: providerId } });
  if (!provider || provider.userId !== userId) {
    throw new Error('Provider not found');
  }

  const results = [];
  for (const review of reviews) {
    try {
      const result = await confirmGrantPage(review.pageId, userId, review.decision);
      results.push({ pageId: review.pageId, ...result, success: true });
    } catch (err) {
      results.push({ pageId: review.pageId, success: false, error: (err as Error).message });
    }
  }

  return results;
}

/**
 * Check if a URL matches any of the ignore patterns.
 * Patterns are glob-like: * matches any non-slash chars, ** matches anything.
 */
export function matchesIgnorePattern(url: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false;
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return false;
  }

  for (const pattern of patterns) {
    const regexStr = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape special regex chars (not *)
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/\{\{GLOBSTAR\}\}/g, '.*');
    const regex = new RegExp(`^${regexStr}$`);
    if (regex.test(pathname)) return true;
  }
  return false;
}

/**
 * Add an ignore pattern to a provider. Retroactively marks matching pending pages.
 */
export async function addIgnorePattern(providerId: string, userId: string, pattern: string) {
  const provider = await db.grantProvider.findUnique({ where: { id: providerId } });
  if (!provider || provider.userId !== userId) {
    throw new Error('Provider not found');
  }

  if (provider.ignorePatterns.includes(pattern)) {
    return { added: false, retroactivelyIgnored: 0 };
  }

  await db.grantProvider.update({
    where: { id: providerId },
    data: { ignorePatterns: { push: pattern } },
  });

  // Retroactively mark matching pending pages
  const pendingPages = await db.discoveredPage.findMany({
    where: { providerId, classificationStatus: 'pending' },
  });

  let retroactivelyIgnored = 0;
  for (const page of pendingPages) {
    if (matchesIgnorePattern(page.url, [pattern])) {
      await db.discoveredPage.update({
        where: { id: page.id },
        data: { classificationStatus: 'confirmed_not_grant' },
      });
      retroactivelyIgnored++;
    }
  }

  return { added: true, retroactivelyIgnored };
}

/**
 * Remove an ignore pattern from a provider.
 */
export async function removeIgnorePattern(providerId: string, userId: string, pattern: string) {
  const provider = await db.grantProvider.findUnique({ where: { id: providerId } });
  if (!provider || provider.userId !== userId) {
    throw new Error('Provider not found');
  }

  const filtered = provider.ignorePatterns.filter(p => p !== pattern);
  await db.grantProvider.update({
    where: { id: providerId },
    data: { ignorePatterns: filtered },
  });

  return { removed: true };
}

/**
 * Classify a single discovered page using AI.
 * Enqueues a scrape job — classification happens in the classification handler.
 */
export async function classifySinglePage(pageId: string, userId: string) {
  const page = await db.discoveredPage.findUnique({
    where: { id: pageId },
    include: { provider: true },
  });

  if (!page || page.provider.userId !== userId) {
    throw new Error('Page not found');
  }

  const userSettings = await getUserSettingsInternal(userId);
  if (!userSettings?.aiApiKey) {
    throw new Error('AI API key not configured. Set it in Settings.');
  }

  const { enqueueJob } = await import('@/lib/services/job-queue');

  await enqueueJob({
    userId,
    type: 'scrape',
    url: page.url,
    options: { formats: ['markdown'] },
    sourceType: 'classification',
    sourceId: page.id,
    priority: 1, // User-triggered single classification
  });

  return { classified: true, message: 'Classification job enqueued' };
}

// ─── URL Pattern Triage ──────────────────────────────────────

export interface UrlPatternGroup {
  pattern: string;
  count: number;
  examples: string[];
  pageIds: string[];
}

/**
 * Groups pending pages by URL path segments using adaptive depth.
 * Recursively splits oversized/dominant groups until they're meaningful.
 * Skips pages already matching existing ignore patterns.
 */
export function groupUrlsByPattern(
  pages: Array<{ id: string; url: string }>,
  existingIgnorePatterns: string[]
): UrlPatternGroup[] {
  const MAX_DEPTH = 4;
  const MAX_GROUPS = 25;
  const SPLIT_MIN_COUNT = 20;
  const SPLIT_DOMINANCE = 0.4;
  const MERGE_THRESHOLD = 3;

  type ParsedPage = { id: string; url: string; segments: string[] };

  // Pre-parse all pages, filtering out ignored ones
  const parsed: ParsedPage[] = [];
  for (const page of pages) {
    if (matchesIgnorePattern(page.url, existingIgnorePatterns)) continue;
    let segments: string[] = [];
    try {
      segments = new URL(page.url).pathname.split('/').filter(Boolean);
    } catch {
      // leave segments empty
    }
    parsed.push({ id: page.id, url: page.url, segments });
  }

  if (parsed.length === 0) return [];

  // Group pages by their first N path segments
  function groupAtDepth(
    items: ParsedPage[],
    depth: number
  ): Map<string, ParsedPage[]> {
    const groups = new Map<string, ParsedPage[]>();
    for (const item of items) {
      const key =
        item.segments.length > 0
          ? '/' + item.segments.slice(0, depth).join('/')
          : '';
      const list = groups.get(key);
      if (list) list.push(item);
      else groups.set(key, [item]);
    }
    return groups;
  }

  // Recursively split groups that are large AND dominant
  function adaptiveSplit(
    groups: Map<string, ParsedPage[]>,
    totalCount: number,
    currentDepth: number
  ): Map<string, ParsedPage[]> {
    if (currentDepth >= MAX_DEPTH) return groups;

    const result = new Map<string, ParsedPage[]>();
    let didSplit = false;

    for (const [key, items] of groups) {
      if (
        items.length > SPLIT_MIN_COUNT &&
        items.length / totalCount > SPLIT_DOMINANCE
      ) {
        // Try splitting this group one level deeper
        const subGroups = groupAtDepth(items, currentDepth + 1);
        if (subGroups.size > 1) {
          didSplit = true;
          for (const [subKey, subItems] of subGroups) {
            result.set(subKey, subItems);
          }
          continue;
        }
      }
      result.set(key, items);
    }

    // If we split anything, recurse to check the new groups
    if (didSplit) {
      return adaptiveSplit(result, totalCount, currentDepth + 1);
    }
    return result;
  }

  // Start at depth 1 and adaptively split
  let groups = groupAtDepth(parsed, 1);
  groups = adaptiveSplit(groups, parsed.length, 1);

  // Merge tiny fragments (<MERGE_THRESHOLD) back under parent pattern
  if (groups.size > MAX_GROUPS) {
    const sorted = [...groups.entries()].sort(
      (a, b) => b[1].length - a[1].length
    );
    const kept = new Map<string, ParsedPage[]>();
    const overflow: ParsedPage[] = [];
    for (const [key, items] of sorted) {
      if (kept.size < MAX_GROUPS - 1) {
        kept.set(key, items);
      } else {
        overflow.push(...items);
      }
    }
    if (overflow.length > 0) {
      // Group overflow by depth-1 parent
      for (const item of overflow) {
        const parentKey =
          item.segments.length > 0 ? '/' + item.segments[0] : '';
        const existing = kept.get(parentKey);
        if (existing) existing.push(item);
        else kept.set(parentKey, [item]);
      }
    }
    groups = kept;
  } else if (groups.size > 1) {
    // Merge tiny groups into their depth-1 parent
    const tiny: ParsedPage[] = [];
    const tinyKeys: string[] = [];
    for (const [key, items] of groups) {
      if (items.length < MERGE_THRESHOLD) {
        tiny.push(...items);
        tinyKeys.push(key);
      }
    }
    if (tiny.length > 0 && tinyKeys.length > 0) {
      for (const key of tinyKeys) groups.delete(key);
      // Re-group tiny items at depth 1
      for (const item of tiny) {
        const parentKey =
          item.segments.length > 0 ? '/' + item.segments[0] : '';
        const existing = groups.get(parentKey);
        if (existing) existing.push(item);
        else groups.set(parentKey, [item]);
      }
    }
  }

  return Array.from(groups.entries())
    .map(([prefix, items]) => ({
      pattern: prefix ? `${prefix}/**` : '/**',
      count: items.length,
      examples: items.slice(0, 3).map((p) => p.url),
      pageIds: items.map((p) => p.id),
    }))
    .sort((a, b) => b.count - a.count);
}

type TriageModel = 'claude-sonnet-4' | 'gemini-2.5-pro';

/**
 * Call AI to triage URL patterns. Supports Claude and Gemini via direct fetch.
 */
export async function triageUrlPatternsWithAI(
  providerName: string,
  domain: string,
  groups: UrlPatternGroup[],
  model: TriageModel
): Promise<TriageResult> {
  const userPrompt = buildTriageUserPrompt(
    providerName,
    domain,
    groups.map(g => ({ pattern: g.pattern, count: g.count, examples: g.examples }))
  );

  let rawText: string;

  if (model === 'claude-sonnet-4') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        temperature: 0.2,
        system: TRIAGE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    rawText = data.content[0].text;
  } else {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY not configured');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: `${TRIAGE_SYSTEM_PROMPT}\n\n${userPrompt}` }] },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    rawText = data.candidates[0].content.parts[0].text;
  }

  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = rawText.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  const parsed = JSON.parse(jsonStr);
  return TriageResultSchema.parse(parsed);
}

/**
 * Orchestrator: runs triage for a provider's pending pages.
 */
export async function runTriageForProvider(
  providerId: string,
  userId: string,
  model: TriageModel
) {
  const provider = await db.grantProvider.findUnique({ where: { id: providerId } });
  if (!provider || provider.userId !== userId) {
    throw new Error('Provider not found');
  }

  const pendingPages = await db.discoveredPage.findMany({
    where: { providerId, classificationStatus: 'pending' },
    select: { id: true, url: true },
  });

  if (pendingPages.length === 0) {
    return { recommendations: [], message: 'No pending pages to triage' };
  }

  const groups = groupUrlsByPattern(pendingPages, provider.ignorePatterns);

  if (groups.length === 0) {
    return { recommendations: [], message: 'All pending pages match existing ignore patterns' };
  }

  const domain = provider.domain;
  const result = await triageUrlPatternsWithAI(provider.name, domain, groups, model);

  // Merge AI recommendations with group metadata (count, examples, pageIds)
  const enriched = result.recommendations.map(rec => {
    const group = groups.find(g => g.pattern === rec.pattern);
    return {
      ...rec,
      count: group?.count || 0,
      examples: group?.examples || [],
      pageIds: group?.pageIds || [],
    };
  });

  return { recommendations: enriched };
}
