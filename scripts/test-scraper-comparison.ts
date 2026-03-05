/**
 * Scraper Comparison Test
 *
 * Tests Firecrawl (basic), Firecrawl (with accordion actions), Exa, and Jina
 * against the same Innovasjon Norge grant page to compare content extraction.
 *
 * Run: npx tsx scripts/test-scraper-comparison.ts
 */

import FirecrawlApp from '@mendable/firecrawl-js';
import Exa from 'exa-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIndex = trimmed.indexOf('=');
  if (eqIndex === -1) continue;
  const key = trimmed.slice(0, eqIndex);
  let value = trimmed.slice(eqIndex + 1);
  // Strip surrounding quotes
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[key] = value;
}

const TEST_URL = 'https://www.innovasjonnorge.no/tjeneste/oppstartstilskudd-1';

// The sections we expect to find (accordion content on the page)
const EXPECTED_SECTIONS = [
  'For hvem',
  'Hvem blir ikke prioritert',
  'Hva kan det brukes til',
  'Om støttebeløp',
  'Utbetaling og sluttrapportering',
];

// Quick metadata we also look for in the top section
const EXPECTED_METADATA = [
  'Tilskudd',          // Type tjeneste
  'Oppstartsbedrifter', // Målgruppe
  'Løpende',           // Søknadsfrist
  '150 000',           // Maks beløp
];

interface ScrapeResult {
  provider: string;
  success: boolean;
  error?: string;
  markdown: string;
  charCount: number;
  durationMs: number;
  sectionsFound: { name: string; found: boolean; hasContent: boolean; contentPreview: string }[];
  metadataFound: { term: string; found: boolean }[];
}

// ── Firecrawl (basic) ──────────────────────────────────────────────
async function testFirecrawlBasic(): Promise<ScrapeResult> {
  const start = Date.now();
  const provider = 'Firecrawl (basic)';
  try {
    const fc = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! });
    const result = await fc.scrapeUrl(TEST_URL, {
      formats: ['markdown'],
    }) as Record<string, unknown>;

    if (!result.success) throw new Error(String(result.error));
    const markdown = (result.markdown as string) || '';
    return buildResult(provider, markdown, Date.now() - start);
  } catch (e: unknown) {
    return errorResult(provider, e, Date.now() - start);
  }
}

// ── Firecrawl (with actions to expand accordions) ──────────────────
async function testFirecrawlWithActions(): Promise<ScrapeResult> {
  const start = Date.now();
  const provider = 'Firecrawl (actions)';
  try {
    const fc = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! });
    const result = await fc.scrapeUrl(TEST_URL, {
      formats: ['markdown'],
      waitFor: 2000,
      actions: [
        // Wait for page JS to settle
        { type: 'wait' as const, milliseconds: 2000 },
        // Click ALL accordion triggers at once (all: true clicks every match)
        { type: 'click' as const, selector: 'button[aria-expanded="false"]', all: true },
        // Wait for accordion animations to finish
        { type: 'wait' as const, milliseconds: 1500 },
        // Scrape the fully expanded page
        { type: 'scrape' as const },
      ],
    } as Record<string, unknown>) as Record<string, unknown>;

    if (!result.success) throw new Error(String(result.error));
    const markdown = (result.markdown as string) || '';
    return buildResult(provider, markdown, Date.now() - start);
  } catch (e: unknown) {
    return errorResult(provider, e, Date.now() - start);
  }
}

// ── Jina Reader ────────────────────────────────────────────────────
async function testJina(): Promise<ScrapeResult> {
  const start = Date.now();
  const provider = 'Jina';
  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Engine': 'cf-browser-rendering',
      'X-Return-Format': 'markdown',
      'X-Retain-Images': 'none',
    };
    const apiKey = process.env.JINA_API_KEY;
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const response = await fetch(`https://r.jina.ai/${TEST_URL}`, { headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const json = await response.json() as { data: { content: string } };
    const markdown = json.data.content || '';
    return buildResult(provider, markdown, Date.now() - start);
  } catch (e: unknown) {
    return errorResult(provider, e, Date.now() - start);
  }
}

// ── Exa ────────────────────────────────────────────────────────────
async function testExa(): Promise<ScrapeResult> {
  const start = Date.now();
  const provider = 'Exa';
  try {
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) throw new Error('EXA_API_KEY not set');

    const exa = new Exa(apiKey);
    const result = await exa.getContents([TEST_URL], {
      text: { maxCharacters: 50000 },
    });

    const page = result.results[0];
    if (!page) throw new Error('No results');
    const markdown = page.text || '';
    return buildResult(provider, markdown, Date.now() - start);
  } catch (e: unknown) {
    return errorResult(provider, e, Date.now() - start);
  }
}

// ── Helpers ────────────────────────────────────────────────────────
function buildResult(provider: string, markdown: string, durationMs: number): ScrapeResult {
  const sectionsFound = EXPECTED_SECTIONS.map((name) => {
    const headingIdx = markdown.toLowerCase().indexOf(name.toLowerCase());
    const found = headingIdx !== -1;

    // Try to extract content after the heading
    let hasContent = false;
    let contentPreview = '';
    if (found) {
      // Look for text after the heading (skip the heading line itself)
      const afterHeading = markdown.slice(headingIdx + name.length);
      const lines = afterHeading.split('\n').slice(1); // skip heading line
      const contentLines: string[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        // Stop at next heading or empty section
        if (trimmed.startsWith('#') || trimmed.startsWith('## ')) break;
        if (trimmed) contentLines.push(trimmed);
        if (contentLines.length >= 3) break;
      }
      hasContent = contentLines.length > 0;
      contentPreview = contentLines.join(' ').slice(0, 120);
      if (contentLines.join(' ').length > 120) contentPreview += '...';
    }

    return { name, found, hasContent, contentPreview };
  });

  const metadataFound = EXPECTED_METADATA.map((term) => ({
    term,
    found: markdown.includes(term),
  }));

  return { provider, success: true, markdown, charCount: markdown.length, durationMs, sectionsFound, metadataFound };
}

function errorResult(provider: string, e: unknown, durationMs: number): ScrapeResult {
  const error = e instanceof Error ? e.message : String(e);
  return {
    provider, success: false, error, markdown: '', charCount: 0, durationMs,
    sectionsFound: EXPECTED_SECTIONS.map((name) => ({ name, found: false, hasContent: false, contentPreview: '' })),
    metadataFound: EXPECTED_METADATA.map((term) => ({ term, found: false })),
  };
}

function printResult(r: ScrapeResult) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  ${r.provider}`);
  console.log(`${'═'.repeat(70)}`);

  if (!r.success) {
    console.log(`  ❌ FAILED: ${r.error}`);
    return;
  }

  console.log(`  ✅ Success | ${r.charCount.toLocaleString()} chars | ${(r.durationMs / 1000).toFixed(1)}s`);

  console.log('\n  📋 Metadata:');
  for (const m of r.metadataFound) {
    console.log(`    ${m.found ? '✅' : '❌'} ${m.term}`);
  }

  console.log('\n  📂 Accordion Sections:');
  for (const s of r.sectionsFound) {
    const icon = s.hasContent ? '✅' : s.found ? '⚠️  heading only' : '❌';
    console.log(`    ${icon}  ${s.name}`);
    if (s.contentPreview) {
      console.log(`       → "${s.contentPreview}"`);
    }
  }
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log('🔬 Scraper Comparison Test');
  console.log(`   URL: ${TEST_URL}`);
  console.log(`   Testing: Firecrawl (basic), Firecrawl (actions), Jina, Exa\n`);

  // Run all 4 in parallel
  const [fcBasic, fcActions, jina, exa] = await Promise.all([
    testFirecrawlBasic(),
    testFirecrawlWithActions(),
    testJina(),
    testExa(),
  ]);

  const results = [fcBasic, fcActions, jina, exa];
  for (const r of results) printResult(r);

  // Save raw markdown to files for manual inspection
  const outDir = path.resolve(__dirname, '..', 'test-output');
  fs.mkdirSync(outDir, { recursive: true });
  for (const r of results) {
    if (r.markdown) {
      const filename = r.provider.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.md';
      fs.writeFileSync(path.join(outDir, filename), r.markdown);
    }
  }

  // Summary table
  console.log(`\n\n${'═'.repeat(70)}`);
  console.log('  SUMMARY');
  console.log(`${'═'.repeat(70)}`);
  console.log('');
  const header = ['Provider', 'Chars', 'Time', 'Metadata', 'Sections (heading)', 'Sections (content)'];
  console.log(`  ${header.join(' | ')}`);
  console.log(`  ${header.map(h => '-'.repeat(h.length)).join(' | ')}`);

  for (const r of results) {
    const metaCount = r.metadataFound.filter(m => m.found).length;
    const headingCount = r.sectionsFound.filter(s => s.found).length;
    const contentCount = r.sectionsFound.filter(s => s.hasContent).length;
    console.log(`  ${[
      r.provider.padEnd(header[0].length),
      String(r.charCount).padEnd(header[1].length),
      `${(r.durationMs / 1000).toFixed(1)}s`.padEnd(header[2].length),
      `${metaCount}/${EXPECTED_METADATA.length}`.padEnd(header[3].length),
      `${headingCount}/${EXPECTED_SECTIONS.length}`.padEnd(header[4].length),
      `${contentCount}/${EXPECTED_SECTIONS.length}`.padEnd(header[5].length),
    ].join(' | ')}`);
  }

  console.log(`\n  Raw markdown saved to: ${outDir}/`);
}

main().catch(console.error);
