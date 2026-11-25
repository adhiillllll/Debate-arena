import {
  AccessToken,
  AgentDispatchClient,
  RoomServiceClient,
} from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const AGENT_NAME = "gemini-transcriber";
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Prevents parallel requests (e.g. React Strict Mode double-mount) from dispatching two agents
const inFlightDispatches = new Map<string, Promise<void>>();

async function dispatchAgentOnce(
  serverUrl: string,
  apiKey: string,
  apiSecret: string,
  roomName: string,
  metadata?: string
) {
  const httpUrl = serverUrl
    .replace(/^wss:\/\//, "https://")
    .replace(/^ws:\/\//, "http://");
  const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);
  const dispatchClient = new AgentDispatchClient(httpUrl, apiKey, apiSecret);

  try {
    let agentAlreadyInRoom = false;

    try {
      const participants = await roomService.listParticipants(roomName);
      agentAlreadyInRoom = participants.some((p) =>
        p.identity.startsWith("agent-")
      );
    } catch {
      // Room does not exist yet
    }

    let alreadyDispatched = agentAlreadyInRoom;
    if (!alreadyDispatched) {
      try {
        const existingDispatches = await dispatchClient.listDispatch(roomName);
        alreadyDispatched = existingDispatches.some(
          (d) => d.agentName === AGENT_NAME
        );
      } catch {
        // Room does not exist yet
      }
    }

    if (!alreadyDispatched) {
      await dispatchClient.createDispatch(
        roomName,
        AGENT_NAME,
        metadata ? { metadata } : undefined
      );
    }
  } catch (dispatchError) {
    console.error("Failed to dispatch LiveKit agent:", dispatchError);
  }
}

async function ensureAgentDispatched(
  serverUrl: string,
  apiKey: string,
  apiSecret: string,
  roomName: string,
  metadata?: string
) {
  const existing = inFlightDispatches.get(roomName);
  if (existing) {
    await existing;
    return;
  }

  const task = dispatchAgentOnce(
    serverUrl,
    apiKey,
    apiSecret,
    roomName,
    metadata
  ).finally(() => {
    inFlightDispatches.delete(roomName);
  });

  inFlightDispatches.set(roomName, task);
  await task;
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
        { error: "Authentication required to join a live room." },
        { status: 401 }
      );
    }

    const serverUrl = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!serverUrl || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "LiveKit server configuration is missing." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const debateId =
      typeof body.debateId === "string" ? body.debateId.trim() : "";

    // Primary Step 10 Flow: Authenticated Debate Room bound to real Debate UUID
    if (debateId) {
      if (!UUID_REGEX.test(debateId)) {
        return NextResponse.json(
          { error: "Invalid debateId UUID." },
          { status: 400 }
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
        return NextResponse.json(
          { error: "Debate not found." },
          { status: 404 }
        );
      }

      if (debate.status === "CANCELLED") {
        return NextResponse.json(
          { error: "This debate has been cancelled." },
          { status: 403 }
        );
      }

      const fallbackDisplayName =
        (user.user_metadata?.display_name as string | undefined) ??
        (user.user_metadata?.full_name as string | undefined) ??
        user.email?.split("@")[0] ??
        "Participant";

      const profile = await prisma.user.upsert({
        where: { id: user.id },
        update: {},
        create: {
          id: user.id,
          displayName: fallbackDisplayName,
        },
      });

      let participant = debate.participants[0] ?? null;

      if (!participant) {
        if (debate.visibility === "PRIVATE" && debate.hostId !== user.id) {
          return NextResponse.json(
            { error: "You are not invited to this private debate." },
            { status: 403 }
          );
        }

        participant = await prisma.debateParticipant.create({
          data: {
            debateId: debate.id,
            userId: user.id,
            role: debate.hostId === user.id ? "MODERATOR" : "AUDIENCE",
            status: "APPROVED",
            joinedAt: new Date(),
          },
        });
      } else if (participant.status === "REJECTED") {
        return NextResponse.json(
          { error: "Your participation in this debate was declined." },
          { status: 403 }
        );
      } else if (!participant.joinedAt) {
        participant = await prisma.debateParticipant.update({
          where: { id: participant.id },
          data: {
            status:
              participant.status === "PENDING" ? "APPROVED" : participant.status,
            joinedAt: new Date(),
          },
        });
      }

      const displayName =
        profile.displayName ?? profile.username ?? fallbackDisplayName;

      const canPublish =
        participant.role === "MODERATOR" || participant.role === "DEBATER";

      const roomName = debate.id;
      const agentMetadata = JSON.stringify({
        debateId: debate.id,
      });

      await ensureAgentDispatched(
        serverUrl,
        apiKey,
        apiSecret,
        roomName,
        agentMetadata
      );

      const participantMetadata = JSON.stringify({
        debateId: debate.id,
        participantId: participant.id,
        userId: user.id,
        role: participant.role,
        displayName,
      });

      const token = new AccessToken(apiKey, apiSecret, {
        identity: participant.id,
        name: displayName,
        metadata: participantMetadata,
        ttl: "2h",
      });

      token.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish,
        canSubscribe: true,
        canPublishData: canPublish,
      });

      const jwt = await token.toJwt();

      return NextResponse.json({
        serverUrl,
        token: jwt,
        roomName,
        participant: {
          id: participant.id,
          role: participant.role,
          displayName,
          canPublish,
        },
      });
    }

    // Legacy Sandbox Audio Test Fallback (home-client.tsx)
    const roomName =
      typeof body.roomName === "string" ? body.roomName.trim() : "";
    const participantName =
      typeof body.participantName === "string"
        ? body.participantName.trim()
        : "";

    if (
      !/^[a-zA-Z0-9_-]{1,64}$/.test(roomName) ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(participantName)
    ) {
      return NextResponse.json(
        { error: "Provide a valid debateId or room/participant name." },
        { status: 400 }
      );
    }

    await ensureAgentDispatched(serverUrl, apiKey, apiSecret, roomName);

    const token = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      name: participantName,
      ttl: "1h",
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await token.toJwt();

    return NextResponse.json({
      serverUrl,
      token: jwt,
    });
  } catch (error) {
    console.error("POST /api/livekit-token error:", error);
    return NextResponse.json(
      { error: "Could not create a LiveKit access token." },
      { status: 500 }
    );
  }
}