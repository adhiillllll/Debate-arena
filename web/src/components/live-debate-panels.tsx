"use client";

import { useEffect, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";

export type LiveTranscriptItem = {
  id?: string;
  transcriptId?: string | null;
  participantIdentity: string;
  participantId?: string | null;
  displayName?: string;
  role?: string;
  text: string;
  timestamp: string;
  language?: string;
};

export type FactCheckVerdict =
  | "SUPPORTED"
  | "REFUTED"
  | "PARTIALLY_SUPPORTED"
  | "CONTRADICTORY_EVIDENCE"
  | "INSUFFICIENT_EVIDENCE";

export type FactCheckSource = {
  chunkId: string;
  sourceId: string;
  chunkIndex: number;
  similarity: number;
  title: string;
  url: string;
  content: string;
};

export type LiveFactCheckItem = {
  localId: string;
  claimId?: string;
  factCheckResultId?: string;
  participantIdentity: string;
  participantId?: string | null;
  displayName?: string;
  role?: string;
  originalText: string;
  normalizedClaim: string;
  verdict: FactCheckVerdict;
  confidence: number;
  explanation: string;
  timestamp: string;
  sources: FactCheckSource[];
  reviewStatus: "PENDING" | "REVIEWED" | "DISMISSED";
};

export type RoomParticipantSummary = {
  id: string;
  userId: string;
  role: "MODERATOR" | "DEBATER" | "AUDIENCE";
  displayName: string;
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

export function LiveTranscriptPanel({
  initialTranscripts = [],
  participants = [],
}: {
  initialTranscripts?: LiveTranscriptItem[];
  participants?: RoomParticipantSummary[];
}) {
  const room = useRoomContext();
  const [transcripts, setTranscripts] =
    useState<LiveTranscriptItem[]>(initialTranscripts);

  const participantMap = new Map(participants.map((p) => [p.id, p]));

  useEffect(() => {
    const handleDataReceived = (
      payload: Uint8Array,
      _participant: unknown,
      _kind: unknown,
      topic?: string
    ) => {
      if (topic !== "debate-transcript") return;

      try {
        const decoded = new TextDecoder().decode(payload);
        const message = JSON.parse(decoded) as LiveTranscriptItem & {
          type?: string;
        };

        if (
          message.type !== "transcript" ||
          !message.participantIdentity ||
          !message.text
        ) {
          return;
        }

        const matched =
          participantMap.get(message.participantId ?? "") ??
          participantMap.get(message.participantIdentity);

        setTranscripts((previous) => [
          ...previous,
          {
            ...message,
            displayName:
              message.displayName ?? matched?.displayName ?? "Speaker",
            role: message.role ?? matched?.role ?? "DEBATER",
          },
        ]);
      } catch (error) {
        console.error("Failed to parse transcript:", error);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  // Group speakers dynamically (prioritizing DEBATER / MODERATOR roster)
  const speakerGroups: Array<{
    key: string;
    label: string;
    role: string;
    items: LiveTranscriptItem[];
  }> = [];

  const seenKeys = new Set<string>();

  for (const p of participants) {
    if (p.role === "AUDIENCE" || p.role === "MODERATOR") continue;
    seenKeys.add(p.id);
    speakerGroups.push({
      key: p.id,
      label: p.displayName,
      role: p.role,
      items: transcripts.filter(
        (t) =>
          t.participantId === p.id || t.participantIdentity === p.id
      ),
    });
  }

  for (const item of transcripts) {
    const speakerKey = item.participantId || item.participantIdentity;
    if (!seenKeys.has(speakerKey)) {
      seenKeys.add(speakerKey);
      speakerGroups.push({
        key: speakerKey,
        label: item.displayName || item.participantIdentity,
        role: item.role || "SPEAKER",
        items: transcripts.filter(
          (t) => (t.participantId || t.participantIdentity) === speakerKey
        ),
      });
    }
  }

  return (
    <section className="mt-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-[#192F50] dark:text-[#F8F5EC]">
          Live Debate Transcript
        </h3>
        <span className="text-xs text-slate-500">
          {transcripts.length}{" "}
          {transcripts.length === 1 ? "utterance" : "utterances"}
        </span>
      </div>

      {speakerGroups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
          Waiting for debaters to speak...
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {speakerGroups.map((group, groupIdx) => {
            const borderClass =
              groupIdx % 2 === 0
                ? "border-blue-200 dark:border-blue-800/60"
                : "border-amber-200 dark:border-amber-800/60";
            const badgeClass =
              groupIdx % 2 === 0
                ? "bg-blue-100 text-blue-800"
                : "bg-amber-100 text-amber-800";

            return (
              <div
                key={group.key}
                className={`rounded-xl border bg-white p-4 dark:bg-[#172940] ${borderClass}`}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="font-semibold text-[#192F50] dark:text-[#F8F5EC]">
                    {group.label}
                  </h4>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badgeClass}`}
                  >
                    {group.role}
                  </span>
                </div>

                {group.items.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Waiting for speech...
                  </p>
                ) : (
                  <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                    {group.items.map((item, idx) => (
                      <div
                        key={item.id ?? `${item.timestamp}-${idx}`}
                        className="rounded-lg bg-[#F8F5EC] p-3 dark:bg-[#20334E]"
                      >
                        <p className="text-sm text-slate-800 dark:text-slate-100">
                          {item.text}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function LiveFactCheckPanel({
  initialItems = [],
  canModerate = false,
}: {
  initialItems?: LiveFactCheckItem[];
  canModerate?: boolean;
}) {
  const room = useRoomContext();
  const [items, setItems] = useState<LiveFactCheckItem[]>(initialItems);

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
        const message = JSON.parse(decoded) as Omit<
          LiveFactCheckItem,
          "localId" | "reviewStatus"
        > & { type?: string };

        if (
          message.type !== "fact_check" ||
          !message.participantIdentity ||
          !message.normalizedClaim
        ) {
          return;
        }

        const card: LiveFactCheckItem = {
          ...message,
          sources: Array.isArray(message.sources) ? message.sources : [],
          localId:
            message.factCheckResultId ??
            `${message.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
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

  function updateReviewStatus(
    localId: string,
    status: "REVIEWED" | "DISMISSED"
  ) {
    setItems((previous) =>
      previous.map((item) =>
        item.localId === localId ? { ...item, reviewStatus: status } : item
      )
    );
  }

  return (
    <section className="mt-8 border-t border-slate-200 pt-6 dark:border-[#3B4C63]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold text-[#192F50] dark:text-[#F8F5EC]">
            AI Evidence Assistant {canModerate ? "(Moderator View)" : ""}
          </h3>
          <p className="text-xs text-slate-500">
            Evidence-based verification grounded in curated sources. Human
            moderator retains final authority.
          </p>
        </div>

        <span className="rounded-full bg-[#F3EBDD] px-3 py-1 text-xs font-semibold text-[#B58A42] dark:bg-[#2B3543] dark:text-[#D9AD60]">
          {items.length} {items.length === 1 ? "claim" : "claims"} analyzed
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500 dark:border-[#3B4C63] dark:bg-[#172940]">
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
                className={`rounded-xl border p-4 transition ${
                  isDismissed
                    ? "border-slate-200 bg-slate-50 opacity-60 dark:border-[#3B4C63] dark:bg-[#172940]"
                    : "border-slate-200 bg-white shadow-xs dark:border-[#3B4C63] dark:bg-[#172940]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-[#192F50] px-2.5 py-0.5 text-xs font-semibold text-white">
                      {item.displayName || item.participantIdentity}
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
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Claim: {item.normalizedClaim}
                  </p>
                  {item.originalText &&
                    item.originalText !== item.normalizedClaim && (
                      <p className="mt-1 text-xs italic text-slate-500">
                        Quote: “{item.originalText}”
                      </p>
                    )}
                </div>

                <p className="mt-2 rounded-lg bg-[#F8F5EC] p-3 text-sm text-slate-700 dark:bg-[#20334E] dark:text-slate-200">
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
                          className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs dark:border-[#3B4C63] dark:bg-[#20334E]"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            {isSafeHttpUrl(source.url) ? (
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-blue-700 hover:underline dark:text-[#D9AD60]"
                              >
                                {source.title}
                              </a>
                            ) : (
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {source.title}
                              </span>
                            )}

                            <span className="text-slate-500">
                              Similarity: {Math.round(source.similarity * 100)}%
                            </span>
                          </div>

                          <p className="mt-1 text-slate-600 dark:text-slate-300">
                            {source.content}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {canModerate && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-[#3B4C63]">
                    <span className="text-xs font-medium text-slate-500">
                      Moderator Status:{" "}
                      <strong className="text-slate-700 dark:text-slate-200">
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
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}