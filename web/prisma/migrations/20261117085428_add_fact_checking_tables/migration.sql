CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "ClaimProcessingStatus" AS ENUM ('DETECTED', 'CHECKING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "FactCheckVerdict" AS ENUM ('SUPPORTED', 'REFUTED', 'PARTIALLY_SUPPORTED', 'CONTRADICTORY_EVIDENCE', 'INSUFFICIENT_EVIDENCE');

-- CreateEnum
CREATE TYPE "EvidenceSourceType" AS ENUM ('GOVERNMENT', 'RESEARCH_PAPER', 'NEWS', 'ORGANIZATION', 'OTHER');

-- CreateTable
CREATE TABLE "evidence_sources" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "publisher" TEXT,
    "url" TEXT NOT NULL,
    "publishedAt" TIMESTAMPTZ(6),
    "retrievedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType" "EvidenceSourceType" NOT NULL DEFAULT 'OTHER',
    "reliabilityNotes" TEXT,
    "contentHash" TEXT,

    CONSTRAINT "evidence_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_chunks" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "embedding" vector(768),

    CONSTRAINT "evidence_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debate_evidence" (
    "id" UUID NOT NULL,
    "debateId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "relevanceScore" DOUBLE PRECISION,
    "addedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debate_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factual_claims" (
    "id" UUID NOT NULL,
    "debateId" UUID NOT NULL,
    "transcriptId" UUID NOT NULL,
    "participantId" UUID,
    "originalText" TEXT NOT NULL,
    "normalizedClaim" TEXT NOT NULL,
    "language" TEXT,
    "status" "ClaimProcessingStatus" NOT NULL DEFAULT 'DETECTED',
    "detectedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "factual_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fact_check_results" (
    "id" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "modelName" TEXT NOT NULL,
    "verdict" "FactCheckVerdict" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "explanation" TEXT NOT NULL,
    "checkedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fact_check_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fact_check_evidence" (
    "id" UUID NOT NULL,
    "factCheckResultId" UUID NOT NULL,
    "evidenceChunkId" UUID NOT NULL,
    "relevanceScore" DOUBLE PRECISION,
    "supportsClaim" BOOLEAN,

    CONSTRAINT "fact_check_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "evidence_sources_url_key" ON "evidence_sources"("url");

-- CreateIndex
CREATE INDEX "evidence_sources_publisher_idx" ON "evidence_sources"("publisher");

-- CreateIndex
CREATE INDEX "evidence_sources_sourceType_idx" ON "evidence_sources"("sourceType");

-- CreateIndex
CREATE INDEX "evidence_chunks_sourceId_idx" ON "evidence_chunks"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_chunks_sourceId_chunkIndex_key" ON "evidence_chunks"("sourceId", "chunkIndex");

-- CreateIndex
CREATE INDEX "debate_evidence_debateId_idx" ON "debate_evidence"("debateId");

-- CreateIndex
CREATE UNIQUE INDEX "debate_evidence_debateId_sourceId_key" ON "debate_evidence"("debateId", "sourceId");

-- CreateIndex
CREATE INDEX "factual_claims_debateId_detectedAt_idx" ON "factual_claims"("debateId", "detectedAt");

-- CreateIndex
CREATE INDEX "factual_claims_transcriptId_idx" ON "factual_claims"("transcriptId");

-- CreateIndex
CREATE INDEX "factual_claims_status_idx" ON "factual_claims"("status");

-- CreateIndex
CREATE INDEX "fact_check_results_claimId_checkedAt_idx" ON "fact_check_results"("claimId", "checkedAt");

-- CreateIndex
CREATE INDEX "fact_check_evidence_factCheckResultId_idx" ON "fact_check_evidence"("factCheckResultId");

-- CreateIndex
CREATE UNIQUE INDEX "fact_check_evidence_factCheckResultId_evidenceChunkId_key" ON "fact_check_evidence"("factCheckResultId", "evidenceChunkId");

-- AddForeignKey
ALTER TABLE "evidence_chunks" ADD CONSTRAINT "evidence_chunks_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "evidence_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_evidence" ADD CONSTRAINT "debate_evidence_debateId_fkey" FOREIGN KEY ("debateId") REFERENCES "debates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_evidence" ADD CONSTRAINT "debate_evidence_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "evidence_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factual_claims" ADD CONSTRAINT "factual_claims_debateId_fkey" FOREIGN KEY ("debateId") REFERENCES "debates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factual_claims" ADD CONSTRAINT "factual_claims_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "transcripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factual_claims" ADD CONSTRAINT "factual_claims_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "debate_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_check_results" ADD CONSTRAINT "fact_check_results_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "factual_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_check_evidence" ADD CONSTRAINT "fact_check_evidence_factCheckResultId_fkey" FOREIGN KEY ("factCheckResultId") REFERENCES "fact_check_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_check_evidence" ADD CONSTRAINT "fact_check_evidence_evidenceChunkId_fkey" FOREIGN KEY ("evidenceChunkId") REFERENCES "evidence_chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
