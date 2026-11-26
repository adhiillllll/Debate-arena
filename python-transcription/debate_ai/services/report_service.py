"""Post-debate analytical report synthesis service."""

import time
from google.genai import errors, types

from debate_ai.config import EXTRACTION_MODELS, extraction_client
from debate_ai.schemas.report import (
    DebateReportRequest,
    DebateReportResponse,
    GeneratedDebateReport,
)


def generate_debate_report(
    req: DebateReportRequest,
    max_retries: int = 2,
) -> DebateReportResponse:
    """Synthesize persisted transcripts, fact-check verdicts, and votes into an analytical report."""
    participants_text = "\n".join(
        f"- {p.display_name} (id={p.participant_id}, role={p.role}, audience_votes={p.vote_count})"
        for p in req.participants
    ) or "No participant roster recorded."

    transcripts_text = "\n".join(
        f"[{t.timestamp}] {t.speaker_name} ({t.role}): {t.text}"
        for t in req.transcripts[:150]
    ) or "No finalized utterances recorded."

    claims_text = "\n".join(
        f"- Speaker: {c.speaker_name} | Claim: {c.normalized_claim} | "
        f"Verdict: {c.verdict} | Explanation: {c.explanation} | "
        f"Sources: {', '.join(c.sources) if c.sources else 'None'}"
        for c in req.claims[:80]
    ) or "No factual claims were extracted during this session."

    prompt = f"""
    You are an impartial debate analyst preparing a structured Post-Debate Analytical Report
    for a human moderator and audience.

    STRICT ARCHITECTURAL RULES:
    1. Remain strictly neutral and analytical. Do NOT declare a simplistic "winner" or "loser".
    2. Base every factual assessment ONLY on the recorded transcripts and fact-check verdicts below.
    3. Clearly distinguish claims supported by curated evidence from claims with insufficient or contradicted evidence.
    4. If the transcript contains Malayalam or mixed Malayalam-English speech, synthesize the report cleanly in English while preserving the speaker's actual meaning.

    DEBATE METADATA:
    Title: "{req.title}"
    Topic: "{req.topic}"
    Category: "{req.category or 'General'}"
    Topic Brief Summary: "{req.core_summary or req.description or 'N/A'}"
    Total Audience Votes Cast: {req.total_votes}

    PARTICIPANTS & AUDIENCE VOTES:
    {participants_text}

    FINALIZED DEBATE TRANSCRIPT:
    {transcripts_text}

    FACT-CHECKED CLAIMS & VERDICTS:
    {claims_text}
    """

    parsed_report: GeneratedDebateReport | None = None
    used_model = EXTRACTION_MODELS[0]

    for model_name in EXTRACTION_MODELS:
        for attempt in range(max_retries):
            try:
                response = extraction_client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=GeneratedDebateReport,
                        temperature=0.2,
                    ),
                )
                if response.parsed:
                    parsed_report = response.parsed
                    used_model = model_name
                    break
            except errors.ServerError as exc:
                print(
                    f"[report_service] {model_name} busy ({exc.code}). "
                    f"Attempt {attempt + 1}/{max_retries}...",
                    flush=True,
                )
                time.sleep(2 * (attempt + 1))
            except Exception as exc:
                print(
                    f"[report_service] {model_name} failed ({exc}). Trying fallback...",
                    flush=True,
                )
                break
        if parsed_report is not None:
            break

    if parsed_report is None:
        raise RuntimeError(
            "Failed to generate post-debate report across all configured Gemini models."
        )

    report_payload = parsed_report.model_dump()
    report_payload["vote_summary"] = {
        "total_votes": req.total_votes,
        "breakdown": [
            {
                "participant_id": p.participant_id,
                "display_name": p.display_name,
                "role": p.role,
                "votes": p.vote_count,
            }
            for p in req.participants
            if p.role == "DEBATER"
        ],
    }
    report_payload["model_name"] = used_model

    return DebateReportResponse(
        debate_id=req.debate_id,
        summary=parsed_report.executive_summary,
        report_data=report_payload,
        model_name=used_model,
    )