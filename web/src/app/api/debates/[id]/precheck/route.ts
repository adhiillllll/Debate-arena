import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  requestPrecheckValidation,
  requestTopicBrief,
} from "@/lib/ai-service";

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
        topicBrief: true,
        participants: {
          where: { userId: user.id },
          take: 1,
        },
      },
    });

    if (!debate) {
      return NextResponse.json({ error: "Debate not found." }, { status: 404 });
    }

    let participant = debate.participants[0] ?? null;

    // Auto-enroll authenticated user on public debates (or host) so precheck can be stored
    if (!participant && (debate.hostId === user.id || debate.visibility === "PUBLIC")) {
      const displayName =
        (user.user_metadata?.display_name as string | undefined) ??
        user.email?.split("@")[0] ??
        "Debater";

      await prisma.user.upsert({
        where: { id: user.id },
        update: {},
        create: { id: user.id, displayName },
      });

      participant = await prisma.debateParticipant.create({
        data: {
          debateId: debate.id,
          userId: user.id,
          role: debate.hostId === user.id ? "MODERATOR" : "DEBATER",
          status: "APPROVED",
          joinedAt: new Date(),
        },
      });
    }

    if (!participant) {
      return NextResponse.json(
        { error: "You are not invited to this private debate." },
        { status: 403 }
      );
    }

    const submissions = await prisma.debatePrecheckSubmission.findMany({
      where: {
        debateId: debate.id,
        participantId: participant.id,
      },
      orderBy: { questionId: "asc" },
    });

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
      participant: {
        id: participant.id,
        role: participant.role,
        status: participant.status,
      },
      topicBrief: debate.topicBrief,
      submissions,
    });
  } catch (error) {
    console.error("GET /api/debates/[id]/precheck error:", error);
    return NextResponse.json(
      { error: "Failed to load precheck workspace." },
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
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
      include: {
        participants: {
          where: { userId: user.id },
          take: 1,
        },
      },
    });

    if (!debate) {
      return NextResponse.json({ error: "Debate not found." }, { status: 404 });
    }

    const participant = debate.participants[0];
    if (!participant) {
      return NextResponse.json(
        { error: "Join this debate before submitting precheck answers." },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Action 1: Generate or regenerate the Topic Brief
    if (body.action === "generate_brief") {
      if (debate.hostId !== user.id && participant.role !== "MODERATOR") {
        return NextResponse.json(
          { error: "Only the moderator can regenerate the topic brief." },
          { status: 403 }
        );
      }

      const brief = await requestTopicBrief({
        debate_id: debate.id,
        title: debate.title,
        topic: debate.topic,
        description: debate.description,
        category: debate.category,
      });

      return NextResponse.json({ topicBrief: brief });
    }

    // Action 2: Validate a debater's precheck response
    const questionId =
      typeof body.questionId === "string" ? body.questionId.trim() : "";
    const debaterResponse =
      typeof body.debaterResponse === "string"
        ? body.debaterResponse.trim()
        : "";

    if (!questionId || !debaterResponse) {
      return NextResponse.json(
        { error: "questionId and debaterResponse are required." },
        { status: 400 }
      );
    }

    const validation = await requestPrecheckValidation({
      debate_id: debate.id,
      participant_id: participant.id,
      question_id: questionId,
      debater_response: debaterResponse,
    });

    return NextResponse.json({ submission: validation });
  } catch (error) {
    console.error("POST /api/debates/[id]/precheck error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Precheck validation failed.",
      },
      { status: 500 }
    );
  }
}