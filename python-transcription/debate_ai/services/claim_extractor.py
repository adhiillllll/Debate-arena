"""Extract verifiable factual claims from raw live debate speech."""

import time
from google.genai import errors, types

from debate_ai.config import (
    DEV_MODE,
    EXTRACTION_MODELS,
    extraction_client,
)
from debate_ai.schemas.fact_check import ClaimList, ExtractedClaim


def extract_factual_claims(
    transcript_segment: str,
    speaker_name: str,
    max_retries: int = 2,
    debate_context: str | None = None,
) -> ClaimList | None:
    """Identify and extract verifiable factual claims from raw debate speech."""

    if DEV_MODE:
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

    context_block = (
        f"\nDebate Topic Context:\n{debate_context.strip()}\n"
        if debate_context and debate_context.strip()
        else ""
    )

    prompt = f"""
    You are an AI claim extractor for a live Indian debate (which may contain Indian English, Malayalam, or Malayalam-English code-switched speech).
    {context_block}
    Analyze the following raw speech-to-text transcript segment from a debater named {speaker_name}.

    Rules:
    1. Identify only clear, verifiable factual propositions that can be checked against evidence.
    2. Ignore opinions, rhetorical questions, greetings, and conversational filler.
    3. Because live speech-to-text can introduce minor phonetic homophone errors in Indian English or Malayalam (for example, "strict bands" instead of "strict bans", or "his said" instead of "essays"), use the Debate Topic Context to normalize obvious phonetic slips ONLY when the intended meaning is clear.
    4. If a segment is heavily corrupted by speech-to-text errors and its factual meaning cannot be reliably understood, return an empty claims list (or set is_verifiable=false). Do NOT invent claims from garbled words.
    5. Write each normalized_claim as a clean, self-contained factual sentence in English so it matches the evidence library.

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
                    f"[claim_extractor] {model_name} busy ({exc.code}). "
                    f"Attempt {attempt + 1}/{max_retries}..."
                )
                time.sleep(1)
            except Exception as exc:
                print(
                    f"[claim_extractor] {model_name} failed ({exc}). "
                    f"Trying next fallback model..."
                )
                break

    print("[claim_extractor] All Gemini models failed or timed out.")
    return None