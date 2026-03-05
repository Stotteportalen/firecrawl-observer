/**
 * URL heuristic scoring for grant page relevance.
 * Returns 0-100 based on URL path keyword signals.
 */

const POSITIVE_SIGNALS: Array<{ pattern: string; weight: number }> = [
  { pattern: 'tilskudd', weight: 25 },
  { pattern: 'støtte', weight: 25 },
  { pattern: 'stotte', weight: 25 },
  { pattern: 'søknad', weight: 20 },
  { pattern: 'soknad', weight: 20 },
  { pattern: 'grant', weight: 25 },
  { pattern: 'funding', weight: 25 },
  { pattern: 'tjeneste', weight: 15 },
  { pattern: 'finansiering', weight: 20 },
  { pattern: 'utlysning', weight: 20 },
  { pattern: 'program', weight: 10 },
  { pattern: 'ordning', weight: 15 },
  { pattern: 'virkemiddel', weight: 15 },
  { pattern: 'subsidy', weight: 20 },
  { pattern: 'incentive', weight: 15 },
];

const NEGATIVE_SIGNALS: Array<{ pattern: string; weight: number }> = [
  { pattern: 'artikkel', weight: -30 },
  { pattern: 'nyhetsartikkel', weight: -35 },
  { pattern: 'nyhet', weight: -25 },
  { pattern: 'blogg', weight: -30 },
  { pattern: 'blog', weight: -30 },
  { pattern: 'presse', weight: -25 },
  { pattern: 'karriere', weight: -25 },
  { pattern: 'career', weight: -25 },
  { pattern: 'om-oss', weight: -20 },
  { pattern: 'about', weight: -20 },
  { pattern: 'kontakt', weight: -20 },
  { pattern: 'contact', weight: -20 },
  { pattern: 'personvern', weight: -20 },
  { pattern: 'privacy', weight: -20 },
  { pattern: 'cookie', weight: -20 },
  { pattern: 'event', weight: -15 },
  { pattern: 'arrangement', weight: -15 },
  { pattern: 'webinar', weight: -15 },
];

export function scoreUrlRelevance(url: string): number {
  let pathname: string;
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    return 50;
  }

  let score = 50;

  for (const { pattern, weight } of POSITIVE_SIGNALS) {
    if (pathname.includes(pattern)) {
      score += weight;
    }
  }

  for (const { pattern, weight } of NEGATIVE_SIGNALS) {
    if (pathname.includes(pattern)) {
      score += weight; // weight is already negative
    }
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Suggest an ignore pattern from a URL.
 * Extracts the first path segment and appends /*
 */
export function suggestPattern(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      return `/${segments[0]}/*`;
    }
  } catch {
    // ignore
  }
  return '/*';
}
