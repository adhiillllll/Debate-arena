"""Topic understanding & Precheck Debater validation service."""

import time
from google.genai import errors, types

from debate_ai.config import (
    EXTRACTION_MODELS,
    MATCH_COUNT,
    SIMILARITY_THRESHOLD,
    extraction_client,
)
from debate_ai.db.connection import get_connection
from debate_ai.db.precheck_repo import (
    get_topic_brief_by_debate_id,
    list_precheck_submissions,
    upsert_precheck_submission,
    upsert_topic_brief,
)
from debate_ai.schemas.precheck import (
    GeneratedTopicBrief,
    PrecheckEvaluation,
    PrecheckQuestion,
    PrecheckValidationRequest,
    PrecheckValidationResponse,
    TopicBriefRequest,
    TopicBriefResponse,
)
from debate_ai.services.embedding_service import generate_embedding


def _retrieve_supporting_snippets(text: str) -> list[str]:
    """Optional pgvector lookup so precheck validation can reference stored evidence."""
    try:
        query_embedding = generate_embedding(text, "FACT_VERIFICATION")
        vector_literal = "[" + ",".join(str(x) for x in query_embedding) + "]"

        conn = get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT content
                    FROM evidence_chunks
                    WHERE embedding IS NOT NULL
                      AND 1 - (embedding <=> %s::vector) >= %s
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s;
                    """,
                    (vector_literal, SIMILARITY_THRESHOLD, vector_literal, MATCH_COUNT),
                )
                rows = cur.fetchall()
        finally:
            conn.close()

        return [r[0] for r in rows if r and r[0]]
    except Exception as exc:
        print(f"[topic_precheck] Optional evidence lookup skipped: {exc}", flush=True)
        return []


def generate_and_store_topic_brief(
    req: TopicBriefRequest,
    max_retries: int = 2,
) -> TopicBriefResponse:
    """Analyze a debate topic with Gemini, structure readiness questions, and store in Postgres."""
    prompt = f"""
    You are an expert debate architect preparing a structured Precheck Brief for debaters.
    Analyze the debate details below (which may involve English, Malayalam, or Indian/global policy contexts)
    and produce a clear, neutral topic decomposition.

    Debate Title: "{req.title}"
    Debate Topic / Motion: "{req.topic}"
    Category: "{req.category or 'General'}"
    Description / Context: "{req.description or 'No additional description provided.'}"

    REQUIREMENTS:
    1. Provide a neutral `core_summary` (2-3 sentences) framing the central conflict.
    2. Extract 3 to 5 `core_concepts` that a well-prepared debater must understand.
    3. List 3 to 5 `key_premises` (important factual, economic, ethical, or policy dimensions).
    4. Generate EXACTLY 3 precheck readiness questions with `question_id` values "q1", "q2", and "q3":
       - q1: Core definition & framing of the motion
       - q2: Evidence, data, or real-world mechanism supporting a position
       - q3: Anticipating counter-arguments or trade-offs
    5. For each question, specify concrete `expected_criteria` and `common_fallacies` so a validator
       can fairly evaluate a debater's precheck response and offer helpful suggestions.
    """

    parsed_brief: GeneratedTopicBrief | None = None
    used_model = EXTRACTION_MODELS[0]

    for model_name in EXTRACTION_MODELS:
        for attempt in range(max_retries):
            try:
                response = extraction_client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=GeneratedTopicBrief,
                        temperature=0.2,
                    ),
                )
                if response.parsed:
                    parsed_brief = response.parsed
                    used_model = model_name
                    break
            except errors.ServerError as exc:
                print(
                    f"[topic_precheck] {model_name} busy ({exc.code}). "
                    f"Attempt {attempt + 1}/{max_retries}...",
                    flush=True,
                )
                time.sleep(2 * (attempt + 1))
            except Exception as exc:
                print(
                    f"[topic_precheck] {model_name} failed ({exc}). Trying fallback...",
                    flush=True,
                )
                break
        if parsed_brief is not None:
            break

    if parsed_brief is None:
        raise RuntimeError("Failed to generate topic brief from all configured Gemini models.")

    # Normalize question IDs to q1..qN cleanly
    normalized_questions: list[PrecheckQuestion] = []
    for idx, q in enumerate(parsed_brief.questions, start=1):
        normalized_questions.append(
            PrecheckQuestion(
                question_id=f"q{idx}",
                question=q.question,
                core_concept=q.core_concept,
                expected_criteria=q.expected_criteria,
                common_fallacies=q.common_fallacies,
            )
        )

    brief_payload = {
        "core_concepts": parsed_brief.core_concepts,
        "key_premises": parsed_brief.key_premises,
        "questions": [q.model_dump() for q in normalized_questions],
    }

    stored = upsert_topic_brief(
        debate_id=req.debate_id,
        core_summary=parsed_brief.core_summary,
        brief_data=brief_payload,
        model_name=used_model,
    )

    return TopicBriefResponse(
        id=stored["id"],
        debate_id=stored["debate_id"],
        core_summary=stored["core_summary"],
        core_concepts=brief_payload["core_concepts"],
        key_premises=brief_payload["key_premises"],
        questions=normalized_questions,
        model_name=stored["model_name"],
    )


def fetch_topic_brief(debate_id: str) -> TopicBriefResponse | None:
    """Load an existing topic brief from PostgreSQL."""
    stored = get_topic_brief_by_debate_id(debate_id)
    if not stored:
        return None

    data = stored["brief_data"]
    questions = [PrecheckQuestion(**q) for q in data.get("questions", [])]

    return TopicBriefResponse(
        id=stored["id"],
        debate_id=stored["debate_id"],
        core_summary=stored["core_summary"],
        core_concepts=data.get("core_concepts", []),
        key_premises=data.get("key_premises", []),
        questions=questions,
        model_name=stored["model_name"],
    )


def validate_and_store_precheck(
    req: PrecheckValidationRequest,
    max_retries: int = 2,
) -> PrecheckValidationResponse:
    """Validate a debater's precheck response against the stored brief and evidence."""
    brief = fetch_topic_brief(req.debate_id)
    if brief is None:
        raise ValueError(f"No topic brief found for debate_id={req.debate_id}")

    target_question = next(
        (q for q in brief.questions if q.question_id == req.question_id),
        None,
    )
    if target_question is None:
        raise ValueError(
            f"Question '{req.question_id}' not found in brief for debate_id={req.debate_id}"
        )

    evidence_snippets = _retrieve_supporting_snippets(req.debater_response)
    evidence_block = (
        "\n\n".join(f"- {snippet}" for snippet in evidence_snippets)
        if evidence_snippets
        else "No external evidence chunks matched this specific response."
    )

    prompt = f"""
    You are an AI Precheck Coach preparing a debater before a live debate begins.
    Evaluate the debater's written/transcribed response against the stored Topic Brief rubric.
    Note: The debater may write in English, Malayalam, or mixed English-Malayalam.

    DEBATE SUMMARY: {brief.core_summary}
    CORE CONCEPTS: {", ".join(brief.core_concepts)}

    PRECHECK QUESTION ({target_question.question_id}): "{target_question.question}"
    EXPECTED CRITERIA: {target_question.expected_criteria}
    COMMON FALLACIES TO AVOID: {target_question.common_fallacies}

    RETRIEVED EVIDENCE SNIPPETS:
    {evidence_block}

    DEBATER RESPONSE:
    "{req.debater_response}"

    EVALUATION RULES:
    1. Set `is_valid = True` and `score >= 0.70` ONLY if the response directly answers the question,
       engages with the expected criteria, avoids logical fallacies, and does not contradict retrieved evidence.
    2. Set `is_valid = False` and `score < 0.70` if the response is vague, off-topic, purely emotional filler,
       relies on a listed fallacy, or contradicts retrieved evidence.
    3. Always provide clear `feedback`.
    4. Whenever `is_valid` is False (or `score < 0.85`), provide a concrete, constructive `suggestion`
       showing how the debater can strengthen their point before the live debate.
    """

    evaluation: PrecheckEvaluation | None = None

    for model_name in EXTRACTION_MODELS:
        for attempt in range(max_retries):
            try:
                response = extraction_client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=PrecheckEvaluation,
                        temperature=0.1,
                    ),
                )
                if response.parsed:
                    evaluation = response.parsed
                    break
            except errors.ServerError as exc:
                print(
                    f"[topic_precheck] Validation {model_name} busy ({exc.code}). "
                    f"Attempt {attempt + 1}/{max_retries}...",
                    flush=True,
                )
                time.sleep(2 * (attempt + 1))
            except Exception as exc:
                print(
                    f"[topic_precheck] Validation {model_name} failed ({exc}). Trying fallback...",
                    flush=True,
                )
                break
        if evaluation is not None:
            break

    if evaluation is None:
        raise RuntimeError("Failed to validate precheck response across all Gemini models.")

    stored = upsert_precheck_submission(
        debate_id=req.debate_id,
        participant_id=req.participant_id,
        question_id=target_question.question_id,
        question_text=target_question.question,
        debater_response=req.debater_response,
        is_valid=evaluation.is_valid,
        score=evaluation.score,
        feedback=evaluation.feedback,
        suggestion=evaluation.suggestion,
    )

    return PrecheckValidationResponse(**stored)


def fetch_participant_precheck_submissions(
    debate_id: str,
    participant_id: str,
) -> list[PrecheckValidationResponse]:
    """Return all precheck validation records for a participant in a debate."""
    rows = list_precheck_submissions(debate_id, participant_id)
    return [PrecheckValidationResponse(**r) for r in rows]