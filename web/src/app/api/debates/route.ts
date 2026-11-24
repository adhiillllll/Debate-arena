import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { requestTopicBrief } from "@/lib/ai-service";

export async function GET() {
  try {
    const debates = await prisma.debate.findMany({
      where: { visibility: "PUBLIC" },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        host: {
          select: { id: true, displayName: true, username: true },
        },
        topicBrief: {
          select: { id: true, coreSummary: true },
        },
        _count: {
          select: { participants: true },
        },
      },
    });

    return NextResponse.json({ debates });
  } catch (error) {
    console.error("GET /api/debates error:", error);
    return NextResponse.json(
      { error: "Failed to load debates." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "You must be signed in to create a debate." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    const category =
      typeof body.category === "string" ? body.category.trim() : "General";
    const format = typeof body.format === "string" ? body.format : "1 vs 1";
    const visibility =
      body.visibility === "Private" || body.visibility === "PRIVATE"
        ? "PRIVATE"
        : "PUBLIC";
    const durationMinutes =
      typeof body.durationMinutes === "number" &&
      body.durationMinutes >= 5 &&
      body.durationMinutes <= 180
        ? Math.round(body.durationMinutes)
        : 30;

    if (!title || title.length > 150) {
      return NextResponse.json(
        { error: "Please provide a debate topic (1-150 characters)." },
        { status: 400 }
      );
    }

    if (description.length > 1000) {
      return NextResponse.json(
        { error: "Description cannot exceed 1000 characters." },
        { status: 400 }
      );
    }

    // Ensure a matching row exists in `profiles` for foreign-key safety
    const fallbackDisplayName =
      (user.user_metadata?.display_name as string | undefined) ??
      (user.user_metadata?.full_name as string | undefined) ??
      user.email?.split("@")[0] ??
      "Debater";

    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: {
        id: user.id,
        displayName: fallbackDisplayName,
      },
    });

    const maxDebaters = format === "Team vs Team" ? 4 : 2;

    const debate = await prisma.debate.create({
      data: {
        title,
        topic: title,
        description: description || null,
        category: category || null,
        durationMinutes,
        visibility,
        status: "DRAFT",
        hostId: user.id,
        maxDebaters,
        participants: {
          create: {
            userId: user.id,
            role: "MODERATOR",
            status: "APPROVED",
            joinedAt: new Date(),
          },
        },
      },
    });

    // Generate & store the AI Topic Brief via FastAPI
    let topicBrief = null;
    let briefWarning: string | null = null;

    try {
      topicBrief = await requestTopicBrief({
        debate_id: debate.id,
        title: debate.title,
        topic: debate.topic,
        description: debate.description,
        category: debate.category,
      });
    } catch (aiErr) {
      console.error("Topic brief generation failed:", aiErr);
      briefWarning =
        aiErr instanceof Error
          ? aiErr.message
          : "AI topic brief could not be generated right now.";
    }

    return NextResponse.json(
      {
        debate,
        topicBrief,
        briefWarning,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/debates error:", error);
    return NextResponse.json(
      { error: "Could not create the debate." },
      { status: 500 }
    );
  }
}