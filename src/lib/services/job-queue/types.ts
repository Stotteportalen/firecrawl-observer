import type { JobQueue, JobType, JobStatus } from '../../../../.generated/prisma/client';

export type { JobQueue, JobType, JobStatus };

export type SourceType =
  | 'extraction'
  | 'discovery'
  | 'discovery_listing'
  | 'classification'
  | 'monitoring'
  | 'scrape'
  | 'crawl';

export interface EnqueueJobParams {
  userId: string;
  type: JobType;
  url?: string;
  urls?: string[];
  options: Record<string, unknown>;
  sourceType: SourceType;
  sourceId?: string;
  priority?: number;
  maxAttempts?: number;
}

export type JobCompletionHandler = (
  job: JobQueue,
  result: Record<string, unknown>
) => Promise<void>;

export type JobFailureHandler = (
  job: JobQueue,
  error: string
) => Promise<void>;
