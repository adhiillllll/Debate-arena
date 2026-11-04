-- CreateEnum
CREATE TYPE "DebateVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "DebateStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DebateParticipantRole" AS ENUM ('MODERATOR', 'DEBATER', 'AUDIENCE');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'INVITED');

-- CreateEnum
CREATE TYPE "DebateRoundType" AS ENUM ('OPENING_STATEMENT', 'MAIN_ARGUMENT', 'REBUTTAL', 'CLOSING_STATEMENT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DebateRoundStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'SKIPPED');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debates" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "DebateVisibility" NOT NULL DEFAULT 'PUBLIC',
    "status" "DebateStatus" NOT NULL DEFAULT 'DRAFT',
    "hostId" UUID NOT NULL,
    "maxDebaters" INTEGER NOT NULL DEFAULT 2,
    "startsAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "debates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debate_participants" (
    "id" UUID NOT NULL,
    "debateId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "DebateParticipantRole" NOT NULL,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'PENDING',
    "joinedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debate_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debate_rounds" (
    "id" UUID NOT NULL,
    "debateId" UUID NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "type" "DebateRoundType" NOT NULL DEFAULT 'CUSTOM',
    "durationSeconds" INTEGER NOT NULL DEFAULT 120,
    "status" "DebateRoundStatus" NOT NULL DEFAULT 'PENDING',
    "instructions" TEXT,
    "startedAt" TIMESTAMPTZ(6),
    "endedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debate_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcripts" (
    "id" UUID NOT NULL,
    "debateId" UUID NOT NULL,
    "roundId" UUID,
    "participantId" UUID,
    "text" TEXT NOT NULL,
    "language" TEXT,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" UUID NOT NULL,
    "debateId" UUID NOT NULL,
    "voterUserId" UUID NOT NULL,
    "votedForParticipantId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debate_reports" (
    "id" UUID NOT NULL,
    "debateId" UUID NOT NULL,
    "summary" TEXT NOT NULL,
    "reportData" JSONB NOT NULL,
    "generatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debate_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_username_key" ON "profiles"("username");

-- CreateIndex
CREATE INDEX "debates_visibility_status_idx" ON "debates"("visibility", "status");

-- CreateIndex
CREATE INDEX "debates_hostId_idx" ON "debates"("hostId");

-- CreateIndex
CREATE INDEX "debate_participants_debateId_role_status_idx" ON "debate_participants"("debateId", "role", "status");

-- CreateIndex
CREATE INDEX "debate_participants_userId_status_idx" ON "debate_participants"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "debate_participants_debateId_userId_key" ON "debate_participants"("debateId", "userId");

-- CreateIndex
CREATE INDEX "debate_rounds_debateId_status_idx" ON "debate_rounds"("debateId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "debate_rounds_debateId_roundNumber_key" ON "debate_rounds"("debateId", "roundNumber");

-- CreateIndex
CREATE INDEX "transcripts_debateId_createdAt_idx" ON "transcripts"("debateId", "createdAt");

-- CreateIndex
CREATE INDEX "transcripts_roundId_createdAt_idx" ON "transcripts"("roundId", "createdAt");

-- CreateIndex
CREATE INDEX "transcripts_participantId_idx" ON "transcripts"("participantId");

-- CreateIndex
CREATE INDEX "votes_debateId_votedForParticipantId_idx" ON "votes"("debateId", "votedForParticipantId");

-- CreateIndex
CREATE UNIQUE INDEX "votes_debateId_voterUserId_key" ON "votes"("debateId", "voterUserId");

-- CreateIndex
CREATE UNIQUE INDEX "debate_reports_debateId_key" ON "debate_reports"("debateId");

-- AddForeignKey
ALTER TABLE "debates" ADD CONSTRAINT "debates_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_participants" ADD CONSTRAINT "debate_participants_debateId_fkey" FOREIGN KEY ("debateId") REFERENCES "debates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_participants" ADD CONSTRAINT "debate_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_rounds" ADD CONSTRAINT "debate_rounds_debateId_fkey" FOREIGN KEY ("debateId") REFERENCES "debates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_debateId_fkey" FOREIGN KEY ("debateId") REFERENCES "debates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "debate_rounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "debate_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_debateId_fkey" FOREIGN KEY ("debateId") REFERENCES "debates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_voterUserId_fkey" FOREIGN KEY ("voterUserId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_votedForParticipantId_fkey" FOREIGN KEY ("votedForParticipantId") REFERENCES "debate_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_reports" ADD CONSTRAINT "debate_reports_debateId_fkey" FOREIGN KEY ("debateId") REFERENCES "debates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
