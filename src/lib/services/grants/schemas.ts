import { z } from 'zod';

// Zod schema for Firecrawl `extract` format.
// Only fields that can be reliably extracted from grant pages.
// fullMarkdown comes from the `markdown` format, not from extract.
// sourceUrl and providerName are known from context.
export const GrantExtractionSchema = z.object({
  name: z.string().describe('The official name of the grant scheme'),
  providerName: z.string().describe('The organization offering the grant'),
  summary: z
    .string()
    .nullable()
    .describe('2-3 sentence summary of the grant purpose, in Norwegian'),
  status: z
    .enum(['active', 'closed', 'upcoming', 'unknown'])
    .describe('Is the grant currently accepting applications?'),
  fundingType: z
    .enum(['tilskudd', 'lån', 'garanti'])
    .nullable()
    .describe('Funding type: tilskudd, lån, or garanti'),
  applicationDeadline: z
    .string()
    .nullable()
    .describe('Next deadline as ISO date (YYYY-MM-DD), or null if not stated'),
  isRollingDeadline: z
    .boolean()
    .describe('True if løpende or continuous applications'),
  ragContent: z
    .string()
    .nullable()
    .describe('200-400 word Norwegian description optimized for embedding-based semantic matching. Sector-specific, activity-focused, no generic boilerplate.'),
});

export type GrantExtraction = z.infer<typeof GrantExtractionSchema>;

// Schema for AI classification response
export const ClassificationResultSchema = z.object({
  isGrantPage: z.boolean(),
  isListingPage: z.boolean(),
  confidence: z.number().min(0).max(100),
  reasoning: z.string(),
  grantName: z.string().nullable(),
  linkedGrantUrls: z.array(z.string()),
});

export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

// Schema for change analysis response
export const ChangeAnalysisSchema = z.object({
  changeTypes: z.array(z.string()),
  severity: z.enum(['low', 'medium', 'high']),
  requiresReExtraction: z.boolean(),
  summary: z.string(),
});

export type ChangeAnalysis = z.infer<typeof ChangeAnalysisSchema>;

// Schema for AI triage of URL patterns
export const TriageRecommendationSchema = z.object({
  pattern: z.string(),
  category: z.enum(['grant', 'not_grant', 'uncertain']),
  confidence: z.number().min(0).max(100),
  reasoning: z.string(),
});

export type TriageRecommendation = z.infer<typeof TriageRecommendationSchema>;

export const TriageResultSchema = z.object({
  recommendations: z.array(TriageRecommendationSchema),
});

export type TriageResult = z.infer<typeof TriageResultSchema>;

// Firecrawl extract schema as plain JSON Schema (required by Firecrawl SDK)
export const FIRECRAWL_GRANT_EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'The official name of the grant scheme' },
    providerName: { type: 'string', description: 'The organization offering the grant' },
    summary: {
      type: ['string', 'null'],
      description: '2-3 sentence summary of the grant purpose, in Norwegian',
    },
    status: {
      type: 'string',
      enum: ['active', 'closed', 'upcoming', 'unknown'],
      description: 'Is the grant currently accepting applications?',
    },
    fundingType: {
      type: ['string', 'null'],
      enum: ['tilskudd', 'lån', 'garanti', null],
      description: 'Funding type: tilskudd (grant), lån (loan), or garanti (guarantee). Null if unclear.',
    },
    applicationDeadline: {
      type: ['string', 'null'],
      description: 'Next deadline as ISO date (YYYY-MM-DD), or null if not stated',
    },
    isRollingDeadline: {
      type: 'boolean',
      description: 'True if løpende or continuous applications',
    },
    ragContent: {
      type: ['string', 'null'],
      description: '200-400 word Norwegian description optimized for embedding-based semantic matching against company queries. Focus on: specific sectors and company types this targets, activities funded using formal grant terms (investering, FoU, kompetanseheving, internasjonalisering), and thematic focus (innovasjon, bærekraft, grønn omstilling). NEVER include generic compliance boilerplate (ansvarlig næringsliv, bærekraftsrisiko, statsstøtteregelverket). Every sentence must distinguish this grant from others. Write as continuous prose.',
    },
  },
  required: ['name', 'providerName', 'status', 'isRollingDeadline', 'ragContent'],
};

// Firecrawl actions to expand accordion sections on grant pages.
// Clicks all collapsed accordion buttons before scraping so fullMarkdown
// includes hidden content. Safe on pages without accordions — the selector
// matches nothing and scrape proceeds normally.
export const GRANT_SCRAPE_ACTIONS = [
  { type: 'wait' as const, milliseconds: 2000 },
  { type: 'click' as const, selector: 'button[aria-expanded="false"]', all: true },
  { type: 'wait' as const, milliseconds: 1500 },
  { type: 'scrape' as const },
] as const;

export const GRANT_SCRAPE_WAIT_FOR = 2000;
