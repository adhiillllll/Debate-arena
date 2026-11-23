import {
  AccessToken,
  AgentDispatchClient,
  RoomServiceClient,
} from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

const AGENT_NAME = "gemini-transcriber";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

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
        { error: "Invalid room or participant name." },
        { status: 400 }
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

    const httpUrl = serverUrl
      .replace(/^wss:\/\//, "https://")
      .replace(/^ws:\/\//, "http://");
    const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    const dispatchClient = new AgentDispatchClient(httpUrl, apiKey, apiSecret);

    try {
      let agentAlreadyInRoom = false;

      // 1. Check if an agent participant is already connected in this room
      try {
        const participants = await roomService.listParticipants(roomName);
        agentAlreadyInRoom = participants.some((p) =>
          p.identity.startsWith("agent-")
        );
      } catch {
        // Room does not exist yet
      }

      // 2. Also check pending dispatches if no agent is connected yet
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
        await dispatchClient.createDispatch(roomName, AGENT_NAME);
      }
    } catch (dispatchError) {
      console.error("Failed to dispatch LiveKit agent:", dispatchError);
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
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
  } catch {
    return NextResponse.json(
      { error: "Could not create a LiveKit access token." },
      { status: 400 }
    );
  }
}