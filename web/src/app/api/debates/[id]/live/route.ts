import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: debateId } = await params;

    if (!UUID_REGEX.test(debateId)) {
      return NextResponse.json({ error: "Invalid debate ID." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
      include: {
        topicBrief: {
          select: { id: true, coreSummary: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, displayName: true, username: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        transcripts: {
          where: { isFinal: true },
          orderBy: { createdAt: "asc" },
          take: 200,
        },
        factualClaims: {
          orderBy: { detectedAt: "desc" },
          take: 100,
          include: {
            results: {
              orderBy: { checkedAt: "desc" },
              take: 1,
              include: {
                evidence: {
                  include: {
                    evidenceChunk: {
                      include: {
                        source: {
                          select: { id: true, title: true, url: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!debate) {
      return NextResponse.json({ error: "Debate not found." }, { status: 404 });
    }

    const myParticipant =
      debate.participants.find((p) => p.userId === user.id) ?? null;

    if (
      !myParticipant &&
      debate.visibility === "PRIVATE" &&
      debate.hostId !== user.id
    ) {
      return NextResponse.json(
        { error: "You are not invited to this private debate." },
        { status: 403 }
      );
    }

    const participantSummaries = debate.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      role: p.role,
      displayName:
        p.user.displayName ?? p.user.username ?? `Participant (${p.role})`,
    }));

    const participantLookup = new Map(
      participantSummaries.map((p) => [p.id, p])
    );

    const hydratedTranscripts = debate.transcripts.map((t) => {
      const speaker = t.participantId
        ? participantLookup.get(t.participantId)
        : undefined;
      return {
        id: t.id,
        transcriptId: t.id,
        participantIdentity: t.participantId ?? "unknown",
        participantId: t.participantId,
        displayName: speaker?.displayName ?? "Speaker",
        role: speaker?.role ?? "DEBATER",
        text: t.text,
        timestamp: (t.startedAt ?? t.createdAt).toISOString(),
        language: t.language ?? undefined,
      };
    });

    const hydratedFactChecks = debate.factualClaims.flatMap((claim) => {
      const latestResult = claim.results[0];
      if (!latestResult) return [];

      const speaker = claim.participantId
        ? participantLookup.get(claim.participantId)
        : undefined;

      return [
        {
          localId: latestResult.id,
          claimId: claim.id,
          factCheckResultId: latestResult.id,
          participantIdentity: claim.participantId ?? "unknown",
          participantId: claim.participantId,
          displayName: speaker?.displayName ?? "Speaker",
          role: speaker?.role ?? "DEBATER",
          originalText: claim.originalText,
          normalizedClaim: claim.normalizedClaim,
          verdict: latestResult.verdict,
          confidence: latestResult.confidence ?? 0,
          explanation: latestResult.explanation,
          timestamp: claim.detectedAt.toISOString(),
          reviewStatus: "PENDING" as const,
          sources: latestResult.evidence.map((ev) => ({
            chunkId: ev.evidenceChunk.id,
            sourceId: ev.evidenceChunk.source.id,
            chunkIndex: ev.evidenceChunk.chunkIndex,
            similarity: ev.relevanceScore ?? 0,
            title: ev.evidenceChunk.source.title,
            url: ev.evidenceChunk.source.url,
            content: ev.evidenceChunk.content,
          })),
        },
      ];
    });

    return NextResponse.json({
      debate: {
        id: debate.id,
        title: debate.title,
        topic: debate.topic,
        description: debate.description,
        category: debate.category,
        durationMinutes: debate.durationMinutes,
        maxDebaters: debate.maxDebaters,
        status: debate.status,
        visibility: debate.visibility,
        coreSummary: debate.topicBrief?.coreSummary ?? null,
      },
      participants: participantSummaries,
      transcripts: hydratedTranscripts,
      factChecks: hydratedFactChecks,
    });
  } catch (error) {
    console.error("GET /api/debates/[id]/live error:", error);
    return NextResponse.json(
      { error: "Failed to load live debate room." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: debateId } = await params;

    if (!UUID_REGEX.test(debateId)) {
      return NextResponse.json({ error: "Invalid debate ID." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
      include: {
        participants: true,
      },
    });

    if (!debate) {
      return NextResponse.json({ error: "Debate not found." }, { status: 404 });
    }

    const callerParticipant = debate.participants.find(
      (p) => p.userId === user.id
    );
    const isModerator =
      debate.hostId === user.id || callerParticipant?.role === "MODERATOR";

    if (!isModerator) {
      return NextResponse.json(
        { error: "Only the moderator can update debate settings." },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Action 1: Promote or demote a participant's role (DEBATER <-> AUDIENCE)
    if (typeof body.participantId === "string" && typeof body.role === "string") {
      const targetId = body.participantId.trim();
      const nextRole = body.role.toUpperCase();

      if (nextRole !== "DEBATER" && nextRole !== "AUDIENCE") {
        return NextResponse.json(
          { error: "Role must be DEBATER or AUDIENCE." },
          { status: 400 }
        );
      }

      const target = debate.participants.find((p) => p.id === targetId);
      if (!target) {
        return NextResponse.json(
          { error: "Participant not found in this debate." },
          { status: 404 }
        );
      }

      if (target.role === "MODERATOR") {
        return NextResponse.json(
          { error: "Moderator role cannot be reassigned here." },
          { status: 400 }
        );
      }

      if (nextRole === "DEBATER" && target.role !== "DEBATER") {
        const activeDebaterCount = debate.participants.filter(
          (p) => p.role === "DEBATER"
        ).length;
        if (activeDebaterCount >= debate.maxDebaters) {
          return NextResponse.json(
            {
              error: `Maximum of ${debate.maxDebaters} debaters already assigned.`,
            },
            { status: 400 }
          );
        }
      }

      const updatedParticipant = await prisma.debateParticipant.update({
        where: { id: targetId },
        data: {
          role: nextRole as "DEBATER" | "AUDIENCE",
          status: "APPROVED",
        },
        select: { id: true, role: true },
      });

      return NextResponse.json({ participant: updatedParticipant });
    }

    // Action 2: Update debate lifecycle status
    const allowedStatuses = new Set(["DRAFT", "SCHEDULED", "LIVE", "ENDED"]);
    const nextStatus =
      typeof body.status === "string" ? body.status.toUpperCase() : "";

    if (!allowedStatuses.has(nextStatus)) {
      return NextResponse.json(
        { error: "Invalid debate status." },
        { status: 400 }
      );
    }

    const updated = await prisma.debate.update({
      where: { id: debateId },
      data: {
        status: nextStatus as "DRAFT" | "SCHEDULED" | "LIVE" | "ENDED",
      },
      select: { id: true, status: true },
    });

    return NextResponse.json({ debate: updated });
  } catch (error) {
    console.error("PATCH /api/debates/[id]/live error:", error);
    return NextResponse.json(
      { error: "Failed to update debate." },
      { status: 500 }
    );
  }
}