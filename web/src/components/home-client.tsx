
"use client";

import { useState , useEffect } from "react";
import {
  ControlBar,
  LiveKitRoom,
  RoomAudioRenderer,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import SignOutButton from "@/components/auth/signout-button";

type ConnectionDetails = {
  serverUrl: string;
  token: string;
};


type TranscriptMessage = {
  type: "transcript";
  participantIdentity: string;
  text: string;
  timestamp: string;
  language?: string;
};

function LiveTranscriptPanel() {
  const room = useRoomContext();
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);

  useEffect(() => {
    const handleDataReceived = (
      payload: Uint8Array,
      _participant: unknown,
      _kind: unknown,
      topic?: string
    ) => {
      console.log("LiveKit data received:", {
  topic,
  payload: new TextDecoder().decode(payload),
});

if (topic !== "debate-transcript") return;
      try {
        const decoded = new TextDecoder().decode(payload);
        const message = JSON.parse(decoded) as TranscriptMessage;

        if (
          message.type !== "transcript" ||
          !message.participantIdentity ||
          !message.text
        ) {
          return;
        }

        setTranscripts((previous) => [...previous, message]);
      } catch (error) {
        console.error("Failed to parse transcript:", error);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room]);

  const debaterA = transcripts.filter(
    (item) => item.participantIdentity === "debater-a"
  );

  const debaterB = transcripts.filter(
    (item) => item.participantIdentity === "debater-b"
  );

  function renderTranscript(items: TranscriptMessage[]) {
    if (items.length === 0) {
      return (
        <p className="text-sm text-slate-500">
          Waiting for speech...
        </p>
      );
    }

    return (
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={`${item.timestamp}-${index}`}
            className="rounded-lg bg-slate-100 p-3"
          >
            <p className="text-sm text-slate-800">{item.text}</p>

            <p className="mt-1 text-xs text-slate-500">
              {new Date(item.timestamp).toLocaleTimeString()}
            </p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className="mt-6">
      <h3 className="mb-4 text-lg font-bold">Live Transcripts</h3>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-blue-200 p-4">
          <h4 className="mb-3 font-semibold text-blue-700">
            Debater A
          </h4>
          {renderTranscript(debaterA)}
        </div>

        <div className="rounded-xl border border-red-200 p-4">
          <h4 className="mb-3 font-semibold text-red-700">
            Debater B
          </h4>
          {renderTranscript(debaterB)}
        </div>
      </div>
    </section>
  );
}


export default function Home() {
  const [roomName, setRoomName] = useState("debate-room-001");
  const [participantName, setParticipantName] = useState("debater-a");
  const [connection, setConnection] =
    useState<ConnectionDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function joinRoom() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/livekit-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName, participantName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not join the room.");
      }

      setConnection({
        serverUrl: data.serverUrl,
        token: data.token,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  if (connection) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">

        <div className="mb-4 flex items-center justify-between">
            <h1 className="text-3xl font-bold">Debate Arena</h1>
            <SignOutButton />
        </div>
        

        <p className="mb-6 text-slate-300">
          Room: {roomName} · Participant: {participantName}
        </p>

        <LiveKitRoom
          serverUrl={connection.serverUrl}
          token={connection.token}
          connect={true}
          audio={true}
          video={false}
          onDisconnected={() => setConnection(null)}
        >
          <div
            data-lk-theme="default"
            className="mx-auto max-w-2xl rounded-xl bg-white p-6 text-slate-900"
          >
            <h2 className="mb-3 text-xl font-semibold">
              Live audio room
            </h2>

            <p className="mb-5 text-sm text-slate-600">
              Allow microphone access and join from another device
              using the same room name.
            </p>

            <RoomAudioRenderer />

            <ControlBar
              controls={{
                microphone: true,
                camera: false,
                screenShare: false,
              }}
            />

            <LiveTranscriptPanel />
            
          </div>
        </LiveKitRoom>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-7">
        <p className="mb-2 text-sm font-medium text-blue-400">
          PHASE 1 · AUDIO FOUNDATION
        </p>

        <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Debate Arena</h1>
            <SignOutButton />
        </div>

        <p className="mb-6 text-slate-300">
          Join a test room with another participant.
        </p>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void joinRoom();
          }}
        >
          <div>
            <label htmlFor="room" className="mb-1 block text-sm">
              Room name
            </label>

            <input
              id="room"
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              required
              pattern="[a-zA-Z0-9_-]{1,64}"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
            />
          </div>

          <div>
            <label
              htmlFor="participant"
              className="mb-1 block text-sm"
            >
              Participant identity
            </label>

            <input
              id="participant"
              value={participantName}
              onChange={(event) =>
                setParticipantName(event.target.value)
              }
              required
              pattern="[a-zA-Z0-9_-]{1,64}"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 p-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? "Connecting..." : "Join audio room"}
          </button>
        </form>

        <p className="mt-5 text-xs text-slate-400">
          Development test only. Participant names are not yet
          verified through sign-in.
        </p>
      </section>
    </main>
  );
}
