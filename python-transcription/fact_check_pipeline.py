import json
import os
from datetime import datetime
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

from embedding_service import generate_embedding
from extract_claims import extract_factual_claims
from verify_facts import Verdict, verify_claim

# Load both .env (DATABASE_URL) and .env.local (GEMINI_API_KEY)
WEB_DIR = Path(__file__).resolve().parent.parent / "web"
load_dotenv(WEB_DIR / ".env")
load_dotenv(WEB_DIR / ".env.local")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not found in web/.env")

SIMILARITY_THRESHOLD = 0.70
MATCH_COUNT = 3
MIN_TRANSCRIPT_CHARS = 20
MIN_TRANSCRIPT_WORDS = 4


def search_evidence(
    claim: str,
    match_count: int = MATCH_COUNT,
    similarity_threshold: float = SIMILARITY_THRESHOLD,
) -> list[dict]:
    """Embed a claim and retrieve matching evidence chunks with source metadata."""
    vector = generate_embedding(claim, "FACT_VERIFICATION")
    vector_str = f"[{','.join(map(str, vector))}]"

    conn = None
    cur = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        # Join with evidence_sources so source title and URL are always preserved
        query = """
            SELECT
                m.id,
                m."sourceId",
                m.content,
                m."chunkIndex",
                m.similarity,
                s.title,
                s.url
            FROM public.match_evidence_chunks(%s::vector(768), %s, %s) m
            JOIN public.evidence_sources s ON s.id = m."sourceId"
            ORDER BY m.similarity DESC;
        """
        cur.execute(query, (vector_str, match_count, similarity_threshold))
        rows = cur.fetchall()

        results = []
        for row in rows:
            chunk_id, source_id, content, chunk_index, similarity, title, url = row
            results.append(
                {
                    "chunkId": str(chunk_id),
                    "sourceId": str(source_id),
                    "chunkIndex": chunk_index,
                    "similarity": round(float(similarity), 4),
                    "title": title,
                    "url": url,
                    "content": content,
                }
            )
        return results
    finally:
        if cur is not None:
            cur.close()
        if conn is not None:
            conn.close()


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

    fact_check_payloads = []

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