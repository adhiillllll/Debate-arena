"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import DashboardSidebar from "@/components/dashboard-sidebar";

type ReportData = {
  executive_summary: string;
  participant_analyses: Array<{
    participant_id: string;
    display_name: string;
    role: string;
    core_stance: string;
    key_arguments: string[];
    evidence_usage_notes: string;
    logical_consistency_notes: string;
  }>;
  claim_highlights: Array<{
    speaker_name: string;
    normalized_claim: string;
    verdict: string;
    explanation: string;
    sources: string[];
  }>;
  unanswered_questions: string[];
  moderator_takeaways: string[];
  vote_summary?: {
    total_votes: number;
    breakdown: Array<{
      participant_id: string;
      display_name: string;
      role: string;
      votes: number;
    }>;
  };
  model_name?: string;
};

type StoredReport = {
  id: string;
  debateId: string;
  summary: string;
  reportData: ReportData;
  generatedAt: string;
};

export default function DebateReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: debateId } = use(params);

  const [debateTitle, setDebateTitle] = useState("");
  const [debateStatus, setDebateStatus] = useState("");
  const [canGenerate, setCanGenerate] = useState(false);
  const [stats, setStats] = useState<{
    transcripts: number;
    factualClaims: number;
    votes: number;
  } | null>(null);
  const [report, setReport] = useState<StoredReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  async function loadReport() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/debates/${debateId}/report`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load report.");
      }
      setDebateTitle(data.debate.title);
      setDebateStatus(data.debate.status);
      setCanGenerate(Boolean(data.canGenerate));
      setStats(data.stats);
      setReport(data.report ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load report.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debateId]);

  async function handleGenerateReport() {
    setGenerating(true);
    setError("");
    try {
      const response = await fetch(`/api/debates/${debateId}/report`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate report.");
      }
      setReport(data.report);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Report generation failed."
      );
    } finally {
      setGenerating(false);
    }
  }

  const data = report?.reportData;

  return (
    <main className="dashboard-shell flex min-h-screen flex-col bg-[#F8F5EC] text-[#192F50] md:flex-row dark:bg-[#101D30] dark:text-[#F8F5EC]">
      <DashboardSidebar />

      <div className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Link
              href={`/debates/${debateId}/live`}
              className="text-sm font-semibold text-[#B58A42] hover:underline dark:text-[#D9AD60]"
            >
              ← Back to Live Debate Room
            </Link>

            {canGenerate && (
              <button
                type="button"
                onClick={() => void handleGenerateReport()}
                disabled={generating}
                className="rounded-xl bg-[#192F50] px-4 py-2 text-xs font-semibold text-white hover:bg-[#304765] disabled:opacity-50 dark:bg-[#D9AD60] dark:text-[#101D30]"
              >
                {generating
                  ? "Synthesizing Analytical Report..."
                  : report
                  ? "Regenerate Report"
                  : "Generate Post-Debate Report"}
              </button>
            )}
          </div>

          {loading ? (
            <div className="rounded-2xl border border-[#E5DFD2] bg-white p-8 text-sm text-slate-500 dark:border-[#3B4C63] dark:bg-[#20334E]">
              Loading post-debate analytical report...
            </div>
          ) : (
            <>
              {error && (
                <div
                  role="alert"
                  className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              <header className="mb-6 rounded-2xl border border-[#E5DFD2] bg-white p-6 shadow-sm dark:border-[#3B4C63] dark:bg-[#20334E]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-[#F3EBDD] px-3 py-1 text-xs font-semibold text-[#B58A42] dark:bg-[#2B3543] dark:text-[#D9AD60]">
                    Post-Debate Analytical Report · Status: {debateStatus}
                  </span>

                  {stats && (
                    <span className="text-xs text-slate-500">
                      {stats.transcripts} utterances · {stats.factualClaims}{" "}
                      claims · {stats.votes} votes
                    </span>
                  )}
                </div>

                <h1 className="mt-3 text-2xl font-bold">{debateTitle}</h1>
              </header>

              {!data ? (
                <section className="rounded-2xl border border-dashed border-[#D9AD60] bg-white p-8 text-center dark:bg-[#20334E]">
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    No analytical report has been generated yet for this debate.
                    {canGenerate
                      ? " Ensure Uvicorn is running on port 8000, then click Generate Post-Debate Report."
                      : " Ask the debate moderator to generate the final report."}
                  </p>
                </section>
              ) : (
                <div className="space-y-6">
                  {/* Executive Summary */}
                  <section className="rounded-2xl border border-[#E5DFD2] bg-white p-6 shadow-sm dark:border-[#3B4C63] dark:bg-[#20334E]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-lg font-bold">Executive Synthesis</h2>
                      {report?.generatedAt && (
                        <span className="text-xs text-slate-400">
                          Generated{" "}
                          {new Date(report.generatedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                      {data.executive_summary}
                    </p>
                  </section>

                  {/* Audience Vote Summary */}
                  {data.vote_summary &&
                    data.vote_summary.breakdown.length > 0 && (
                      <section className="rounded-2xl border border-[#E5DFD2] bg-white p-6 shadow-sm dark:border-[#3B4C63] dark:bg-[#20334E]">
                        <div className="flex items-center justify-between">
                          <h2 className="text-lg font-bold">
                            Audience Poll Results
                          </h2>
                          <span className="text-xs font-semibold text-slate-500">
                            Total Votes: {data.vote_summary.total_votes}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {data.vote_summary.breakdown.map((v) => {
                            const pct =
                              data.vote_summary!.total_votes > 0
                                ? Math.round(
                                    (v.votes /
                                      data.vote_summary!.total_votes) *
                                      100
                                  )
                                : 0;
                            return (
                              <div
                                key={v.participant_id}
                                className="rounded-xl border border-slate-200 bg-[#FAFAF8] p-4 dark:border-[#3B4C63] dark:bg-[#172940]"
                              >
                                <div className="flex items-center justify-between text-sm font-semibold">
                                  <span>{v.display_name}</span>
                                  <span>
                                    {v.votes} ({pct}%)
                                  </span>
                                </div>
                                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                  <div
                                    className="h-full bg-[#B58A42]"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    )}

                  {/* Participant Argument & Evidence Analysis */}
                  {data.participant_analyses.length > 0 && (
                    <section className="grid gap-4 md:grid-cols-2">
                      {data.participant_analyses.map((p) => (
                        <article
                          key={p.participant_id}
                          className="rounded-2xl border border-[#E5DFD2] bg-white p-6 shadow-sm dark:border-[#3B4C63] dark:bg-[#20334E]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-base font-bold">
                              {p.display_name}
                            </h3>
                            <span className="rounded-full bg-[#F3EBDD] px-2.5 py-0.5 text-xs font-semibold text-[#B58A42]">
                              {p.role}
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                            {p.core_stance}
                          </p>

                          <h4 className="mt-4 text-xs font-bold uppercase tracking-wide text-[#B58A42]">
                            Key Arguments
                          </h4>
                          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm">
                            {p.key_arguments.map((arg, idx) => (
                              <li key={idx}>{arg}</li>
                            ))}
                          </ul>

                          <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
                            <strong>Evidence Usage:</strong>{" "}
                            {p.evidence_usage_notes}
                          </p>
                          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
                            <strong>Logical Consistency:</strong>{" "}
                            {p.logical_consistency_notes}
                          </p>
                        </article>
                      ))}
                    </section>
                  )}

                  {/* Fact-Checked Claims Summary */}
                  {data.claim_highlights.length > 0 && (
                    <section className="rounded-2xl border border-[#E5DFD2] bg-white p-6 shadow-sm dark:border-[#3B4C63] dark:bg-[#20334E]">
                      <h2 className="text-lg font-bold">
                        Factual Claims & Evidence Audit
                      </h2>
                      <div className="mt-4 space-y-3">
                        {data.claim_highlights.map((c, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl border border-slate-200 bg-[#FAFAF8] p-4 text-sm dark:border-[#3B4C63] dark:bg-[#172940]"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold">
                                {c.speaker_name}
                              </span>
                              <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-800">
                                {c.verdict}
                              </span>
                            </div>
                            <p className="mt-1.5 font-medium">
                              {c.normalized_claim}
                            </p>
                            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                              {c.explanation}
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Unanswered Questions & Moderator Takeaways */}
                  <section className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-[#E5DFD2] bg-white p-6 shadow-sm dark:border-[#3B4C63] dark:bg-[#20334E]">
                      <h3 className="text-base font-bold">
                        Important Unanswered Questions
                      </h3>
                      <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm">
                        {data.unanswered_questions.map((q, idx) => (
                          <li key={idx}>{q}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-[#E5DFD2] bg-white p-6 shadow-sm dark:border-[#3B4C63] dark:bg-[#20334E]">
                      <h3 className="text-base font-bold">
                        Moderator Takeaways
                      </h3>
                      <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm">
                        {data.moderator_takeaways.map((t, idx) => (
                          <li key={idx}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  </section>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}