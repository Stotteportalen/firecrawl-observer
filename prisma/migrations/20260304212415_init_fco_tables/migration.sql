-- CreateTable
CREATE TABLE "fco_user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fco_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fco_session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fco_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fco_account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fco_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fco_verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "fco_verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fco_api_keys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastUsed" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fco_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fco_firecrawl_api_keys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "lastUsed" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fco_firecrawl_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fco_websites" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPaused" BOOLEAN,
    "checkInterval" INTEGER NOT NULL,
    "lastChecked" TIMESTAMP(3),
    "notificationPreference" TEXT NOT NULL DEFAULT 'none',
    "webhookUrl" TEXT,
    "monitorType" TEXT NOT NULL DEFAULT 'single_page',
    "crawlLimit" INTEGER,
    "crawlDepth" INTEGER,
    "lastCrawlAt" TIMESTAMP(3),
    "totalPages" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fco_websites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fco_scrape_results" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "changeStatus" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'visible',
    "previousScrapeAt" TIMESTAMP(3),
    "scrapedAt" TIMESTAMP(3) NOT NULL,
    "firecrawlMetadata" JSONB,
    "ogImage" TEXT,
    "title" TEXT,
    "description" TEXT,
    "url" TEXT,
    "diffText" TEXT,
    "diffJson" JSONB,
    "aiMeaningfulChangeScore" DOUBLE PRECISION,
    "aiIsMeaningfulChange" BOOLEAN,
    "aiReasoning" TEXT,
    "aiAnalyzedAt" TIMESTAMP(3),
    "aiModel" TEXT,

    CONSTRAINT "fco_scrape_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fco_change_alerts" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scrapeResultId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fco_change_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fco_email_config" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT,
    "verificationExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fco_email_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fco_user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultWebhookUrl" TEXT,
    "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailTemplate" TEXT,
    "aiAnalysisEnabled" BOOLEAN DEFAULT false,
    "aiModel" TEXT,
    "aiBaseUrl" TEXT,
    "aiSystemPrompt" TEXT,
    "aiMeaningfulChangeThreshold" DOUBLE PRECISION DEFAULT 70,
    "aiApiKey" TEXT,
    "emailOnlyIfMeaningful" BOOLEAN DEFAULT false,
    "webhookOnlyIfMeaningful" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fco_user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fco_webhook_playground" (
    "id" TEXT NOT NULL,
    "payload" JSONB,
    "headers" JSONB,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "response" JSONB,

    CONSTRAINT "fco_webhook_playground_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fco_crawl_sessions" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "pagesFound" INTEGER NOT NULL DEFAULT 0,
    "pagesChanged" INTEGER,
    "pagesAdded" INTEGER,
    "pagesRemoved" INTEGER,
    "error" TEXT,
    "jobId" TEXT,

    CONSTRAINT "fco_crawl_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fco_user_email_key" ON "fco_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "fco_session_token_key" ON "fco_session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "fco_api_keys_key_key" ON "fco_api_keys"("key");

-- CreateIndex
CREATE INDEX "fco_api_keys_userId_idx" ON "fco_api_keys"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "fco_firecrawl_api_keys_userId_key" ON "fco_firecrawl_api_keys"("userId");

-- CreateIndex
CREATE INDEX "fco_websites_userId_idx" ON "fco_websites"("userId");

-- CreateIndex
CREATE INDEX "fco_websites_isActive_idx" ON "fco_websites"("isActive");

-- CreateIndex
CREATE INDEX "fco_scrape_results_websiteId_idx" ON "fco_scrape_results"("websiteId");

-- CreateIndex
CREATE INDEX "fco_scrape_results_websiteId_scrapedAt_idx" ON "fco_scrape_results"("websiteId", "scrapedAt");

-- CreateIndex
CREATE INDEX "fco_scrape_results_userId_scrapedAt_idx" ON "fco_scrape_results"("userId", "scrapedAt");

-- CreateIndex
CREATE INDEX "fco_change_alerts_userId_idx" ON "fco_change_alerts"("userId");

-- CreateIndex
CREATE INDEX "fco_change_alerts_websiteId_idx" ON "fco_change_alerts"("websiteId");

-- CreateIndex
CREATE INDEX "fco_change_alerts_userId_isRead_idx" ON "fco_change_alerts"("userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "fco_email_config_userId_key" ON "fco_email_config"("userId");

-- CreateIndex
CREATE INDEX "fco_email_config_email_idx" ON "fco_email_config"("email");

-- CreateIndex
CREATE INDEX "fco_email_config_verificationToken_idx" ON "fco_email_config"("verificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "fco_user_settings_userId_key" ON "fco_user_settings"("userId");

-- CreateIndex
CREATE INDEX "fco_webhook_playground_receivedAt_idx" ON "fco_webhook_playground"("receivedAt");

-- CreateIndex
CREATE INDEX "fco_crawl_sessions_websiteId_idx" ON "fco_crawl_sessions"("websiteId");

-- CreateIndex
CREATE INDEX "fco_crawl_sessions_userId_startedAt_idx" ON "fco_crawl_sessions"("userId", "startedAt");

-- AddForeignKey
ALTER TABLE "fco_session" ADD CONSTRAINT "fco_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "fco_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fco_account" ADD CONSTRAINT "fco_account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "fco_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fco_api_keys" ADD CONSTRAINT "fco_api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "fco_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fco_firecrawl_api_keys" ADD CONSTRAINT "fco_firecrawl_api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "fco_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fco_websites" ADD CONSTRAINT "fco_websites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "fco_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fco_scrape_results" ADD CONSTRAINT "fco_scrape_results_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "fco_websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fco_scrape_results" ADD CONSTRAINT "fco_scrape_results_userId_fkey" FOREIGN KEY ("userId") REFERENCES "fco_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fco_change_alerts" ADD CONSTRAINT "fco_change_alerts_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "fco_websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fco_change_alerts" ADD CONSTRAINT "fco_change_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "fco_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fco_change_alerts" ADD CONSTRAINT "fco_change_alerts_scrapeResultId_fkey" FOREIGN KEY ("scrapeResultId") REFERENCES "fco_scrape_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fco_email_config" ADD CONSTRAINT "fco_email_config_userId_fkey" FOREIGN KEY ("userId") REFERENCES "fco_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fco_user_settings" ADD CONSTRAINT "fco_user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "fco_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fco_crawl_sessions" ADD CONSTRAINT "fco_crawl_sessions_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "fco_websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fco_crawl_sessions" ADD CONSTRAINT "fco_crawl_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "fco_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
