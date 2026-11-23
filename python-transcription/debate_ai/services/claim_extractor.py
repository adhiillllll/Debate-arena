"""
Claim extractor – identifies verifiable factual claims in debate transcripts.

Moved from the root ``extract_claims.py``.
"""

import time

from google.genai import errors, types

from debate_ai.config import DEV_MODE, EXTRACTION_MODELS, extraction_client
from debate_ai.schemas.fact_check import ClaimList, ExtractedClaim


def extract_factual_claims(
    transcript_segment: str,
    speaker_name: str,
    max_retries: int = 2,
) -> ClaimList | None:
    """Identify and extract verifiable factual claims from raw debate speech."""

    if DEV_MODE:
        print("\n[DEV MODE ACTIVE] Returning mock claims...")
        return ClaimList(
            claims=[
                ExtractedClaim(
                    original_text="The fact is, India's solar capacity grew by over 20 percent last year.",
                    normalized_claim="India's solar capacity grew by over 20 percent last year.",
                    is_verifiable=True,
                ),
                ExtractedClaim(
                    original_text="We are also seeing wind energy expanding in coastal states.",
                    normalized_claim="Wind energy is expanding in coastal states in India.",
                    is_verifiable=True,
                ),
            ]
        )

    prompt = f"""
    You are an AI claim extractor for a live debate (which may contain English, Malayalam, or mixed speech).
    Analyze the following transcript segment from a debater named {speaker_name}.
    Identify any factual propositions that can be verified against evidence.
    Ignore opinions, rhetorical questions, greetings, and conversational filler.
    Write each normalized_claim as a clear, self-contained factual sentence in English so it matches the evidence library.

    Transcript: "{transcript_segment}"
    """

    for model_name in EXTRACTION_MODELS:
        for attempt in range(max_retries):
            try:
                response = extraction_client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=ClaimList,
                        temperature=0.1,
                    ),
                )
                return response.parsed
            except errors.ServerError as exc:
                print(
                    f"[extract_claims] {model_name} busy ({exc.code}). "
                    f"Attempt {attempt + 1}/{max_retries}..."
                )
                time.sleep(1)
            except Exception as exc:
                print(
                    f"[extract_claims] {model_name} failed ({exc}). "
                    f"Trying next fallback model..."
                )
                break

    print("[extract_claims] All Gemini models failed or timed out.")
    return None
