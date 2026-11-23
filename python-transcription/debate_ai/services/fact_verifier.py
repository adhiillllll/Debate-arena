"""
Fact verifier – compares a claim against retrieved evidence chunks.

Moved from the root ``verify_facts.py``.
"""

import time

from google.genai import errors, types

from debate_ai.config import DEV_MODE, EXTRACTION_MODELS, extraction_client
from debate_ai.schemas.fact_check import FactCheckResult, Verdict


def verify_claim(
    claim: str,
    evidence_chunks: list[str],
    max_retries: int = 2,
) -> FactCheckResult | None:
    """Compare a claim against retrieved evidence to generate a fact-check report."""

    if DEV_MODE:
        print("\n[DEV MODE ACTIVE] Returning mock verification...")
        return FactCheckResult(
            verdict=Verdict.SUPPORTED,
            confidence=0.95,
            explanation=(
                "The retrieved evidence explicitly confirms that wind energy "
                "capacity is expanding in coastal states like Tamil Nadu and Gujarat."
            ),
        )

    formatted_evidence = "\n\n".join(
        [
            f"Evidence Chunk {i + 1}:\n{chunk}"
            for i, chunk in enumerate(evidence_chunks)
        ]
    )

    prompt = f"""
    You are an AI fact-checking assistant for a human debate moderator.
    Analyze the following CLAIM against the provided EVIDENCE.

    CRITICAL RULES:
    1. Base your verdict STRICTLY AND ONLY on the provided EVIDENCE. Do NOT use outside knowledge.
    2. If the EVIDENCE does not contain enough information to prove or disprove the claim, you MUST return INSUFFICIENT_EVIDENCE.
    3. If the EVIDENCE directly contradicts the claim, return REFUTED.
    4. Clearly explain any uncertainty, missing context, or partial match for the human moderator.

    CLAIM: "{claim}"

    EVIDENCE:
    {formatted_evidence}
    """

    for model_name in EXTRACTION_MODELS:
        for attempt in range(max_retries):
            try:
                response = extraction_client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=FactCheckResult,
                        temperature=0.0,
                    ),
                )
                return response.parsed
            except errors.ServerError as exc:
                print(
                    f"[verify_facts] {model_name} busy ({exc.code}). "
                    f"Attempt {attempt + 1}/{max_retries}..."
                )
                time.sleep(1)
            except Exception as exc:
                print(
                    f"[verify_facts] {model_name} failed ({exc}). "
                    f"Trying next fallback model..."
                )
                break

    print("[verify_facts] All Gemini models failed or timed out.")
    return None
