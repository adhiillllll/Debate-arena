"""End-to-end RAG fact-checking orchestrator for live debate transcripts."""

import json
from datetime import datetime

from debate_ai.config import (
    EXTRACTION_MODELS,
    MATCH_COUNT,
    MIN_TRANSCRIPT_CHARS,
    MIN_TRANSCRIPT_WORDS,
    SIMILARITY_THRESHOLD,
)
from debate_ai.db.connection import get_connection
from debate_ai.schemas.fact_check import Verdict
from debate_ai.services.claim_extractor import extract_factual_claims
from debate_ai.services.embedding_service import generate_embedding
from debate_ai.services.fact_verifier import verify_claim


def search_evidence(
    claim: str,
    match_count: int = MATCH_COUNT,
    similarity_threshold: float = SIMILARITY_THRESHOLD,
) -> list[dict]:
    """Embed a claim and retrieve matching evidence chunks with source metadata."""
    vector = generate_embedding(claim, "FACT_VERIFICATION")
    vector_str = f"[{','.join(map(str, vector))}]"

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    ec.id,
                    ec."sourceId",
                    ec.content,
                    ec."chunkIndex",
                    (1 - (ec.embedding <=> %s::vector(768)))::double precision AS similarity,
                    s.title,
                    s.url
                FROM public.evidence_chunks ec
                JOIN public.evidence_sources s ON s.id = ec."sourceId"
                WHERE ec.embedding IS NOT NULL
                  AND 1 - (ec.embedding <=> %s::vector(768)) >= %s
                ORDER BY ec.embedding <=> %s::vector(768)
                LIMIT %s;
                """,
                (
                    vector_str,
                    vector_str,
                    similarity_threshold,
                    vector_str,
                    match_count,
                ),
            )
            rows = cur.fetchall()

        return [
            {
                "chunkId": str(row[0]),
                "sourceId": str(row[1]),
                "content": row[2],
                "chunkIndex": row[3],
                "similarity": round(float(row[4]), 4),
                "title": row[5],
                "url": row[6],
            }
            for row in rows
        ]
    finally:
        conn.close()


def process_transcript(
    transcript_text: str,
    speaker_identity: str,
    timestamp: str | None = None,
    debate_context: str | None = None,
) -> list[dict]:
    """
    Run the full fact-checking pipeline on a finalized transcript segment.
    Returns a list of JSON-serializable fact-check payloads (one per verifiable claim).
    """
    cleaned_text = transcript_text.strip()
    if (
        len(cleaned_text) < MIN_TRANSCRIPT_CHARS
        or len(cleaned_text.split()) < MIN_TRANSCRIPT_WORDS
    ):
        return []

    event_timestamp = timestamp or datetime.now().isoformat(timespec="seconds")
    extracted = extract_factual_claims(
        cleaned_text,
        speaker_identity,
        debate_context=debate_context,
    )

    if not extracted or not extracted.claims:
        return []

    active_model = EXTRACTION_MODELS[0] if EXTRACTION_MODELS else "gemini-3.5-flash-lite"
    fact_check_payloads = []

    for claim in extracted.claims:
        if not claim.is_verifiable:
            continue

        evidence_matches = search_evidence(claim.normalized_claim)

        if not evidence_matches:
            fact_check_payloads.append(
                {
                    "type": "fact_check",
                    "participantIdentity": speaker_identity,
                    "timestamp": event_timestamp,
                    "originalText": claim.original_text,
                    "normalizedClaim": claim.normalized_claim,
                    "verdict": Verdict.INSUFFICIENT_EVIDENCE.value,
                    "confidence": 0.0,
                    "modelName": active_model,
                    "explanation": (
                        "No sufficiently relevant evidence was found in the curated "
                        "evidence library to verify this claim."
                    ),
                    "sources": [],
                }
            )
            continue

        chunk_texts = [match["content"] for match in evidence_matches]
        verification = verify_claim(claim.normalized_claim, chunk_texts)

        if not verification:
            continue

        fact_check_payloads.append(
            {
                "type": "fact_check",
                "participantIdentity": speaker_identity,
                "timestamp": event_timestamp,
                "originalText": claim.original_text,
                "normalizedClaim": claim.normalized_claim,
                "verdict": verification.verdict.value,
                "confidence": round(float(verification.confidence), 4),
                "modelName": active_model,
                "explanation": verification.explanation,
                "sources": evidence_matches,
            }
        )

    return fact_check_payloads


if __name__ == "__main__":
    sample_transcript = (
        "Look, my opponent is ignoring the facts. "
        "India's solar capacity grew by over 20 percent last year, "
        "and wind energy is expanding rapidly in coastal states."
    )

    print("Running end-to-end fact-checking pipeline test...\n")
    results = process_transcript(sample_transcript, speaker_identity="debater-a")
    print(f"Total verified claims returned: {len(results)}\n")
    print(json.dumps(results, indent=2))