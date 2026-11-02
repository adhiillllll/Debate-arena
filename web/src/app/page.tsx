
"use client";

import { useState } from "react";
import {
  ControlBar,
  LiveKitRoom,
  RoomAudioRenderer,
} from "@livekit/components-react";
import "@livekit/components-styles";

type ConnectionDetails = {
  serverUrl: string;
  token: string;
};

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
        <h1 className="mb-2 text-2xl font-bold">Debate Arena</h1>

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

        <h1 className="mb-2 text-3xl font-bold">Debate Arena</h1>

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
