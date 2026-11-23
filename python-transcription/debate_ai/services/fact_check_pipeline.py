"""
End-to-end fact-checking pipeline.

Moved from the root ``fact_check_pipeline.py``.
Orchestrates: claim extraction → evidence retrieval → fact verification.
"""

import json
from datetime import datetime

from debate_ai.config import MIN_TRANSCRIPT_CHARS, MIN_TRANSCRIPT_WORDS
from debate_ai.db.evidence_repo import match_evidence_chunks
from debate_ai.schemas.fact_check import Verdict
from debate_ai.services.claim_extractor import extract_factual_claims
from debate_ai.services.embedding_service import generate_embedding
from debate_ai.services.fact_verifier import verify_claim


def search_evidence(
    claim: str,
) -> list[dict]:
    """Embed a claim and retrieve matching evidence chunks with source metadata."""
    vector = generate_embedding(claim, "FACT_VERIFICATION")
    vector_str = f"[{','.join(map(str, vector))}]"
    return match_evidence_chunks(vector_str)


def process_transcript(
    transcript_text: str,
    speaker_identity: str,
    timestamp: str | None = None,
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
    extracted = extract_factual_claims(cleaned_text, speaker_identity)

    if not extracted or not extracted.claims:
        return []

    fact_check_payloads: list[dict] = []

    for claim in extracted.claims:
        if not claim.is_verifiable:
            continue

        evidence_matches = search_evidence(claim.normalized_claim)

        # Gate: If no database evidence meets our similarity threshold, skip LLM verification
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
