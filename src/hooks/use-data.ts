import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Request failed');
  return res.json();
});

async function postFetcher(url: string, { arg }: { arg: Record<string, unknown> }) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arg),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
}

async function putFetcher(url: string, { arg }: { arg: Record<string, unknown> }) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arg),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
}

async function deleteFetcher(url: string, { arg }: { arg?: Record<string, unknown> } = {}) {
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    ...(arg ? { body: JSON.stringify(arg) } : {}),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
}

async function patchFetcher(url: string, { arg }: { arg: Record<string, unknown> }) {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arg),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
}

// ─── Types ───────────────────────────────────────────────────

export interface Website {
  id: string;
  url: string;
  name: string;
  isActive: boolean;
  isPaused: boolean;
  checkInterval: number;
  monitorType: string;
  scrapeProvider?: string;
  crawlLimit?: number;
  crawlDepth?: number;
  lastChecked?: string;
  createdAt: string;
  updatedAt: string;
  webhookUrl?: string | null;
  notificationType?: string | null;
  notificationPreference?: string | null;
  userId: string;
}

export interface ScrapeResult {
  id: string;
  websiteId: string;
  websiteName?: string;
  websiteUrl?: string;
  url?: string;
  markdown: string;
  changeStatus: string;
  visibility: string;
  scrapedAt: string;
  title?: string;
  description?: string;
  ogImage?: string;
  diffText?: string;
  diffJson?: unknown;
  aiIsMeaningfulChange?: boolean;
  aiMeaningfulChangeScore?: number;
  aiReasoning?: string;
  createdAt: string;
}

export interface WebhookPayload {
  id: string;
  payload: Record<string, unknown>;
  headers: Record<string, unknown>;
  method: string;
  url: string;
  status: string;
  response?: Record<string, unknown>;
  receivedAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPreview: string;
  createdAt: string;
  lastUsed?: string;
}

// ─── Websites ────────────────────────────────────────────────

export function useWebsites() {
  return useSWR<Website[]>('/api/data/websites', fetcher, { refreshInterval: 10000 });
}

export function useCreateWebsite() {
  return useSWRMutation('/api/data/websites', postFetcher);
}

export function useUpdateWebsite(id: string) {
  return useSWRMutation(`/api/data/websites/${id}`, putFetcher);
}

export function useDeleteWebsite(id: string) {
  return useSWRMutation(`/api/data/websites/${id}`, async (url: string) => {
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    return res.json();
  });
}

export function useTriggerScrape(id: string) {
  return useSWRMutation(`/api/data/websites/${id}/scrape`, postFetcher);
}

export function usePauseWebsite(id: string) {
  return useSWRMutation(`/api/data/websites/${id}/pause`, postFetcher);
}

export function useWebsiteScrapeHistory(websiteId: string | null, limit = 10) {
  return useSWR<ScrapeResult[]>(
    websiteId ? `/api/data/websites/${websiteId}/history?limit=${limit}` : null,
    fetcher,
    { refreshInterval: 10000 }
  );
}

// ─── Alerts ──────────────────────────────────────────────────

export function useUnreadAlerts() {
  return useSWR('/api/data/alerts', fetcher, { refreshInterval: 10000 });
}

export function useMarkAlertAsRead() {
  return useSWRMutation('/api/data/alerts', patchFetcher);
}

// ─── Scrape History ──────────────────────────────────────────

export function useAllScrapeHistory() {
  return useSWR<ScrapeResult[]>('/api/data/scrape-history', fetcher, { refreshInterval: 10000 });
}

export function useLatestScrapes() {
  return useSWR<Record<string, ScrapeResult>>('/api/data/latest-scrapes', fetcher, { refreshInterval: 10000 });
}

// ─── Settings ────────────────────────────────────────────────

export function useUserSettings() {
  return useSWR('/api/data/settings', fetcher);
}

export function useUpdateSettings() {
  return useSWRMutation('/api/data/settings', putFetcher);
}

// ─── Firecrawl Key ───────────────────────────────────────────

export function useFirecrawlKey() {
  return useSWR('/api/data/firecrawl-key', fetcher);
}

export function useSetFirecrawlKey() {
  return useSWRMutation('/api/data/firecrawl-key', putFetcher);
}

export function useDeleteFirecrawlKey() {
  return useSWRMutation('/api/data/firecrawl-key', async (url: string) => {
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    return res.json();
  });
}

export function useTokenUsage() {
  return useSWR('/api/data/firecrawl-key/usage', fetcher);
}

// ─── API Keys ────────────────────────────────────────────────

export function useApiKeys() {
  return useSWR<ApiKey[]>('/api/data/api-keys', fetcher);
}

export function useCreateApiKey() {
  return useSWRMutation('/api/data/api-keys', postFetcher);
}

export function useDeleteApiKey() {
  return useSWRMutation('/api/data/api-keys', deleteFetcher);
}

// ─── Quick Scrape ────────────────────────────────────────────

export interface QuickScrapeResult {
  provider: 'firecrawl' | 'jina' | 'exa';
  url: string;
  title: string;
  description: string;
  content: string;
  scrapedAt: string;
}

export function useQuickScrape() {
  return useSWRMutation<QuickScrapeResult, Error, string, Record<string, unknown>>('/api/data/quick-scrape', postFetcher);
}

// ─── Email Config ────────────────────────────────────────────

export function useEmailConfig() {
  return useSWR('/api/data/email-config', fetcher);
}

export function useUpdateEmailConfig() {
  return useSWRMutation('/api/data/email-config', putFetcher);
}

// ─── Webhook Playground ──────────────────────────────────────

export function useWebhookPayloads() {
  return useSWR<WebhookPayload[]>('/api/data/webhook-playground', fetcher, { refreshInterval: 5000 });
}

// ─── Grant Types ─────────────────────────────────────────────

export interface GrantProvider {
  id: string;
  name: string;
  domain: string;
  websiteUrl: string;
  knownListingUrls: string[];
  status: string;
  lastDiscoveryAt?: string;
  totalPagesFound: number;
  totalGrantsFound: number;
  checkFrequency: string;
  notes?: string;
  ignorePatterns: string[];
  discoveryLimit: number;
  createdAt: string;
  updatedAt: string;
  _count?: { grantSchemes: number; discoveredPages: number };
}

export interface DiscoveredPage {
  id: string;
  providerId: string;
  url: string;
  title?: string;
  classificationStatus: string;
  isGrantPage?: boolean;
  isListingPage?: boolean;
  classificationScore?: number;
  classificationReason?: string;
  classifiedAt?: string;
  humanVerified: boolean;
  humanDecision?: string;
  urlRelevanceScore?: number;
  grantSchemeId?: string;
  grantScheme?: { id: string; name: string };
  discoveredAt: string;
}

export interface GrantScheme {
  id: string;
  providerId: string;
  sourceUrl: string;
  name: string;
  providerName: string;
  summary?: string;
  fullMarkdown?: string;
  ragContent?: string;
  applicationDeadline?: string;
  isRollingDeadline: boolean;
  status: string;
  fundingType?: string;
  lastExtractedAt?: string;
  lastScrapedAt?: string;
  lastChangeAt?: string;
  changeCount: number;
  isArchived: boolean;
  archivedReason?: string;
  createdAt: string;
  updatedAt: string;
  provider?: { id: string; name: string; domain: string };
  extractedJson?: Record<string, unknown> | null;
  _count?: { changeEvents: number };
}

export interface GrantChangeEvent {
  id: string;
  grantSchemeId: string;
  changeType: string;
  summary: string;
  fieldChanges?: unknown;
  diffText?: string;
  detectedAt: string;
  isReviewed: boolean;
}

// ─── Triage Types ─────────────────────────────────────────────

export interface TriageRecommendation {
  pattern: string;
  category: 'grant' | 'not_grant' | 'uncertain';
  confidence: number;
  reasoning: string;
  count: number;
  examples: string[];
  pageIds: string[];
}

// ─── Grant Providers ─────────────────────────────────────────

export function useGrantProviders() {
  return useSWR<GrantProvider[]>('/api/data/grants/providers', fetcher, { refreshInterval: 10000 });
}

export function useGrantProvider(id: string | null) {
  return useSWR<GrantProvider>(
    id ? `/api/data/grants/providers/${id}` : null,
    fetcher
  );
}

export function useCreateGrantProvider() {
  return useSWRMutation('/api/data/grants/providers', postFetcher);
}

export function useUpdateGrantProvider(id: string) {
  return useSWRMutation(`/api/data/grants/providers/${id}`, putFetcher);
}

export function useDeleteGrantProvider(id: string) {
  return useSWRMutation(`/api/data/grants/providers/${id}`, async (url: string) => {
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    return res.json();
  });
}

export function useTriggerDiscovery(id: string) {
  return useSWRMutation(`/api/data/grants/providers/${id}/discover`, postFetcher);
}

// ─── Discovered Pages ────────────────────────────────────────

export function useDiscoveredPages(providerId: string | null, status?: string) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  const query = params.toString();
  return useSWR<DiscoveredPage[]>(
    providerId ? `/api/data/grants/providers/${providerId}/pages${query ? `?${query}` : ''}` : null,
    fetcher,
    { refreshInterval: 10000 }
  );
}

export function useReviewPages(providerId: string) {
  return useSWRMutation(`/api/data/grants/providers/${providerId}/pages/review`, postFetcher);
}

export function useAddIgnorePattern(providerId: string) {
  return useSWRMutation(`/api/data/grants/providers/${providerId}/ignore-patterns`, postFetcher);
}

export function useRemoveIgnorePattern(providerId: string) {
  return useSWRMutation(`/api/data/grants/providers/${providerId}/ignore-patterns`, deleteFetcher);
}

export function useClassifySinglePage(providerId: string) {
  return useSWRMutation(`/api/data/grants/providers/${providerId}/pages/classify`, postFetcher);
}

export function useAddDiscoveredPage(providerId: string) {
  return useSWRMutation(`/api/data/grants/providers/${providerId}/pages`, postFetcher);
}

export function useTriageProvider(providerId: string) {
  return useSWRMutation<{ recommendations: TriageRecommendation[] }, Error, string, Record<string, unknown>>(
    `/api/data/grants/providers/${providerId}/triage`,
    postFetcher
  );
}

// ─── Grant Schemes ───────────────────────────────────────────

export function useGrantSchemes(filters?: Record<string, string>) {
  const params = new URLSearchParams(filters);
  const query = params.toString();
  return useSWR<GrantScheme[]>(
    `/api/data/grants/schemes${query ? `?${query}` : ''}`,
    fetcher,
    { refreshInterval: 10000 }
  );
}

export function useGrantScheme(id: string | null) {
  return useSWR<GrantScheme & { discoveredPages: DiscoveredPage[]; changeEvents: GrantChangeEvent[] }>(
    id ? `/api/data/grants/schemes/${id}` : null,
    fetcher
  );
}

export function useTriggerExtraction(id: string) {
  return useSWRMutation(`/api/data/grants/schemes/${id}/extract`, postFetcher);
}

export function useBulkExtraction() {
  return useSWRMutation('/api/data/grants/schemes/bulk-extract', postFetcher);
}

// ─── Grant Changes ───────────────────────────────────────────

export function useGrantChanges(schemeId: string | null) {
  return useSWR<GrantChangeEvent[]>(
    schemeId ? `/api/data/grants/schemes/${schemeId}/changes` : null,
    fetcher
  );
}

export interface AggregatedGrantChange extends GrantChangeEvent {
  grantScheme: { id: string; name: string; providerName: string };
}

export function useAllGrantChanges() {
  return useSWR<AggregatedGrantChange[]>('/api/data/grants/changes', fetcher, { refreshInterval: 10000 });
}
