// AI Prompts for grant scheme discovery, classification, and extraction.
// Norwegian-aware prompts that handle both Norwegian and English grant terminology.

export const CLASSIFICATION_SYSTEM_PROMPT = `You are an expert at identifying Norwegian grant and funding scheme pages.

Your task: Determine if a web page describes a specific grant/funding scheme (tilskuddsordning, støtteordning), is a listing page that links to grants, or is neither.

GRANT PAGE indicators:
- Describes a specific funding scheme with a name
- Contains terms: tilskudd, støtte, støtteordning, tilskuddsordning, søknadsfrist, søk her
- Has details about who can apply (søker/mottaker), what for, how to apply
- Has application deadlines or mentions "løpende" (rolling) applications

LISTING PAGE indicators:
- Contains links to multiple grant schemes
- Is a directory/overview page of funding programs
- Titles like "Våre tilskuddsordninger", "Støtteordninger", "Finansiering"

NOT A GRANT PAGE:
- General news articles mentioning grants
- Blog posts, press releases
- Internal process/admin pages
- Generic "about us" pages
- Job listings, procurement pages

Return JSON:
{
  "isGrantPage": boolean,
  "isListingPage": boolean,
  "confidence": number (0-100),
  "reasoning": "Brief explanation in English",
  "grantName": "Name of the grant if isGrantPage" | null,
  "linkedGrantUrls": ["URLs to grant pages if isListingPage"] | []
}`;

export function buildClassificationUserPrompt(url: string, markdown: string): string {
  // Truncate markdown to avoid token limits
  const truncated = markdown.length > 8000 ? markdown.substring(0, 8000) + '\n\n[TRUNCATED]' : markdown;
  return `URL: ${url}

Page content:
${truncated}

Classify this page.`;
}

export const EXTRACTION_SYSTEM_PROMPT = `You are extracting structured data from a Norwegian grant/funding scheme page.

CRITICAL RULES:
1. Only extract what is EXPLICITLY stated on the page. Never guess or infer.
2. If a field value is not clearly stated, return null.
3. Handle Norwegian terms:
   - Deadlines: "søknadsfrist", "frist", "løpende" (= rolling)
   - Status: MUST be exactly one of: "active", "closed", "upcoming", "unknown"
     Map: "åpen"/"open" = active, "stengt"/"closed" = closed, "kommende" = upcoming
   - Funding type: MUST be exactly one of: "tilskudd", "lån", "garanti", or null if unclear
4. For applicationDeadline: return ISO date string (YYYY-MM-DD) or null
5. For isRollingDeadline: true only if page explicitly says "løpende" or "continuous"
6. For status: if the page has a past deadline and no indication of being active, return "closed"
7. For summary: write 2-3 sentences in Norwegian summarizing the grant purpose
8. For ragContent: Write a 200-400 word Norwegian description optimized for semantic search matching.
   Cover these dimensions in this order:
   a) Target audience: Who can apply? Company size, stage, sector, geographic requirements.
   b) Purpose and activities: What does the grant fund? What activities/costs are covered?
   c) Amounts: How much funding? What percentage of costs?
   d) Key eligibility criteria: Important requirements and exclusions.
   e) Thematic focus: Innovation, sustainability, export, digitalization, etc.
   Use formal grant terminology. Write as flowing prose, not bullet points.
   This text will be used for embedding-based semantic matching against company profiles.

Return ONLY the structured data. Do not add fields not in the schema.`;

export const CHANGE_ANALYSIS_SYSTEM_PROMPT = `You analyze changes detected on Norwegian grant/funding scheme pages.

Given a diff of changes, determine:
1. What types of changes occurred
2. How significant they are
3. Whether structured data needs re-extraction

Change types:
- "content_updated": General content changes
- "deadline_changed": Application deadline modified
- "status_changed": Grant opened, closed, or status changed
- "new_grant": New grant information appeared
- "grant_removed": Grant information removed or page deleted

Return JSON:
{
  "changeTypes": ["content_updated"],
  "severity": "low" | "medium" | "high",
  "requiresReExtraction": boolean,
  "summary": "Brief description of what changed"
}`;

// ─── Triage Prompts ──────────────────────────────────────────

export const TRIAGE_SYSTEM_PROMPT = `You are an expert at classifying Norwegian government and municipal web page URL patterns.

Given a list of URL path patterns from a provider's website, classify each pattern into exactly one of three categories:

1. "grant" — These URL paths contain grant/funding scheme pages (tilskudd, støtteordninger, finansiering, søknad)
2. "not_grant" — These URL paths definitely do NOT contain grant pages (news articles, blog posts, job listings, general info pages, admin pages)
3. "uncertain" — You are not sure whether these contain grant pages or not

Norwegian grant-related URL segments often include:
- tilskudd, stotte, stonad, stipend, soknad, finansiering, ordning
- English equivalents: grant, funding, subsidy, support, scheme

Non-grant URL segments often include:
- artikkel, nyhet, nyheter, aktuelt, blogg, presse, om-oss, kontakt, jobb, ansatt, innkjop, anbud, personvern

For each pattern, provide:
- The pattern string (exactly as given)
- The category: "grant", "not_grant", or "uncertain"
- A confidence score from 0 to 100
- Brief reasoning in English

Return valid JSON matching this schema:
{
  "recommendations": [
    { "pattern": "/tilskudd/*", "category": "grant", "confidence": 95, "reasoning": "Tilskudd means grants/subsidies in Norwegian" },
    ...
  ]
}

Classify EVERY pattern given. Do not skip any.`;

export interface UrlPatternGroupForPrompt {
  pattern: string;
  count: number;
  examples: string[];
}

export function buildTriageUserPrompt(
  providerName: string,
  domain: string,
  groups: UrlPatternGroupForPrompt[]
): string {
  const groupLines = groups.map(g => {
    const exampleList = g.examples.map(e => `  - ${e}`).join('\n');
    return `Pattern: ${g.pattern} (${g.count} pages)\nExamples:\n${exampleList}`;
  }).join('\n\n');

  return `Provider: ${providerName}
Domain: ${domain}

Classify each URL pattern below:

${groupLines}`;
}

export function buildChangeAnalysisPrompt(grantName: string, diffText: string): string {
  const truncated = diffText.length > 4000 ? diffText.substring(0, 4000) + '\n\n[TRUNCATED]' : diffText;
  return `Grant scheme: ${grantName}

Changes detected:
${truncated}

Analyze these changes.`;
}
