
"use client";

import { useState, useEffect } from "react";
import {
  ControlBar,
  LiveKitRoom,
  RoomAudioRenderer,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import SignOutButton from "@/components/auth/signout-button";
import DashboardSidebar from "@/components/dashboard-sidebar";
import DashboardOverview from "@/components/dashboard-overview";

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

type FactCheckVerdict =
  | "SUPPORTED"
  | "REFUTED"
  | "PARTIALLY_SUPPORTED"
  | "CONTRADICTORY_EVIDENCE"
  | "INSUFFICIENT_EVIDENCE";

type FactCheckSource = {
  chunkId: string;
  sourceId: string;
  chunkIndex: number;
  similarity: number;
  title: string;
  url: string;
  content: string;
};

type FactCheckMessage = {
  type: "fact_check";
  participantIdentity: string;
  timestamp: string;
  originalText: string;
  normalizedClaim: string;
  verdict: FactCheckVerdict;
  confidence: number;
  explanation: string;
  sources: FactCheckSource[];
};

type ModeratorReviewStatus = "PENDING" | "REVIEWED" | "DISMISSED";

type FactCheckCardItem = FactCheckMessage & {
  localId: string;
  reviewStatus: ModeratorReviewStatus;
};

const VERDICT_STYLES: Record<
  FactCheckVerdict,
  { label: string; badgeClass: string }
> = {
  SUPPORTED: {
    label: "Supported by Evidence",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  REFUTED: {
    label: "Contradicted by Evidence",
    badgeClass: "bg-red-100 text-red-800 border-red-200",
  },
  PARTIALLY_SUPPORTED: {
    label: "Partially Supported",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
  },
  CONTRADICTORY_EVIDENCE: {
    label: "Conflicting Evidence",
    badgeClass: "bg-orange-100 text-orange-800 border-orange-200",
  },
  INSUFFICIENT_EVIDENCE: {
    label: "Insufficient Evidence",
    badgeClass: "bg-slate-200 text-slate-700 border-slate-300",
  },
};

function isSafeHttpUrl(url: string): boolean {
  return url.startsWith("https://") || url.startsWith("http://");
}

function LiveFactCheckPanel() {
  const room = useRoomContext();
  const [items, setItems] = useState<FactCheckCardItem[]>([]);

  useEffect(() => {
    const handleDataReceived = (
      payload: Uint8Array,
      _participant: unknown,
      _kind: unknown,
      topic?: string
    ) => {
      if (topic !== "debate-fact-check") return;

      try {
        const decoded = new TextDecoder().decode(payload);
        const message = JSON.parse(decoded) as FactCheckMessage;

        if (
          message.type !== "fact_check" ||
          !message.participantIdentity ||
          !message.normalizedClaim
        ) {
          return;
        }

        const card: FactCheckCardItem = {
          ...message,
          sources: Array.isArray(message.sources) ? message.sources : [],
          localId: `${message.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
          reviewStatus: "PENDING",
        };

        setItems((previous) => [card, ...previous]);
      } catch (error) {
        console.error("Failed to parse fact-check payload:", error);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room]);

  function updateReviewStatus(localId: string, status: ModeratorReviewStatus) {
    setItems((previous) =>
      previous.map((item) =>
        item.localId === localId ? { ...item, reviewStatus: status } : item
      )
    );
  }

  return (
    <section className="mt-8 border-t border-slate-200 pt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            AI Evidence Assistant (Moderator View)
          </h3>
          <p className="text-xs text-slate-500">
            Evidence-based suggestions only. Human moderator retains final control.
          </p>
        </div>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          {items.length} {items.length === 1 ? "claim" : "claims"} analyzed
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
          Listening for verifiable factual claims from live speech...
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const verdictMeta =
              VERDICT_STYLES[item.verdict] ??
              VERDICT_STYLES.INSUFFICIENT_EVIDENCE;
            const confidencePct = Math.round((item.confidence ?? 0) * 100);
            const isDismissed = item.reviewStatus === "DISMISSED";

            return (
              <article
                key={item.localId}
                className={`rounded-xl border p-4 transition ${isDismissed
                    ? "border-slate-200 bg-slate-50 opacity-60"
                    : "border-slate-200 bg-white shadow-xs"
                  }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-[#192F50] px-2.5 py-0.5 text-xs font-semibold text-white">
                      {item.participantIdentity}
                    </span>

                    <span
                      className={`rounded-md border px-2.5 py-0.5 text-xs font-semibold ${verdictMeta.badgeClass}`}
                    >
                      {verdictMeta.label}
                    </span>

                    <span className="text-xs text-slate-500">
                      Confidence: {confidencePct}%
                    </span>
                  </div>

                  <span className="text-xs text-slate-400">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div className="mt-3">
                  <p className="text-sm font-semibold text-slate-900">
                    Claim: {item.normalizedClaim}
                  </p>
                  {item.originalText &&
                    item.originalText !== item.normalizedClaim && (
                      <p className="mt-1 text-xs italic text-slate-500">
                        Quote: “{item.originalText}”
                      </p>
                    )}
                </div>

                <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  {item.explanation}
                </p>

                <div className="mt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Retrieved Sources ({item.sources.length})
                  </p>

                  {item.sources.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No matching evidence chunks met the similarity threshold.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {item.sources.map((source) => (
                        <li
                          key={`${source.chunkId}-${source.chunkIndex}`}
                          className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            {isSafeHttpUrl(source.url) ? (
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-blue-700 hover:underline"
                              >
                                {source.title}
                              </a>
                            ) : (
                              <span className="font-semibold text-slate-800">
                                {source.title}
                              </span>
                            )}

                            <span className="text-slate-500">
                              Similarity: {Math.round(source.similarity * 100)}%
                            </span>
                          </div>

                          <p className="mt-1 text-slate-600">{source.content}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <span className="text-xs font-medium text-slate-500">
                    Moderator Status:{" "}
                    <strong className="text-slate-700">
                      {item.reviewStatus}
                    </strong>
                  </span>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateReviewStatus(item.localId, "REVIEWED")
                      }
                      className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                    >
                      Mark Reviewed
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateReviewStatus(item.localId, "DISMISSED")
                      }
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
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
  const [showAudioTest, setShowAudioTest] = useState(false);

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
      <main className="dashboard-shell flex min-h-screen flex-col bg-[#F8F5EC] text-[#192F50] md:flex-row">

        <DashboardSidebar />

        <div className="min-w-0 flex-1 p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-3xl font-bold">Debate Arena</h1>
          </div>

          <p className="mb-6 text-slate-600">
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
              className="mx-auto max-w-4xl rounded-xl bg-white p-6 text-slate-900 shadow-sm"
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
              <LiveFactCheckPanel />
            </div>
          </LiveKitRoom>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-shell flex min-h-screen flex-col bg-[#F8F5EC] text-[#192F50] md:flex-row dark:bg-[#101D30] dark:text-[#F8F5EC] dark:[color-scheme:dark]">
      
      <DashboardSidebar />

      <div className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        {showAudioTest ? (
          <section className="mx-auto max-w-md">
            <button
              type="button"
              onClick={() => setShowAudioTest(false)}
              className="mb-6 text-sm font-semibold text-[#B58A42] hover:underline dark:text-[#D9AD60]"
            >
              ← Back to Dashboard
            </button>

            <div className="rounded-2xl border border-[#E5DFD2] bg-white p-7 shadow-sm dark:border-[#3B4C63] dark:bg-[#20334E]">
              <p className="mb-2 text-sm font-medium text-[#B58A42] dark:text-[#D9AD60]">
                PHASE 1 · AUDIO FOUNDATION
              </p>

              <h1 className="mb-4 text-2xl font-bold">
                Join Audio Test Room
              </h1>

              <p className="mb-6 text-slate-500 dark:text-slate-300">
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
                  <label
                    htmlFor="room"
                    className="mb-1 block text-sm text-slate-700 dark:text-slate-200"
                  >
                    Room name
                  </label>

                  <input
                    id="room"
                    value={roomName}
                    onChange={(event) => setRoomName(event.target.value)}
                    required
                    pattern="[a-zA-Z0-9_-]{1,64}"
                    className="w-full rounded-lg border border-[#D8DDE5] bg-[#FAFAF8] p-3 text-slate-900 dark:border-[#52637C] dark:bg-[#172940] dark:text-[#F8F5EC]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="participant"
                    className="mb-1 block text-sm text-slate-700 dark:text-slate-200"
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
                    className="w-full rounded-lg border border-[#D8DDE5] bg-[#FAFAF8] p-3 text-slate-900 dark:border-[#52637C] dark:bg-[#172940] dark:text-[#F8F5EC]"
                  />
                </div>

                {error && (
                  <p role="alert" className="text-sm text-red-500">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-[#192F50] p-3 font-semibold text-white hover:bg-[#304765] disabled:opacity-50"
                >
                  {loading ? "Connecting..." : "Join audio room"}
                </button>
              </form>

              <p className="mt-5 text-xs text-slate-500 dark:text-slate-300">
                Development test only. Participant names are not yet
                verified through sign-in.
              </p>
            </div>
          </section>
        ) : (
          <div className="mx-auto max-w-7xl">
            <DashboardOverview />

            <section className="mt-8 rounded-2xl border border-[#E5DFD2] bg-white p-5 dark:border-[#3B4C63] dark:bg-[#20334E]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-bold text-[#192F50] dark:text-[#F8F5EC]">
                    Audio Foundation Test
                  </h2>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                    Test LiveKit microphone and transcription.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAudioTest(true)}
                  className="rounded-xl bg-[#192F50] px-5 py-3 text-sm font-semibold text-white hover:bg-[#304765]"
                >
                  Open Audio Test
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
