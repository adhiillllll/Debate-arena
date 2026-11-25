"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import DashboardSidebar from "@/components/dashboard-sidebar";

type PrecheckQuestion = {
  question_id: string;
  question: string;
  core_concept: string;
  expected_criteria: string[];
  common_fallacies: string[];
};

type StoredBrief = {
  id: string;
  debateId: string;
  coreSummary: string;
  modelName: string;
  briefData: {
    core_concepts: string[];
    key_premises: string[];
    questions: PrecheckQuestion[];
  };
};

type SubmissionRecord = {
  id: string;
  questionId: string;
  debaterResponse: string;
  isValid: boolean;
  score: number | null;
  feedback: string;
  suggestion: string | null;
};

type DebateSummary = {
  id: string;
  title: string;
  topic: string;
  description: string | null;
  category: string | null;
  durationMinutes: number;
  status: string;
};

export default function DebatePrecheckPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: debateId } = use(params);

  const [debate, setDebate] = useState<DebateSummary | null>(null);
  const [role, setRole] = useState<string>("");
  const [brief, setBrief] = useState<StoredBrief | null>(null);
  const [submissions, setSubmissions] = useState<
    Record<string, SubmissionRecord>
  >({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadPrecheckData() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/debates/${debateId}/precheck`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load precheck data.");
      }

      setDebate(data.debate);
      setRole(data.participant?.role ?? "");
      setBrief(data.topicBrief ?? null);

      const subMap: Record<string, SubmissionRecord> = {};
      const draftMap: Record<string, string> = {};
      for (const item of data.submissions ?? []) {
        subMap[item.questionId] = item;
        draftMap[item.questionId] = item.debaterResponse;
      }
      setSubmissions(subMap);
      setDrafts((prev) => ({ ...draftMap, ...prev }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPrecheckData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debateId]);

  async function handleGenerateBrief() {
    setGenerating(true);
    setError("");
    try {
      const response = await fetch(`/api/debates/${debateId}/precheck`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_brief" }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate topic brief.");
      }
      await loadPrecheckData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Topic brief generation failed."
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleValidateQuestion(questionId: string) {
    const answer = (drafts[questionId] ?? "").trim();
    if (!answer) return;

    setValidatingId(questionId);
    setError("");
    try {
      const response = await fetch(`/api/debates/${debateId}/precheck`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          debaterResponse: answer,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Validation failed.");
      }

      const sub = data.submission;
      setSubmissions((prev) => ({
        ...prev,
        [questionId]: {
          id: sub.id,
          questionId: sub.question_id,
          debaterResponse: sub.debater_response,
          isValid: sub.is_valid,
          score: sub.score,
          feedback: sub.feedback,
          suggestion: sub.suggestion,
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed.");
    } finally {
      setValidatingId(null);
    }
  }

  const questions = brief?.briefData?.questions ?? [];
  const passedCount = questions.filter(
    (q) => submissions[q.question_id]?.isValid
  ).length;
  const allPassed = questions.length > 0 && passedCount === questions.length;

  return (
    <main className="dashboard-shell flex min-h-screen flex-col bg-[#F8F5EC] text-[#192F50] md:flex-row dark:bg-[#101D30] dark:text-[#F8F5EC]">
      <DashboardSidebar />

      <div className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/"
              className="text-sm font-semibold text-[#B58A42] hover:underline dark:text-[#D9AD60]"
            >
              ← Back to Dashboard
            </Link>

            <Link
              href={`/debates/${debateId}/live`}
              className="rounded-xl bg-[#192F50] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#304765] dark:bg-[#D9AD60] dark:text-[#101D30] dark:hover:bg-[#e5bc73]"
            >
              Enter Live Debate Room →
            </Link>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-[#E5DFD2] bg-white p-8 text-sm text-slate-500 dark:border-[#3B4C63] dark:bg-[#20334E]">
              Loading debate precheck workspace...
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

              {debate && (
                <header className="mb-6 rounded-2xl border border-[#E5DFD2] bg-white p-6 shadow-sm dark:border-[#3B4C63] dark:bg-[#20334E]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-[#F3EBDD] px-3 py-1 text-xs font-semibold text-[#B58A42] dark:bg-[#2B3543] dark:text-[#D9AD60]">
                      {debate.category ?? "General"} · {debate.durationMinutes}{" "}
                      min · Role: {role}
                    </span>

                    <span className="text-xs font-medium text-slate-500">
                      Readiness: {passedCount}/{questions.length} Passed
                    </span>
                  </div>

                  <h1 className="mt-3 text-2xl font-bold">{debate.title}</h1>

                  {debate.description && (
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {debate.description}
                    </p>
                  )}
                </header>
              )}

              {/* Topic Brief Overview */}
              {!brief ? (
                <section className="rounded-2xl border border-dashed border-[#D9AD60] bg-white p-6 text-center dark:bg-[#20334E]">
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    The AI Topic Brief has not been generated for this debate
                    yet (ensure Uvicorn is running on port 8000).
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleGenerateBrief()}
                    disabled={generating}
                    className="mt-4 rounded-xl bg-[#192F50] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#304765] disabled:opacity-50"
                  >
                    {generating
                      ? "Generating Topic Brief..."
                      : "Generate AI Topic Brief"}
                  </button>
                </section>
              ) : (
                <>
                  <section className="mb-8 rounded-2xl border border-[#E5DFD2] bg-white p-6 shadow-sm dark:border-[#3B4C63] dark:bg-[#20334E]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-lg font-bold">
                        AI Topic Brief & Core Framing
                      </h2>
                      {role === "MODERATOR" && (
                        <button
                          type="button"
                          onClick={() => void handleGenerateBrief()}
                          disabled={generating}
                          className="rounded-lg border border-[#D8DDE5] px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-[#52637C]"
                        >
                          {generating ? "Regenerating..." : "Regenerate Brief"}
                        </button>
                      )}
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                      {brief.coreSummary}
                    </p>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl bg-[#FAFAF8] p-4 dark:bg-[#172940]">
                        <h3 className="text-xs font-bold uppercase tracking-wide text-[#B58A42] dark:text-[#D9AD60]">
                          Core Concepts
                        </h3>
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                          {brief.briefData.core_concepts.map((concept, i) => (
                            <li key={i}>{concept}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-xl bg-[#FAFAF8] p-4 dark:bg-[#172940]">
                        <h3 className="text-xs font-bold uppercase tracking-wide text-[#B58A42] dark:text-[#D9AD60]">
                          Key Premises
                        </h3>
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                          {brief.briefData.key_premises.map((premise, i) => (
                            <li key={i}>{premise}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </section>

                  {/* Precheck Questions */}
                  <section className="space-y-5">
                    <h2 className="text-lg font-bold">
                      Debater Precheck Validation
                    </h2>

                    {questions.map((q) => {
                      const result = submissions[q.question_id];
                      const isValidating = validatingId === q.question_id;

                      return (
                        <article
                          key={q.question_id}
                          className="rounded-2xl border border-[#E5DFD2] bg-white p-6 shadow-sm dark:border-[#3B4C63] dark:bg-[#20334E]"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold uppercase tracking-wide text-[#B58A42] dark:text-[#D9AD60]">
                              {q.question_id.toUpperCase()} · {q.core_concept}
                            </span>

                            {result && (
                              <span
                                className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                                  result.isValid
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {result.isValid ? "Valid" : "Needs Refinement"} (
                                {Math.round((result.score ?? 0) * 100)}%)
                              </span>
                            )}
                          </div>

                          <p className="mt-2 font-semibold">{q.question}</p>

                          <textarea
                            rows={3}
                            value={drafts[q.question_id] ?? ""}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [q.question_id]: e.target.value,
                              }))
                            }
                            placeholder="Write your argument or position for this precheck question (English or Malayalam)..."
                            className="mt-3 w-full rounded-xl border border-[#D8DDE5] bg-[#FAFAF8] p-3 text-sm outline-none focus:border-[#D9AD60] dark:border-[#52637C] dark:bg-[#172940]"
                          />

                          <div className="mt-3 flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                void handleValidateQuestion(q.question_id)
                              }
                              disabled={
                                isValidating ||
                                !(drafts[q.question_id] ?? "").trim()
                              }
                              className="rounded-xl bg-[#192F50] px-4 py-2 text-xs font-semibold text-white hover:bg-[#304765] disabled:opacity-50"
                            >
                              {isValidating
                                ? "Validating with AI..."
                                : "Validate Response"}
                            </button>
                          </div>

                          {result && (
                            <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
                              <p>
                                <strong>AI Feedback:</strong> {result.feedback}
                              </p>
                              {result.suggestion && (
                                <p className="text-amber-900">
                                  <strong>Suggestion:</strong>{" "}
                                  {result.suggestion}
                                </p>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </section>

                  {/* Launch Live Arena Footer */}
                  <section className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E5DFD2] bg-white p-6 shadow-sm dark:border-[#3B4C63] dark:bg-[#20334E]">
                    <div>
                      <h3 className="text-base font-bold">
                        {allPassed
                          ? "Precheck Complete — Ready for the Live Debate"
                          : "Live Debate Room"}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                        {allPassed
                          ? "All precheck readiness questions passed. Enter the live audio room to begin."
                          : `Completed ${passedCount} of ${questions.length} precheck validations. You can enter the live room anytime as ${role || "a participant"}.`}
                      </p>
                    </div>

                    <Link
                      href={`/debates/${debateId}/live`}
                      className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition ${
                        allPassed
                          ? "bg-emerald-700 hover:bg-emerald-800"
                          : "bg-[#192F50] hover:bg-[#304765]"
                      }`}
                    >
                      Enter Live Debate Room →
                    </Link>
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}