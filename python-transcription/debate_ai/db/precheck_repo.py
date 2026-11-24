"""PostgreSQL repository for debate_topic_briefs and debate_precheck_submissions."""

import json
import uuid
from typing import Any

from debate_ai.db.connection import get_connection


def upsert_topic_brief(
    debate_id: str,
    core_summary: str,
    brief_data: dict[str, Any],
    model_name: str,
) -> dict[str, Any]:
    """Insert or update the structured topic brief for a debate."""
    brief_id = str(uuid.uuid4())
    brief_json = json.dumps(brief_data)

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO debate_topic_briefs (
                    id,
                    "debateId",
                    "coreSummary",
                    "briefData",
                    "modelName",
                    "createdAt",
                    "updatedAt"
                )
                VALUES (%s, %s, %s, %s::jsonb, %s, NOW(), NOW())
                ON CONFLICT ("debateId")
                DO UPDATE SET
                    "coreSummary" = EXCLUDED."coreSummary",
                    "briefData"   = EXCLUDED."briefData",
                    "modelName"   = EXCLUDED."modelName",
                    "updatedAt"   = NOW()
                RETURNING id, "debateId", "coreSummary", "briefData", "modelName";
                """,
                (brief_id, debate_id, core_summary, brief_json, model_name),
            )
            row = cur.fetchone()
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return {
        "id": str(row[0]),
        "debate_id": str(row[1]),
        "core_summary": row[2],
        "brief_data": row[3] if isinstance(row[3], dict) else json.loads(row[3]),
        "model_name": row[4],
    }


def get_topic_brief_by_debate_id(debate_id: str) -> dict[str, Any] | None:
    """Fetch the stored topic brief for a debate, or None if not generated yet."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, "debateId", "coreSummary", "briefData", "modelName"
                FROM debate_topic_briefs
                WHERE "debateId" = %s;
                """,
                (debate_id,),
            )
            row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        return None

    return {
        "id": str(row[0]),
        "debate_id": str(row[1]),
        "core_summary": row[2],
        "brief_data": row[3] if isinstance(row[3], dict) else json.loads(row[3]),
        "model_name": row[4],
    }


def upsert_precheck_submission(
    debate_id: str,
    participant_id: str,
    question_id: str,
    question_text: str,
    debater_response: str,
    is_valid: bool,
    score: float,
    feedback: str,
    suggestion: str | None,
) -> dict[str, Any]:
    """Insert or update a debater's precheck response and AI validation result."""
    submission_id = str(uuid.uuid4())

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO debate_precheck_submissions (
                    id,
                    "debateId",
                    "participantId",
                    "questionId",
                    "questionText",
                    "debaterResponse",
                    "isValid",
                    score,
                    feedback,
                    suggestion,
                    "createdAt",
                    "updatedAt"
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                ON CONFLICT ("debateId", "participantId", "questionId")
                DO UPDATE SET
                    "questionText"    = EXCLUDED."questionText",
                    "debaterResponse" = EXCLUDED."debaterResponse",
                    "isValid"         = EXCLUDED."isValid",
                    score             = EXCLUDED.score,
                    feedback          = EXCLUDED.feedback,
                    suggestion        = EXCLUDED.suggestion,
                    "updatedAt"       = NOW()
                RETURNING
                    id,
                    "debateId",
                    "participantId",
                    "questionId",
                    "questionText",
                    "debaterResponse",
                    "isValid",
                    score,
                    feedback,
                    suggestion;
                """,
                (
                    submission_id,
                    debate_id,
                    participant_id,
                    question_id,
                    question_text,
                    debater_response,
                    is_valid,
                    score,
                    feedback,
                    suggestion,
                ),
            )
            row = cur.fetchone()
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return {
        "id": str(row[0]),
        "debate_id": str(row[1]),
        "participant_id": str(row[2]),
        "question_id": row[3],
        "question_text": row[4],
        "debater_response": row[5],
        "is_valid": bool(row[6]),
        "score": float(row[7]) if row[7] is not None else 0.0,
        "feedback": row[8],
        "suggestion": row[9],
    }


def list_precheck_submissions(
    debate_id: str,
    participant_id: str,
) -> list[dict[str, Any]]:
    """Return all stored precheck submissions for a participant in a debate."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    "debateId",
                    "participantId",
                    "questionId",
                    "questionText",
                    "debaterResponse",
                    "isValid",
                    score,
                    feedback,
                    suggestion
                FROM debate_precheck_submissions
                WHERE "debateId" = %s
                  AND "participantId" = %s
                ORDER BY "questionId" ASC;
                """,
                (debate_id, participant_id),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    return [
        {
            "id": str(r[0]),
            "debate_id": str(r[1]),
            "participant_id": str(r[2]),
            "question_id": r[3],
            "question_text": r[4],
            "debater_response": r[5],
            "is_valid": bool(r[6]),
            "score": float(r[7]) if r[7] is not None else 0.0,
            "feedback": r[8],
            "suggestion": r[9],
        }
        for r in rows
    ]