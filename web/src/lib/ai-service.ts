const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000";

export type PrecheckQuestion = {
  question_id: string;
  question: string;
  core_concept: string;
  expected_criteria: string[];
  common_fallacies: string[];
};

export type TopicBriefPayload = {
  id: string;
  debate_id: string;
  core_summary: string;
  core_concepts: string[];
  key_premises: string[];
  questions: PrecheckQuestion[];
  model_name: string;
};

export type PrecheckValidationPayload = {
  id: string;
  debate_id: string;
  participant_id: string;
  question_id: string;
  question_text: string;
  debater_response: string;
  is_valid: boolean;
  score: number;
  feedback: string;
  suggestion: string | null;
};

export type DebateReportRequestPayload = {
  debate_id: string;
  title: string;
  topic: string;
  description?: string | null;
  category?: string | null;
  core_summary?: string | null;
  participants: Array<{
    participant_id: string;
    display_name: string;
    role: string;
    vote_count: number;
  }>;
  transcripts: Array<{
    speaker_name: string;
    role: string;
    text: string;
    timestamp: string;
  }>;
  claims: Array<{
    speaker_name: string;
    normalized_claim: string;
    verdict: string;
    confidence?: number | null;
    explanation: string;
    sources: string[];
  }>;
  total_votes: number;
};

export type DebateReportResponsePayload = {
  debate_id: string;
  summary: string;
  report_data: {
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
  model_name: string;
};


function buildHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.INTERNAL_API_SECRET) {
    headers["X-Internal-Secret"] = process.env.INTERNAL_API_SECRET;
  }
  return headers;
}

export async function requestTopicBrief(input: {
  debate_id: string;
  title: string;
  topic: string;
  description?: string | null;
  category?: string | null;
}): Promise<TopicBriefPayload> {
  const response = await fetch(`${AI_SERVICE_URL}/ai/topic-brief`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(
      errBody.detail ?? `AI topic brief service returned ${response.status}`
    );
  }

  return (await response.json()) as TopicBriefPayload;
}

export async function requestPrecheckValidation(input: {
  debate_id: string;
  participant_id: string;
  question_id: string;
  debater_response: string;
}): Promise<PrecheckValidationPayload> {
  const response = await fetch(`${AI_SERVICE_URL}/ai/validate-precheck`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(
      errBody.detail ?? `AI precheck validator returned ${response.status}`
    );
  }

  return (await response.json()) as PrecheckValidationPayload;
}

export async function requestDebateReport(
  input: DebateReportRequestPayload
): Promise<DebateReportResponsePayload> {
  const response = await fetch(`${AI_SERVICE_URL}/ai/generate-report`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(45_000),
    cache: "no-store",
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(
      errBody.detail ?? `AI report generator returned ${response.status}`
    );
  }

  return (await response.json()) as DebateReportResponsePayload;
}