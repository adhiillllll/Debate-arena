"use client";

import { useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import {
  ControlBar,
  LiveKitRoom,
  RoomAudioRenderer,
} from "@livekit/components-react";
import "@livekit/components-styles";
import DashboardSidebar from "@/components/dashboard-sidebar";
import {
  LiveFactCheckItem,
  LiveFactCheckPanel,
  LiveTranscriptItem,
  LiveTranscriptPanel,
  RoomParticipantSummary,
} from "@/components/live-debate-panels";

type LiveDebateInfo = {
  id: string;
  title: string;
  topic: string;
  description: string | null;
  category: string | null;
  durationMinutes: number;
  maxDebaters: number;
  status: string;
  visibility: string;
  coreSummary: string | null;
};

type TokenConnection = {
  serverUrl: string;
  token: string;
  participant: {
    id: string;
    role: "MODERATOR" | "DEBATER" | "AUDIENCE";
    displayName: string;
    canPublish: boolean;
  };
};

type VoteTallyItem = {
  participantId: string;
  userId: string;
  displayName: string;
  votes: number;
};

export default function LiveDebateRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: debateId } = use(params);
  const initializedRef = useRef(false);

  const [debate, setDebate] = useState<LiveDebateInfo | null>(null);
  const [participants, setParticipants] = useState<RoomParticipantSummary[]>(
    []
  );
  const [initialTranscripts, setInitialTranscripts] = useState<
    LiveTranscriptItem[]
  >([]);
  const [initialFactChecks, setInitialFactChecks] = useState<
    LiveFactCheckItem[]
  >([]);
  const [connection, setConnection] = useState<TokenConnection | null>(null);
  const [voteTally, setVoteTally] = useState<VoteTallyItem[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [myVoteParticipantId, setMyVoteParticipantId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingParticipantId, setUpdatingParticipantId] = useState<
    string | null
  >(null);
  const [submittingVoteId, setSubmittingVoteId] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [error, setError] = useState("");

  async function refreshVotes() {
    try {
      const voteRes = await fetch(`/api/debates/${debateId}/vote`);
      const voteData = await voteRes.json();
      if (voteRes.ok) {
        setVoteTally(voteData.tally ?? []);
        setTotalVotes(voteData.totalVotes ?? 0);
        setMyVoteParticipantId(voteData.myVoteParticipantId ?? null);
      }
    } catch {
      // Non-fatal background vote tally refresh
    }
  }

  async function refreshRoomRoster() {
    try {
      const [roomRes, voteRes] = await Promise.all([
        fetch(`/api/debates/${debateId}/live`),
        fetch(`/api/debates/${debateId}/vote`),
      ]);
      const roomData = await roomRes.json();
      if (roomRes.ok) {
        setDebate(roomData.debate);
        setParticipants(roomData.participants ?? []);
      }
      const voteData = await voteRes.json();
      if (voteRes.ok) {
        setVoteTally(voteData.tally ?? []);
        setTotalVotes(voteData.totalVotes ?? 0);
        setMyVoteParticipantId(voteData.myVoteParticipantId ?? null);
      }
    } catch {
      // Non-fatal background roster refresh
    }
  }

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    async function initRoom() {
      setLoading(true);
      setError("");
      try {
        const tokenRes = await fetch("/api/livekit-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ debateId }),
        });
        const tokenData = await tokenRes.json();

        if (!tokenRes.ok) {
          throw new Error(tokenData.error ?? "Unable to authorize room access.");
        }

        const [roomRes, voteRes] = await Promise.all([
          fetch(`/api/debates/${debateId}/live`),
          fetch(`/api/debates/${debateId}/vote`),
        ]);
        const roomData = await roomRes.json();

        if (!roomRes.ok) {
          throw new Error(roomData.error ?? "Unable to load debate room.");
        }

        const voteData = await voteRes.json().catch(() => ({}));

        setConnection({
          serverUrl: tokenData.serverUrl,
          token: tokenData.token,
          participant: tokenData.participant,
        });
        setDebate(roomData.debate);
        setParticipants(roomData.participants ?? []);
        setInitialTranscripts(roomData.transcripts ?? []);
        setInitialFactChecks(roomData.factChecks ?? []);

        if (voteRes.ok) {
          setVoteTally(voteData.tally ?? []);
          setTotalVotes(voteData.totalVotes ?? 0);
          setMyVoteParticipantId(voteData.myVoteParticipantId ?? null);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to enter live room."
        );
      } finally {
        setLoading(false);
      }
    }

    void initRoom();
  }, [debateId]);

  async function handleCopyInviteLink() {
    const inviteUrl = `${window.location.origin}/debates/${debateId}/precheck`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2500);
    } catch {
      setError(`Share this link with debaters: ${inviteUrl}`);
    }
  }

  async function handleUpdateStatus(nextStatus: "LIVE" | "ENDED") {
    setUpdatingStatus(true);
    setError("");
    try {
      const response = await fetch(`/api/debates/${debateId}/live`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not update debate status.");
      }
      setDebate((prev) =>
        prev ? { ...prev, status: data.debate.status } : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed.");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleRoleChange(
    targetParticipantId: string,
    nextRole: "DEBATER" | "AUDIENCE"
  ) {
    setUpdatingParticipantId(targetParticipantId);
    setError("");
    try {
      const response = await fetch(`/api/debates/${debateId}/live`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: targetParticipantId,
          role: nextRole,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not update participant role.");
      }
      await refreshRoomRoster();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Role update failed.");
    } finally {
      setUpdatingParticipantId(null);
    }
  }

  async function handleCastVote(targetParticipantId: string) {
    setSubmittingVoteId(targetParticipantId);
    setError("");
    try {
      const response = await fetch(`/api/debates/${debateId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: targetParticipantId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not record your vote.");
      }
      setVoteTally(data.tally ?? []);
      setTotalVotes(data.totalVotes ?? 0);
      setMyVoteParticipantId(data.myVoteParticipantId ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vote submission failed.");
    } finally {
      setSubmittingVoteId(null);
    }
  }

  const canModerate = connection?.participant.role === "MODERATOR";
  const canSpeak = connection?.participant.canPublish ?? false;
  const debaterCount = participants.filter((p) => p.role === "DEBATER").length;

  return (
    <main className="dashboard-shell flex min-h-screen flex-col bg-[#F8F5EC] text-[#192F50] md:flex-row dark:bg-[#101D30] dark:text-[#F8F5EC]">
      <DashboardSidebar />

      <div className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Link
              href={`/debates/${debateId}/precheck`}
              className="text-sm font-semibold text-[#B58A42] hover:underline dark:text-[#D9AD60]"
            >
              ← Back to Topic Brief & Precheck
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCopyInviteLink()}
                className="rounded-xl border border-[#D9AD60] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#192F50] hover:bg-[#F3EBDD] dark:bg-[#20334E] dark:text-[#F8F5EC]"
              >
                {copiedInvite
                  ? "Invite Link Copied!"
                  : "Copy Debater Invite Link"}
              </button>

              <Link
                href={`/debates/${debateId}/report`}
                className="rounded-xl border border-[#192F50] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#192F50] hover:bg-slate-100 dark:border-[#52637C] dark:bg-[#20334E] dark:text-[#F8F5EC]"
              >
                Post-Debate Report →
              </Link>

              {connection && (
                <span className="rounded-full bg-[#192F50] px-3 py-1 text-xs font-semibold text-white">
                  Joined as {connection.participant.displayName} (
                  {connection.participant.role})
                </span>
              )}
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-[#E5DFD2] bg-white p-8 text-sm text-slate-500 dark:border-[#3B4C63] dark:bg-[#20334E]">
              Connecting to live debate arena...
            </div>
          ) : error && !connection ? (
            <div
              role="alert"
              className="rounded-2xl border border-red-300 bg-red-50 p-6 text-sm text-red-700"
            >
              {error}
            </div>
          ) : (
            <>
              {error && (
                <div
                  role="alert"
                  className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              {debate && (
                <header className="mb-6 rounded-2xl border border-[#E5DFD2] bg-white p-6 shadow-sm dark:border-[#3B4C63] dark:bg-[#20334E]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                          debate.status === "LIVE"
                            ? "bg-emerald-100 text-emerald-800"
                            : debate.status === "ENDED"
                            ? "bg-slate-200 text-slate-700"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {debate.status}
                      </span>
                      <span className="rounded-full bg-[#F3EBDD] px-3 py-1 text-xs font-semibold text-[#B58A42] dark:bg-[#2B3543] dark:text-[#D9AD60]">
                        {debate.category ?? "General"} ·{" "}
                        {debate.durationMinutes} min · Debaters: {debaterCount}/
                        {debate.maxDebaters}
                      </span>
                    </div>

                    {canModerate && (
                      <div className="flex items-center gap-2">
                        {debate.status !== "LIVE" &&
                          debate.status !== "ENDED" && (
                            <button
                              type="button"
                              onClick={() => void handleUpdateStatus("LIVE")}
                              disabled={updatingStatus}
                              className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                            >
                              {updatingStatus
                                ? "Starting..."
                                : "Start Live Debate"}
                            </button>
                          )}
                        {debate.status === "LIVE" && (
                          <button
                            type="button"
                            onClick={() => void handleUpdateStatus("ENDED")}
                            disabled={updatingStatus}
                            className="rounded-xl bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50"
                          >
                            {updatingStatus ? "Ending..." : "End Debate"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <h1 className="mt-3 text-2xl font-bold">{debate.title}</h1>

                  {debate.coreSummary ? (
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {debate.coreSummary}
                    </p>
                  ) : (
                    debate.description && (
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        {debate.description}
                      </p>
                    )
                  )}

                  {debate.status === "ENDED" && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D9AD60] bg-[#F8F5EC] p-4 dark:bg-[#172940]">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                        This debate session has ended. Review the synthesized
                        evidence audit, argument breakdown, and poll results.
                      </p>
                      <Link
                        href={`/debates/${debateId}/report`}
                        className="rounded-xl bg-[#192F50] px-4 py-2 text-xs font-semibold text-white hover:bg-[#304765] dark:bg-[#D9AD60] dark:text-[#101D30]"
                      >
                        Open Analytical Report →
                      </Link>
                    </div>
                  )}

                  {/* Participant Roster & Role Controls */}
                  <div className="mt-4 border-t border-slate-100 pt-4 dark:border-[#3B4C63]">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Participants ({participants.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => void refreshRoomRoster()}
                        className="text-xs font-semibold text-[#B58A42] hover:underline dark:text-[#D9AD60]"
                      >
                        Refresh Roster
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {participants.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-[#FAFAF8] px-3 py-1.5 text-xs dark:border-[#3B4C63] dark:bg-[#172940]"
                        >
                          <span className="font-semibold">{p.displayName}</span>
                          <span className="rounded bg-[#F3EBDD] px-1.5 py-0.5 text-[10px] font-bold text-[#B58A42] dark:bg-[#2B3543] dark:text-[#D9AD60]">
                            {p.role}
                          </span>

                          {canModerate && p.role !== "MODERATOR" && (
                            <button
                              type="button"
                              disabled={updatingParticipantId === p.id}
                              onClick={() =>
                                void handleRoleChange(
                                  p.id,
                                  p.role === "DEBATER" ? "AUDIENCE" : "DEBATER"
                                )
                              }
                              className="ml-1 rounded border border-slate-300 px-2 py-0.5 text-[11px] font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-[#52637C]"
                            >
                              {p.role === "DEBATER"
                                ? "Set Audience"
                                : "Make Debater"}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </header>
              )}

              {connection && (
                <LiveKitRoom
                  serverUrl={connection.serverUrl}
                  token={connection.token}
                  connect={true}
                  audio={canSpeak}
                  video={false}
                >
                  <div
                    data-lk-theme="default"
                    className="rounded-2xl border border-[#E5DFD2] bg-white p-6 text-slate-900 shadow-sm dark:border-[#3B4C63] dark:bg-[#20334E] dark:text-[#F8F5EC]"
                  >
                    <RoomAudioRenderer />

                    {canSpeak ? (
                      <div className="mb-4 rounded-xl bg-[#F8F5EC] p-4 dark:bg-[#172940]">
                        <p className="mb-3 text-xs font-medium text-slate-600 dark:text-slate-300">
                          Microphone active ({connection.participant.role}).
                          Spoken Malayalam and English utterances are
                          transcribed, fact-checked, and persisted to the
                          debate record automatically.
                        </p>
                        <ControlBar
                          controls={{
                            microphone: true,
                            camera: false,
                            screenShare: false,
                          }}
                        />
                      </div>
                    ) : (
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 dark:border-[#3B4C63] dark:bg-[#172940] dark:text-slate-300">
                        <span>
                          You are connected in{" "}
                          <strong>Listen-Only Audience Mode</strong>. Complete
                          precheck or ask the moderator to assign you a Debater
                          slot to speak.
                        </span>
                        <button
                          type="button"
                          onClick={() => window.location.reload()}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1 font-semibold text-slate-800 hover:bg-slate-100"
                        >
                          Reload Permissions
                        </button>
                      </div>
                    )}

                    <LiveTranscriptPanel
                      initialTranscripts={initialTranscripts}
                      participants={participants}
                    />

                    <LiveFactCheckPanel
                      initialItems={initialFactChecks}
                      canModerate={canModerate}
                    />

                    {/* Live Audience Voting Panel */}
                    <section className="mt-8 border-t border-slate-200 pt-6 dark:border-[#3B4C63]">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-lg font-bold text-[#192F50] dark:text-[#F8F5EC]">
                            Audience Poll & Live Voting
                          </h3>
                          <p className="text-xs text-slate-500">
                            One verified vote per account. Vote for the debater
                            who presented the strongest evidence-backed case.
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="rounded-full bg-[#F3EBDD] px-3 py-1 text-xs font-semibold text-[#B58A42] dark:bg-[#2B3543] dark:text-[#D9AD60]">
                            {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
                          </span>
                          <button
                            type="button"
                            onClick={() => void refreshVotes()}
                            className="text-xs font-semibold text-[#B58A42] hover:underline dark:text-[#D9AD60]"
                          >
                            Refresh Tally
                          </button>
                        </div>
                      </div>

                      {voteTally.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500 dark:border-[#3B4C63] dark:bg-[#172940]">
                          Waiting for debaters to be assigned before opening the
                          audience poll...
                        </div>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          {voteTally.map((candidate) => {
                            const pct =
                              totalVotes > 0
                                ? Math.round(
                                    (candidate.votes / totalVotes) * 100
                                  )
                                : 0;
                            const isMyVote =
                              myVoteParticipantId === candidate.participantId;
                            const isSelf =
                              connection.participant.id ===
                              candidate.participantId;
                            const isSubmitting =
                              submittingVoteId === candidate.participantId;

                            return (
                              <div
                                key={candidate.participantId}
                                className={`rounded-xl border p-4 transition ${
                                  isMyVote
                                    ? "border-[#B58A42] bg-[#F8F5EC] dark:border-[#D9AD60] dark:bg-[#172940]"
                                    : "border-slate-200 bg-white dark:border-[#3B4C63] dark:bg-[#172940]"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <p className="font-bold text-[#192F50] dark:text-[#F8F5EC]">
                                      {candidate.displayName}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {candidate.votes}{" "}
                                      {candidate.votes === 1 ? "vote" : "votes"}{" "}
                                      ({pct}%)
                                    </p>
                                  </div>

                                  {isSelf ? (
                                    <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500 dark:bg-[#20334E]">
                                      Your Slot
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={
                                        isSubmitting ||
                                        debate?.status === "CANCELLED"
                                      }
                                      onClick={() =>
                                        void handleCastVote(
                                          candidate.participantId
                                        )
                                      }
                                      className={`rounded-xl px-4 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                                        isMyVote
                                          ? "bg-emerald-700 text-white"
                                          : "bg-[#192F50] text-white hover:bg-[#304765] dark:bg-[#D9AD60] dark:text-[#101D30]"
                                      }`}
                                    >
                                      {isSubmitting
                                        ? "Saving..."
                                        : isMyVote
                                        ? "Voted ✓"
                                        : myVoteParticipantId
                                        ? "Switch Vote"
                                        : "Cast Vote"}
                                    </button>
                                  )}
                                </div>

                                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                  <div
                                    className="h-full bg-[#B58A42] transition-all duration-300 dark:bg-[#D9AD60]"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  </div>
                </LiveKitRoom>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}