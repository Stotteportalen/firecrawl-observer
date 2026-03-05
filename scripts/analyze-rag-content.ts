/**
 * RAG Content Quality Analysis
 *
 * Evaluates the quality of AI-generated ragContent for grant schemes by having
 * Claude audit each grant's ragContent against its fullMarkdown source.
 *
 * Scores on 7 dimensions: coverage, accuracy, density, matchability,
 * specificity, terminology, missing details.
 *
 * Usage:
 *   npx tsx scripts/analyze-rag-content.ts            # 10 random grants (default)
 *   npx tsx scripts/analyze-rag-content.ts --limit 25  # 25 random grants
 *   npx tsx scripts/analyze-rag-content.ts --all        # all grants
 *   npx tsx scripts/analyze-rag-content.ts --grant-id clxyz123  # single grant
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GrantAnalysis {
  scores: {
    sectorSignal: number;
    activityKeywords: number;
    companyTargeting: number;
    geographicSignal: number;
    thematicAnchors: number;
    boilerplatePenalty: number;
    accuracy: number;
  };
  overallScore: number;
  wordCount: number;
  boilerplatePhrases: string[];
  missingKeyTerms: string[];
  hallucinations: string[];
  strengths: string[];
  weaknesses: string[];
  recommendation: 'pass' | 'needs_revision' | 'needs_rewrite';
  recommendationReason: string;
}

interface GrantResult {
  grantId: string;
  grantName: string;
  sourceUrl: string;
  providerName: string;
  analysis: GrantAnalysis | { status: 'failed'; error: string };
}

interface AnalysisReport {
  generatedAt: string;
  model: string;
  summary: {
    totalGrants: number;
    analyzed: number;
    failed: number;
    skipped: number;
    averageScores: Record<string, number>;
    scoreDistribution: Record<string, number>;
    recommendations: Record<string, number>;
    commonBoilerplate: { phrase: string; count: number }[];
    commonMissingTerms: { term: string; count: number }[];
    commonWeaknesses: string[];
    avgBoilerplateCount: number;
    grantsWithHallucinations: string[];
    worstPerformers: { id: string; name: string; score: number }[];
  };
  grants: GrantResult[];
}

// ---------------------------------------------------------------------------
// CLI Args
// ---------------------------------------------------------------------------

function parseArgs(): { limit: number; all: boolean; grantId?: string } {
  const args = process.argv.slice(2);
  let limit = 10;
  let all = false;
  let grantId: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      if (isNaN(limit) || limit < 1) {
        console.error('Invalid --limit value');
        process.exit(1);
      }
      i++;
    } else if (args[i] === '--all') {
      all = true;
    } else if (args[i] === '--grant-id' && args[i + 1]) {
      grantId = args[i + 1];
      i++;
    }
  }

  return { limit, all, grantId };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Claude Analysis
// ---------------------------------------------------------------------------

const MODEL = 'claude-sonnet-4-20250514';

const ANALYSIS_SYSTEM_PROMPT = `You are a RAG content quality auditor for Norwegian grant/funding scheme descriptions.

CONTEXT: These ragContent texts are embedded (text-embedding-3-large, 1536 dims) and matched via pgvector cosine similarity against search queries generated from company profiles. Queries look like:
- "grønn teknologi maritime bedrifter vestland"
- "fornybar energi havteknologi SMB"
- "Gårdbruker med melkeproduksjon planlegger å modernisere driften gjennom investering i ny driftsbygning"
- "eksportstøtte bedrift internasjonal vekst"
- "innovasjonsstøtte bærekraftig energiproduksjon"

Queries encode: SECTOR/INDUSTRY + ACTIVITY TYPE + COMPANY TYPE + REGION + THEMATIC FOCUS.
The minScore threshold is 0.3 (cosine similarity). Every word in ragContent affects the embedding vector — boilerplate wastes embedding space and dilutes the signal that distinguishes this grant from others.

Your job: evaluate whether ragContent will be FOUND by the right company queries and NOT found by wrong ones.

You will receive:
1. The ragContent being evaluated
2. The fullMarkdown source text (ground truth)

Score each dimension from 1-10:

1. SECTOR SIGNAL DENSITY (weight: 2x)
   Does the text contain specific sector/industry terms that matching companies would use?
   Examples: "maritim", "havbruk", "agritech", "fintech", "reiseliv", "bygg og anlegg", "helse"
   Score 10 = rich in specific sector terms from the source. Score 1 = no sector terms, could be any industry.

2. ACTIVITY KEYWORD COVERAGE (weight: 2x)
   Does the text contain the activity/purpose terms that queries encode?
   Examples: "investering", "FoU", "eksport", "kompetanseheving", "markedsutvikling", "kommersialisering", "prototyping", "internasjonalisering"
   Score 10 = activities well-described with correct terms. Score 1 = vague about what the grant actually funds.

3. COMPANY TYPE TARGETING (weight: 1x)
   Does the text clearly signal which companies should match?
   Examples: "SMB", "oppstartsbedrift", "gårdbruker", "etablert industribedrift", "mikroforetak", "vekstbedrift"
   Score 10 = clear company type signals. Score 1 = no indication of who can apply.

4. GEOGRAPHIC SIGNAL (weight: 1x)
   If the grant has geographic restrictions, are the region names present?
   Examples: "Vestland", "Nord-Norge", "Troms og Finnmark", "nasjonalt", "Svalbard"
   Score 10 = geographic scope clear (or correctly omitted for national grants). Score 1 = geographic info missing when relevant.

5. THEMATIC ANCHOR TERMS (weight: 1x)
   Does the text contain the thematic keywords that connect to company focus areas?
   Examples: "bærekraft", "grønn omstilling", "digitalisering", "innovasjon", "sirkulær økonomi", "klimateknologi"
   Score 10 = strong thematic anchors. Score 1 = no thematic signal.

6. BOILERPLATE PENALTY (weight: 2x)
   How much of the text is generic filler that appears in ALL grants and wastes embedding space?
   Common boilerplate: "ansvarlig næringsliv", "bærekraftsrisiko", "statsstøtteregelverket", "prinsipper for ansvarlig næringsliv og ha et bevisst forhold til bærekraftsrisiko"
   Score 10 = no boilerplate, every sentence is discriminative. Score 1 = dominated by repeated generic text.

7. FACTUAL ACCURACY (weight: 1x)
   Does every claim in ragContent appear in the source? Check specific claims against fullMarkdown.
   Score 10 = everything verifiable. Score 1 = fabricated claims.

Also identify:
- boilerplatePhrases: exact phrases that are generic filler wasting embedding space (be thorough)
- missingKeyTerms: specific sector/activity/thematic terms from the source that SHOULD be in ragContent for matching but are missing
- hallucinations: claims in ragContent not supported by the source
- strengths: what the ragContent does well for matching (2-4 items)
- weaknesses: what hurts matchability (2-4 items)
- recommendation: "pass" (good for matching), "needs_revision" (missing some signals), "needs_rewrite" (poor matching potential)
- recommendationReason: one sentence

Respond with ONLY valid JSON, no markdown formatting, no code blocks. Use this exact structure:
{
  "scores": {
    "sectorSignal": <1-10>,
    "activityKeywords": <1-10>,
    "companyTargeting": <1-10>,
    "geographicSignal": <1-10>,
    "thematicAnchors": <1-10>,
    "boilerplatePenalty": <1-10>,
    "accuracy": <1-10>
  },
  "boilerplatePhrases": [],
  "missingKeyTerms": [],
  "hallucinations": [],
  "strengths": [],
  "weaknesses": [],
  "recommendation": "pass" | "needs_revision" | "needs_rewrite",
  "recommendationReason": ""
}`;

function buildUserPrompt(ragContent: string, fullMarkdown: string): string {
  // Truncate fullMarkdown to ~12k chars to stay within context limits
  const maxSourceLength = 12000;
  const truncatedSource =
    fullMarkdown.length > maxSourceLength
      ? fullMarkdown.slice(0, maxSourceLength) + '\n\n[...truncated...]'
      : fullMarkdown;

  return `## ragContent to evaluate:
${ragContent}

## Source text (fullMarkdown) — ground truth:
${truncatedSource}`;
}

function computeOverallScore(scores: GrantAnalysis['scores']): number {
  // sectorSignal 2x, activityKeywords 2x, boilerplatePenalty 2x, rest 1x
  const weighted =
    scores.sectorSignal * 2 +
    scores.activityKeywords * 2 +
    scores.companyTargeting +
    scores.geographicSignal +
    scores.thematicAnchors +
    scores.boilerplatePenalty * 2 +
    scores.accuracy;
  const totalWeight = 10; // 2+2+1+1+1+2+1
  return Math.round((weighted / totalWeight) * 10) / 10;
}

function parseAnalysisResponse(rawText: string): GrantAnalysis {
  let jsonStr = rawText.trim();

  // Try direct JSON parse first
  try {
    const parsed = JSON.parse(jsonStr);
    return buildAnalysis(parsed);
  } catch {
    // Fall through to code block extraction
  }

  // Extract from markdown code blocks
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
    const parsed = JSON.parse(jsonStr);
    return buildAnalysis(parsed);
  }

  throw new Error('Could not parse JSON from response');
}

function buildAnalysis(parsed: any): GrantAnalysis {
  const scores = {
    sectorSignal: Number(parsed.scores?.sectorSignal) || 0,
    activityKeywords: Number(parsed.scores?.activityKeywords) || 0,
    companyTargeting: Number(parsed.scores?.companyTargeting) || 0,
    geographicSignal: Number(parsed.scores?.geographicSignal) || 0,
    thematicAnchors: Number(parsed.scores?.thematicAnchors) || 0,
    boilerplatePenalty: Number(parsed.scores?.boilerplatePenalty) || 0,
    accuracy: Number(parsed.scores?.accuracy) || 0,
  };

  return {
    scores,
    overallScore: computeOverallScore(scores),
    wordCount: 0, // filled by caller
    boilerplatePhrases: parsed.boilerplatePhrases || [],
    missingKeyTerms: parsed.missingKeyTerms || [],
    hallucinations: parsed.hallucinations || [],
    strengths: parsed.strengths || [],
    weaknesses: parsed.weaknesses || [],
    recommendation: parsed.recommendation || 'needs_revision',
    recommendationReason: parsed.recommendationReason || '',
  };
}

async function analyzeGrant(
  ragContent: string,
  fullMarkdown: string,
  apiKey: string
): Promise<GrantAnalysis> {
  const userPrompt = buildUserPrompt(ragContent, fullMarkdown);
  const maxRetries = 2;
  let backoffMs = 30000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        temperature: 0.1,
        system: ANALYSIS_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (response.status === 429) {
      if (attempt < maxRetries) {
        console.log(`  Rate limited, waiting ${backoffMs / 1000}s...`);
        await sleep(backoffMs);
        backoffMs *= 2;
        continue;
      }
      throw new Error('Rate limited after max retries');
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const rawText = data.content[0].text;
    return parseAnalysisResponse(rawText);
  }

  throw new Error('Exhausted retries');
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

function computeAggregation(results: GrantResult[]): AnalysisReport['summary'] {
  const analyzed = results.filter(
    (r) => !('status' in r.analysis)
  ) as (GrantResult & { analysis: GrantAnalysis })[];
  const failed = results.length - analyzed.length;

  // Average scores
  const scoreDimensions = [
    'sectorSignal',
    'activityKeywords',
    'companyTargeting',
    'geographicSignal',
    'thematicAnchors',
    'boilerplatePenalty',
    'accuracy',
  ] as const;

  const averageScores: Record<string, number> = {};
  if (analyzed.length > 0) {
    for (const dim of scoreDimensions) {
      const sum = analyzed.reduce((acc, r) => acc + r.analysis.scores[dim], 0);
      averageScores[dim] = Math.round((sum / analyzed.length) * 10) / 10;
    }
  }

  // Score distribution (by overallScore)
  const scoreDistribution: Record<string, number> = {
    '1-3': 0,
    '4-6': 0,
    '7-8': 0,
    '9-10': 0,
  };
  for (const r of analyzed) {
    const s = r.analysis.overallScore;
    if (s <= 3) scoreDistribution['1-3']++;
    else if (s <= 6) scoreDistribution['4-6']++;
    else if (s <= 8) scoreDistribution['7-8']++;
    else scoreDistribution['9-10']++;
  }

  // Recommendation counts
  const recommendations: Record<string, number> = {
    pass: 0,
    needs_revision: 0,
    needs_rewrite: 0,
  };
  for (const r of analyzed) {
    recommendations[r.analysis.recommendation] =
      (recommendations[r.analysis.recommendation] || 0) + 1;
  }

  // Common boilerplate phrases (frequency across grants)
  const boilerplateFreq = new Map<string, number>();
  for (const r of analyzed) {
    for (const phrase of r.analysis.boilerplatePhrases) {
      const normalized = phrase.toLowerCase();
      boilerplateFreq.set(normalized, (boilerplateFreq.get(normalized) || 0) + 1);
    }
  }
  const commonBoilerplate = Array.from(boilerplateFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([phrase, count]) => ({ phrase, count }));

  // Common missing key terms
  const missingTermFreq = new Map<string, number>();
  for (const r of analyzed) {
    for (const term of r.analysis.missingKeyTerms) {
      const normalized = term.toLowerCase();
      missingTermFreq.set(normalized, (missingTermFreq.get(normalized) || 0) + 1);
    }
  }
  const commonMissingTerms = Array.from(missingTermFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([term, count]) => ({ term, count }));

  // Common weaknesses
  const weaknessFreq = new Map<string, number>();
  for (const r of analyzed) {
    for (const w of r.analysis.weaknesses) {
      const normalized = w.toLowerCase();
      weaknessFreq.set(normalized, (weaknessFreq.get(normalized) || 0) + 1);
    }
  }
  const commonWeaknesses = Array.from(weaknessFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([issue]) => issue);

  // Grants with hallucinations
  const grantsWithHallucinations = analyzed
    .filter((r) => r.analysis.hallucinations.length > 0)
    .map((r) => r.grantId);

  // Boilerplate stats
  const avgBoilerplateCount = analyzed.length > 0
    ? Math.round((analyzed.reduce((acc, r) => acc + r.analysis.boilerplatePhrases.length, 0) / analyzed.length) * 10) / 10
    : 0;

  // Worst 5 performers
  const worstPerformers = [...analyzed]
    .sort((a, b) => a.analysis.overallScore - b.analysis.overallScore)
    .slice(0, 5)
    .map((r) => ({
      id: r.grantId,
      name: r.grantName,
      score: r.analysis.overallScore,
    }));

  return {
    totalGrants: results.length,
    analyzed: analyzed.length,
    failed,
    skipped: 0,
    averageScores,
    scoreDistribution,
    recommendations,
    commonBoilerplate,
    commonMissingTerms,
    commonWeaknesses,
    avgBoilerplateCount,
    grantsWithHallucinations,
    worstPerformers,
  };
}

// ---------------------------------------------------------------------------
// Console Output
// ---------------------------------------------------------------------------

function printGrantResult(result: GrantResult, index: number) {
  if ('status' in result.analysis) {
    console.log(
      `  ${index + 1}. ✗ ${result.grantName} — FAILED: ${result.analysis.error}`
    );
    return;
  }

  const a = result.analysis;
  const emoji =
    a.recommendation === 'pass'
      ? '✓'
      : a.recommendation === 'needs_revision'
        ? '~'
        : '✗';
  const tags: string[] = [];
  if (a.hallucinations.length > 0) tags.push(`${a.hallucinations.length} halluc.`);
  if (a.boilerplatePhrases.length > 0) tags.push(`${a.boilerplatePhrases.length} boilerplate`);
  if (a.missingKeyTerms.length > 0) tags.push(`${a.missingKeyTerms.length} missing terms`);
  const tagStr = tags.length > 0 ? ` [${tags.join(', ')}]` : '';
  console.log(
    `  ${index + 1}. ${emoji} ${a.overallScore.toFixed(1)} — ${result.grantName} (${a.recommendation})${tagStr}`
  );
}

function printSummary(summary: AnalysisReport['summary']) {
  console.log('\n' + '='.repeat(70));
  console.log('AGGREGATE RESULTS');
  console.log('='.repeat(70));

  console.log(`\nTotal: ${summary.totalGrants} | Analyzed: ${summary.analyzed} | Failed: ${summary.failed}`);

  console.log('\nAverage Scores:');
  for (const [dim, score] of Object.entries(summary.averageScores)) {
    const bar = '█'.repeat(Math.round(score)) + '░'.repeat(10 - Math.round(score));
    console.log(`  ${dim.padEnd(16)} ${bar} ${score.toFixed(1)}`);
  }

  console.log('\nScore Distribution:');
  for (const [bucket, count] of Object.entries(summary.scoreDistribution)) {
    console.log(`  ${bucket.padEnd(6)} ${'■'.repeat(count)} ${count}`);
  }

  console.log('\nRecommendations:');
  for (const [rec, count] of Object.entries(summary.recommendations)) {
    console.log(`  ${rec.padEnd(16)} ${count}`);
  }

  if (summary.commonBoilerplate.length > 0) {
    console.log(`\nMost common boilerplate (avg ${summary.avgBoilerplateCount} phrases/grant):`);
    for (const { phrase, count } of summary.commonBoilerplate.slice(0, 5)) {
      console.log(`  ${count}x "${phrase}"`);
    }
  }

  if (summary.commonMissingTerms.length > 0) {
    console.log('\nMost commonly missing key terms:');
    for (const { term, count } of summary.commonMissingTerms.slice(0, 8)) {
      console.log(`  ${count}x ${term}`);
    }
  }

  if (summary.grantsWithHallucinations.length > 0) {
    console.log(`\nGrants with hallucinations: ${summary.grantsWithHallucinations.length}`);
    for (const id of summary.grantsWithHallucinations) {
      console.log(`  - ${id}`);
    }
  }

  if (summary.commonWeaknesses.length > 0) {
    console.log('\nMost common weaknesses:');
    for (const issue of summary.commonWeaknesses.slice(0, 5)) {
      console.log(`  - ${issue}`);
    }
  }

  if (summary.worstPerformers.length > 0) {
    console.log('\nWorst performers:');
    for (const p of summary.worstPerformers) {
      console.log(`  ${p.score.toFixed(1)} — ${p.name} (${p.id})`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not found in environment');
    process.exit(1);
  }

  const { limit, all, grantId } = parseArgs();

  console.log('Fetching grants from database...');

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
  });

  let query = `
    SELECT id, name, "sourceUrl", "providerName", "ragContent", "fullMarkdown"
    FROM grant_schemes
    WHERE "fullMarkdown" IS NOT NULL
      AND "ragContent" IS NOT NULL
      AND "isArchived" = false
  `;
  const params: string[] = [];
  if (grantId) {
    query += ` AND id = $1`;
    params.push(grantId);
  }

  const result = await pool.query(query, params);
  await pool.end();

  const allGrants = result.rows as {
    id: string;
    name: string;
    sourceUrl: string;
    providerName: string;
    ragContent: string;
    fullMarkdown: string;
  }[];

  if (allGrants.length === 0) {
    console.log('No grants found matching criteria');
    process.exit(0);
  }

  const grants = grantId
    ? allGrants
    : all
      ? shuffleArray(allGrants)
      : shuffleArray(allGrants).slice(0, limit);

  console.log(
    `Found ${allGrants.length} eligible grants. Analyzing ${grants.length}.\n`
  );

  const results: GrantResult[] = [];
  let skipped = 0;

  for (let i = 0; i < grants.length; i++) {
    const grant = grants[i];

    if (!grant.ragContent || !grant.fullMarkdown) {
      skipped++;
      continue;
    }

    try {
      const analysis = await analyzeGrant(grant.ragContent, grant.fullMarkdown, apiKey);
      analysis.wordCount = grant.ragContent.split(/\s+/).length;

      const result: GrantResult = {
        grantId: grant.id,
        grantName: grant.name,
        sourceUrl: grant.sourceUrl,
        providerName: grant.providerName,
        analysis,
      };

      results.push(result);
      printGrantResult(result, i);
    } catch (error) {
      const result: GrantResult = {
        grantId: grant.id,
        grantName: grant.name,
        sourceUrl: grant.sourceUrl,
        providerName: grant.providerName,
        analysis: { status: 'failed', error: (error as Error).message },
      };
      results.push(result);
      printGrantResult(result, i);
    }

    // Rate limiting: 3s delay between calls
    if (i < grants.length - 1) {
      await sleep(3000);
    }
  }

  // Aggregation
  const summary = computeAggregation(results);
  summary.skipped = skipped;

  const report: AnalysisReport = {
    generatedAt: new Date().toISOString(),
    model: MODEL,
    summary,
    grants: results,
  };

  // Write output file
  const scriptDir = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
  const outputDir = path.join(scriptDir, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputPath = path.join(outputDir, `rag-analysis-${timestamp}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

  // Console summary
  printSummary(summary);
  console.log(`\nFull report saved to: ${outputPath}`);
}

main()
  .catch((err) => {
    console.error('Analysis error:', err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
