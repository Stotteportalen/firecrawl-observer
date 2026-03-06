-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('scrape', 'map', 'crawl', 'batch_scrape');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "job_queue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 5,
    "url" TEXT,
    "urls" JSONB,
    "options" JSONB NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),

    CONSTRAINT "job_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_queue_status_priority_createdAt_idx" ON "job_queue"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "job_queue_sourceType_sourceId_idx" ON "job_queue"("sourceType", "sourceId");
