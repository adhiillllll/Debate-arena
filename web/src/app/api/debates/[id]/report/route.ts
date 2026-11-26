import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { requestDebateReport } from "@/lib/ai-service";

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
        report: true,
        participants: {
          include: {
            user: { select: { displayName: true, username: true } },
          },
        },
        _count: {
          select: {
            transcripts: true,
            factualClaims: true,
            votes: true,
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
        { error: "You are not permitted to view this private debate." },
        { status: 403 }
      );
    }

    const canGenerate =
      debate.hostId === user.id || myParticipant?.role === "MODERATOR";

    return NextResponse.json({
      debate: {
        id: debate.id,
        title: debate.title,
        topic: debate.topic,
        description: debate.description,
        category: debate.category,
        durationMinutes: debate.durationMinutes,
        status: debate.status,
      },
      canGenerate,
      stats: debate._count,
      report: debate.report,
    });
  } catch (error) {
    console.error("GET /api/debates/[id]/report error:", error);
    return NextResponse.json(
      { error: "Failed to load debate report." },
      { status: 500 }
    );
  }
}

export async function POST(
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
        topicBrief: { select: { coreSummary: true } },
        participants: {
          include: {
            user: { select: { displayName: true, username: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        transcripts: {
          where: { isFinal: true },
          orderBy: { createdAt: "asc" },
          take: 150,
        },
        factualClaims: {
          orderBy: { detectedAt: "asc" },
          take: 80,
          include: {
            results: {
              orderBy: { checkedAt: "desc" },
              take: 1,
              include: {
                evidence: {
                  include: {
                    evidenceChunk: {
                      include: {
                        source: { select: { title: true, url: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        votes: {
          select: { votedForParticipantId: true },
        },
      },
    });

    if (!debate) {
      return NextResponse.json({ error: "Debate not found." }, { status: 404 });
    }

    const caller = debate.participants.find((p) => p.userId === user.id);
    const isModerator =
      debate.hostId === user.id || caller?.role === "MODERATOR";

    if (!isModerator) {
      return NextResponse.json(
        { error: "Only the moderator can generate the post-debate report." },
        { status: 403 }
      );
    }

    const voteCounts = new Map<string, number>();
    for (const v of debate.votes) {
      voteCounts.set(
        v.votedForParticipantId,
        (voteCounts.get(v.votedForParticipantId) ?? 0) + 1
      );
    }

    const participantLookup = new Map(
      debate.participants.map((p) => [
        p.id,
        {
          participant_id: p.id,
          display_name:
            p.user.displayName ?? p.user.username ?? `Participant (${p.role})`,
          role: p.role,
          vote_count: voteCounts.get(p.id) ?? 0,
        },
      ])
    );

    const generated = await requestDebateReport({
      debate_id: debate.id,
      title: debate.title,
      topic: debate.topic,
      description: debate.description,
      category: debate.category,
      core_summary: debate.topicBrief?.coreSummary ?? null,
      participants: Array.from(participantLookup.values()),
      transcripts: debate.transcripts.map((t) => {
        const speaker = t.participantId
          ? participantLookup.get(t.participantId)
          : undefined;
        return {
          speaker_name: speaker?.display_name ?? "Speaker",
          role: speaker?.role ?? "DEBATER",
          text: t.text,
          timestamp: (t.startedAt ?? t.createdAt).toISOString(),
        };
      }),
      claims: debate.factualClaims.flatMap((c) => {
        const latest = c.results[0];
        if (!latest) return [];
        const speaker = c.participantId
          ? participantLookup.get(c.participantId)
          : undefined;
        return [
          {
            speaker_name: speaker?.display_name ?? "Speaker",
            normalized_claim: c.normalizedClaim,
            verdict: latest.verdict,
            confidence: latest.confidence,
            explanation: latest.explanation,
            sources: latest.evidence.map(
              (ev) =>
                `${ev.evidenceChunk.source.title} (${ev.evidenceChunk.source.url})`
            ),
          },
        ];
      }),
      total_votes: debate.votes.length,
    });

    const saved = await prisma.debateReport.upsert({
      where: { debateId: debate.id },
      update: {
        summary: generated.summary,
        reportData: generated.report_data,
        generatedAt: new Date(),
      },
      create: {
        debateId: debate.id,
        summary: generated.summary,
        reportData: generated.report_data,
      },
    });

    return NextResponse.json({ report: saved }, { status: 201 });
  } catch (error) {
    console.error("POST /api/debates/[id]/report error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate post-debate report.",
      },
      { status: 500 }
    );
  }
}