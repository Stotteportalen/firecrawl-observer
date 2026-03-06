import type { JobQueue } from './types';

type CompletionHandler = (job: JobQueue, result: Record<string, unknown>) => Promise<void>;
type FailureHandler = (job: JobQueue, error: string) => Promise<void>;

const completionHandlers = new Map<string, CompletionHandler>();
const failureHandlers = new Map<string, FailureHandler>();

export function registerHandler(
  sourceType: string,
  onComplete: CompletionHandler,
  onFailure?: FailureHandler
) {
  completionHandlers.set(sourceType, onComplete);
  if (onFailure) {
    failureHandlers.set(sourceType, onFailure);
  }
}

export async function handleJobCompletion(job: JobQueue, result: Record<string, unknown>) {
  const handler = completionHandlers.get(job.sourceType);
  if (handler) {
    await handler(job, result);
  } else {
    console.warn(`No completion handler registered for sourceType: ${job.sourceType}`);
  }
}

export async function handleJobFailure(job: JobQueue, error: string) {
  const handler = failureHandlers.get(job.sourceType);
  if (handler) {
    await handler(job, error);
  }
}
