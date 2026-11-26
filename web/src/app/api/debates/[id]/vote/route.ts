import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function buildVoteSummary(debateId: string, userId: string) {
  const [debaters, groupedVotes, userVote] = await Promise.all([
    prisma.debateParticipant.findMany({
      where: { debateId, role: "DEBATER" },
      include: {
        user: { select: { displayName: true, username: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.vote.groupBy({
      by: ["votedForParticipantId"],
      where: { debateId },
      _count: { _all: true },
    }),
    prisma.vote.findUnique({
      where: {
        debateId_voterUserId: {
          debateId,
          voterUserId: userId,
        },
      },
      select: { votedForParticipantId: true },
    }),
  ]);

  const countMap = new Map(
    groupedVotes.map((g) => [g.votedForParticipantId, g._count._all])
  );

  const tally = debaters.map((d) => ({
    participantId: d.id,
    userId: d.userId,
    displayName: d.user.displayName ?? d.user.username ?? "Debater",
    votes: countMap.get(d.id) ?? 0,
  }));

  const totalVotes = tally.reduce((acc, item) => acc + item.votes, 0);

  return {
    tally,
    totalVotes,
    myVoteParticipantId: userVote?.votedForParticipantId ?? null,
  };
}

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

    const summary = await buildVoteSummary(debateId, user.id);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("GET /api/debates/[id]/vote error:", error);
    return NextResponse.json(
      { error: "Failed to load audience votes." },
      { status: 500 }
    );
  }
}

export async function POST(
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
        { error: "Sign in to cast your vote." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const votedForParticipantId =
      typeof body.participantId === "string" ? body.participantId.trim() : "";

    if (!UUID_REGEX.test(votedForParticipantId)) {
      return NextResponse.json(
        { error: "Select a valid debater to vote for." },
        { status: 400 }
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

    if (debate.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Voting is closed for cancelled debates." },
        { status: 403 }
      );
    }

    const callerParticipant = debate.participants.find(
      (p) => p.userId === user.id
    );

    if (
      !callerParticipant &&
      debate.visibility === "PRIVATE" &&
      debate.hostId !== user.id
    ) {
      return NextResponse.json(
        { error: "You do not have access to vote in this private debate." },
        { status: 403 }
      );
    }

    const targetDebater = debate.participants.find(
      (p) => p.id === votedForParticipantId && p.role === "DEBATER"
    );

    if (!targetDebater) {
      return NextResponse.json(
        { error: "Votes can only be cast for assigned debaters." },
        { status: 400 }
      );
    }

    if (targetDebater.userId === user.id) {
      return NextResponse.json(
        { error: "Debaters cannot vote for themselves." },
        { status: 403 }
      );
    }

    const fallbackDisplayName =
      (user.user_metadata?.display_name as string | undefined) ??
      user.email?.split("@")[0] ??
      "Voter";

    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: { id: user.id, displayName: fallbackDisplayName },
    });

    await prisma.vote.upsert({
      where: {
        debateId_voterUserId: {
          debateId,
          voterUserId: user.id,
        },
      },
      update: {
        votedForParticipantId,
      },
      create: {
        debateId,
        voterUserId: user.id,
        votedForParticipantId,
      },
    });

    const summary = await buildVoteSummary(debateId, user.id);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("POST /api/debates/[id]/vote error:", error);
    return NextResponse.json(
      { error: "Could not record your vote." },
      { status: 500 }
    );
  }
}