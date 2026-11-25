"""PostgreSQL repository for persisting live debate transcripts and fact-check results."""

import uuid
from datetime import datetime, timezone
from typing import Any

from debate_ai.config import EXTRACTION_MODELS
from debate_ai.db.connection import get_connection


def is_valid_uuid(value: str | None) -> bool:
    """Return True when value is a syntactically valid UUID string."""
    if not value or not isinstance(value, str):
        return False
    try:
        uuid.UUID(value.strip())
        return True
    except (ValueError, AttributeError):
        return False


def _parse_timestamp(value: str | None) -> datetime:
    """Parse an ISO timestamp string or fall back to current UTC time."""
    if not value:
        return datetime.now(timezone.utc)
    try:
        dt = datetime.fromisoformat(value)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return datetime.now(timezone.utc)


def save_final_transcript(
    debate_id: str,
    participant_id: str | None,
    text: str,
    language: str | None = "ml-IN,en-US",
    started_at: str | None = None,
) -> str | None:
    """
    Insert a finalized utterance into `transcripts` and return its UUID.
    Returns None if debate_id is not a valid UUID (e.g. legacy sandbox rooms).
    """
    if not is_valid_uuid(debate_id):
        return None

    clean_text = text.strip()
    if not clean_text:
        return None

    transcript_id = str(uuid.uuid4())
    valid_participant_id = (
        participant_id.strip() if is_valid_uuid(participant_id) else None
    )
    spoken_at = _parse_timestamp(started_at)

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO transcripts (
                    id,
                    "debateId",
                    "participantId",
                    text,
                    language,
                    "isFinal",
                    "startedAt",
                    "createdAt"
                )
                VALUES (%s, %s, %s, %s, %s, TRUE, %s, NOW())
                RETURNING id;
                """,
                (
                    transcript_id,
                    debate_id.strip(),
                    valid_participant_id,
                    clean_text,
                    language,
                    spoken_at,
                ),
            )
            row = cur.fetchone()
        conn.commit()
        return str(row[0]) if row else transcript_id
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def save_fact_check_results(
    debate_id: str,
    transcript_id: str | None,
    participant_id: str | None,
    results: list[dict[str, Any]],
    language: str | None = "ml-IN,en-US",
) -> list[dict[str, str]]:
    """
    Persist extracted claims, verification verdicts, and retrieved evidence chunk links
    into `factual_claims`, `fact_check_results`, and `fact_check_evidence`.
    """
    if not results or not is_valid_uuid(debate_id) or not is_valid_uuid(transcript_id):
        return []

    valid_debate_id = debate_id.strip()
    valid_transcript_id = transcript_id.strip()
    valid_participant_id = (
        participant_id.strip() if is_valid_uuid(participant_id) else None
    )
    default_model = EXTRACTION_MODELS[0] if EXTRACTION_MODELS else "gemini-3.5-flash-lite"

    persisted: list[dict[str, str]] = []
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            for item in results:
                claim_id = str(uuid.uuid4())
                result_id = str(uuid.uuid4())
                detected_at = _parse_timestamp(item.get("timestamp"))
                verdict = item.get("verdict") or "INSUFFICIENT_EVIDENCE"
                confidence = (
                    float(item["confidence"])
                    if item.get("confidence") is not None
                    else None
                )
                explanation = item.get("explanation") or ""
                model_name = item.get("modelName") or default_model

                cur.execute(
                    """
                    INSERT INTO factual_claims (
                        id,
                        "debateId",
                        "transcriptId",
                        "participantId",
                        "originalText",
                        "normalizedClaim",
                        language,
                        status,
                        "detectedAt"
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, 'COMPLETED', %s);
                    """,
                    (
                        claim_id,
                        valid_debate_id,
                        valid_transcript_id,
                        valid_participant_id,
                        item.get("originalText") or item.get("normalizedClaim") or "",
                        item.get("normalizedClaim") or "",
                        language,
                        detected_at,
                    ),
                )

                cur.execute(
                    """
                    INSERT INTO fact_check_results (
                        id,
                        "claimId",
                        "modelName",
                        verdict,
                        confidence,
                        explanation,
                        "checkedAt"
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, NOW());
                    """,
                    (
                        result_id,
                        claim_id,
                        model_name,
                        verdict,
                        confidence,
                        explanation,
                    ),
                )

                supports_claim: bool | None = None
                if verdict == "SUPPORTED":
                    supports_claim = True
                elif verdict == "REFUTED":
                    supports_claim = False

                for src in item.get("sources") or []:
                    chunk_id = src.get("chunkId")
                    if not is_valid_uuid(chunk_id):
                        continue

                    relevance = (
                        float(src["similarity"])
                        if src.get("similarity") is not None
                        else None
                    )
                    cur.execute(
                        """
                        INSERT INTO fact_check_evidence (
                            id,
                            "factCheckResultId",
                            "evidenceChunkId",
                            "relevanceScore",
                            "supportsClaim"
                        )
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT ("factCheckResultId", "evidenceChunkId")
                        DO NOTHING;
                        """,
                        (
                            str(uuid.uuid4()),
                            result_id,
                            chunk_id.strip(),
                            relevance,
                            supports_claim,
                        ),
                    )

                persisted.append(
                    {
                        "claimId": claim_id,
                        "factCheckResultId": result_id,
                    }
                )

        conn.commit()
        return persisted
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_debate_transcription_context(debate_id: str | None) -> dict[str, Any] | None:
    """
    Fetch debate title, topic, description, and stored TopicBrief summary/concepts
    to anchor live speech transcription and ASR-aware claim extraction.
    """
    if not is_valid_uuid(debate_id):
        return None

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    d.title,
                    d.topic,
                    d.description,
                    d.category,
                    b."coreSummary",
                    b."briefData"
                FROM debates d
                LEFT JOIN debate_topic_briefs b ON b."debateId" = d.id
                WHERE d.id = %s
                LIMIT 1;
                """,
                (debate_id.strip(),),
            )
            row = cur.fetchone()

        if not row:
            return None

        title, topic, description, category, core_summary, brief_data = row
        core_concepts: list[str] = []
        if isinstance(brief_data, dict):
            raw_concepts = brief_data.get("core_concepts")
            if isinstance(raw_concepts, list):
                core_concepts = [str(c) for c in raw_concepts if c]

        return {
            "title": title or "",
            "topic": topic or "",
            "description": description or "",
            "category": category or "",
            "core_summary": core_summary or "",
            "core_concepts": core_concepts,
        }
    finally:
        conn.close()