import { db } from '@/lib/db';
import { getFirecrawlClient } from '@/lib/services/firecrawl';
import { getUserSettingsInternal } from '@/lib/services/user-settings';
import {
  CLASSIFICATION_SYSTEM_PROMPT,
  buildClassificationUserPrompt,
  TRIAGE_SYSTEM_PROMPT,
  buildTriageUserPrompt,
} from './prompts';
import { ClassificationResultSchema, type ClassificationResult, TriageResultSchema, type TriageResult } from './schemas';
import { extractGrantData } from './extraction';
import { scoreUrlRelevance } from './url-scoring';

/**
 * Discover grant pages on a provider's domain using Firecrawl mapUrl.
 * Stores all discovered URLs as DiscoveredPage records.
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

  try {
    const firecrawl = await getFirecrawlClient(userId);

    // Use mapUrl with search filter to find grant-related pages
    const mapResult = await firecrawl.mapUrl(provider.websiteUrl, {
      search: 'tilskudd støtte grant søknad',
      includeSubdomains: true,
      limit: provider.discoveryLimit || 5000,
    }) as unknown as { success: boolean; links?: string[]; error?: string };

    if (!mapResult.success || !mapResult.links) {
      throw new Error(`mapUrl failed: ${mapResult.error || 'No links returned'}`);
    }

    const urls = mapResult.links;

    // Also scrape known listing URLs to find linked grant pages
    let listingUrls: string[] = [];
    if (provider.knownListingUrls.length > 0) {
      for (const listingUrl of provider.knownListingUrls) {
        try {
          const result = await firecrawl.scrapeUrl(listingUrl, {
            formats: ['links' as 'markdown'],
          }) as unknown as { success: boolean; links?: string[] };
          if (result.success && result.links) {
            listingUrls = [...listingUrls, ...result.links];
          }
        } catch (err) {
          console.error(`Failed to scrape listing URL ${listingUrl}:`, err);
        }
      }
    }

    // Combine and deduplicate URLs
    const allUrls = [...new Set([...urls, ...listingUrls])];

    // Upsert discovered pages
    let newPagesCount = 0;
    for (const url of allUrls) {
      try {
        const ignored = matchesIgnorePattern(url, provider.ignorePatterns);
        const relevanceScore = scoreUrlRelevance(url);
        await db.discoveredPage.upsert({
          where: {
            providerId_url: { providerId, url },
          },
          create: {
            providerId,
            url,
            classificationStatus: ignored ? 'confirmed_not_grant' : 'pending',
            urlRelevanceScore: relevanceScore,
          },
          update: {}, // Don't overwrite existing data
        });
        newPagesCount++;
      } catch (err) {
        console.error(`Failed to store discovered page ${url}:`, err);
      }
    }

    await db.grantProvider.update({
      where: { id: providerId },
      data: {
        status: 'active',
        lastDiscoveryAt: new Date(),
        totalPagesFound: allUrls.length,
      },
    });

    return { success: true, totalUrls: allUrls.length, newPages: newPagesCount };
  } catch (error) {
    await db.grantProvider.update({
      where: { id: providerId },
      data: { status: 'error' },
    });
    throw error;
  }
}

/**
 * Classify discovered pages using AI to determine which are grant pages.
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

  const firecrawl = await getFirecrawlClient(userId);
  let classified = 0;

  for (const page of pendingPages) {
    try {
      // Scrape page content
      const scrapeResult = await firecrawl.scrapeUrl(page.url, {
        formats: ['markdown'],
      }) as unknown as { success: boolean; markdown?: string; metadata?: { title?: string } };

      if (!scrapeResult.success || !scrapeResult.markdown) {
        await db.discoveredPage.update({
          where: { id: page.id },
          data: { classificationStatus: 'classified', isGrantPage: false, classificationScore: 0, classificationReason: 'Failed to scrape' },
        });
        continue;
      }

      // Update title if available
      if (scrapeResult.metadata?.title) {
        await db.discoveredPage.update({
          where: { id: page.id },
          data: { title: scrapeResult.metadata.title },
        });
      }

      // Classify with AI
      const classification = await classifyWithAI(
        page.url,
        scrapeResult.markdown,
        userSettings
      );

      if (!classification) {
        continue;
      }

      await db.discoveredPage.update({
        where: { id: page.id },
        data: {
          classificationStatus: 'classified',
          isGrantPage: classification.isGrantPage,
          isListingPage: classification.isListingPage,
          classificationScore: classification.confidence,
          classificationReason: classification.reasoning,
          classifiedAt: new Date(),
          title: scrapeResult.metadata?.title || (classification.grantName ?? page.title),
        },
      });

      // If listing page, add linked grant URLs as new discovered pages
      if (classification.isListingPage && classification.linkedGrantUrls.length > 0) {
        for (const linkedUrl of classification.linkedGrantUrls) {
          try {
            await db.discoveredPage.upsert({
              where: { providerId_url: { providerId, url: linkedUrl } },
              create: { providerId, url: linkedUrl, classificationStatus: 'pending' },
              update: {},
            });
          } catch {
            // Ignore duplicate errors
          }
        }
      }

      classified++;
    } catch (err) {
      console.error(`Failed to classify page ${page.url}:`, err);
    }
  }

  return { classified };
}

async function classifyWithAI(
  url: string,
  markdown: string,
  userSettings: Record<string, unknown> & { aiApiKey?: string | null; aiBaseUrl?: string | null; aiModel?: string | null }
): Promise<ClassificationResult | null> {
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
      console.error('AI classification API error:', await response.text());
      return null;
    }

    const data = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    return ClassificationResultSchema.parse(parsed);
  } catch (error) {
    console.error('AI classification error:', error);
    return null;
  }
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

  const firecrawl = await getFirecrawlClient(userId);

  const scrapeResult = await firecrawl.scrapeUrl(page.url, {
    formats: ['markdown'],
  }) as unknown as { success: boolean; markdown?: string; metadata?: { title?: string } };

  if (!scrapeResult.success || !scrapeResult.markdown) {
    await db.discoveredPage.update({
      where: { id: page.id },
      data: { classificationStatus: 'classified', isGrantPage: false, classificationScore: 0, classificationReason: 'Failed to scrape' },
    });
    return { classified: true, isGrantPage: false, reason: 'Failed to scrape' };
  }

  if (scrapeResult.metadata?.title) {
    await db.discoveredPage.update({
      where: { id: page.id },
      data: { title: scrapeResult.metadata.title },
    });
  }

  const classification = await classifyWithAI(
    page.url,
    scrapeResult.markdown,
    userSettings
  );

  if (!classification) {
    return { classified: false, reason: 'AI classification failed' };
  }

  await db.discoveredPage.update({
    where: { id: page.id },
    data: {
      classificationStatus: 'classified',
      isGrantPage: classification.isGrantPage,
      isListingPage: classification.isListingPage,
      classificationScore: classification.confidence,
      classificationReason: classification.reasoning,
      classifiedAt: new Date(),
      title: scrapeResult.metadata?.title || (classification.grantName ?? page.title),
    },
  });

  // If listing page, add linked grant URLs as new discovered pages
  if (classification.isListingPage && classification.linkedGrantUrls.length > 0) {
    for (const linkedUrl of classification.linkedGrantUrls) {
      try {
        await db.discoveredPage.upsert({
          where: { providerId_url: { providerId: page.providerId, url: linkedUrl } },
          create: { providerId: page.providerId, url: linkedUrl, classificationStatus: 'pending', urlRelevanceScore: scoreUrlRelevance(linkedUrl) },
          update: {},
        });
      } catch {
        // Ignore duplicate errors
      }
    }
  }

  return {
    classified: true,
    isGrantPage: classification.isGrantPage,
    isListingPage: classification.isListingPage,
    confidence: classification.confidence,
    reason: classification.reasoning,
  };
}

// ─── URL Pattern Triage ──────────────────────────────────────

export interface UrlPatternGroup {
  pattern: string;
  count: number;
  examples: string[];
  pageIds: string[];
}

/**
 * Groups pending pages by their first path segment into URL patterns.
 * Skips pages already matching existing ignore patterns.
 */
export function groupUrlsByPattern(
  pages: Array<{ id: string; url: string }>,
  existingIgnorePatterns: string[]
): UrlPatternGroup[] {
  const groups = new Map<string, { urls: string[]; pageIds: string[] }>();

  for (const page of pages) {
    if (matchesIgnorePattern(page.url, existingIgnorePatterns)) continue;

    let segment: string;
    try {
      const pathname = new URL(page.url).pathname;
      const segments = pathname.split('/').filter(Boolean);
      segment = segments.length > 0 ? `/${segments[0]}/*` : '/*';
    } catch {
      segment = '/*';
    }

    const group = groups.get(segment);
    if (group) {
      group.urls.push(page.url);
      group.pageIds.push(page.id);
    } else {
      groups.set(segment, { urls: [page.url], pageIds: [page.id] });
    }
  }

  return Array.from(groups.entries())
    .map(([pattern, { urls, pageIds }]) => ({
      pattern,
      count: urls.length,
      examples: urls.slice(0, 3),
      pageIds,
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
