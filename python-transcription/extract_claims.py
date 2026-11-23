import os
import time
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import errors, types
from pydantic import BaseModel, Field

ENV_PATH = Path(__file__).resolve().parent.parent / "web" / ".env.local"
load_dotenv(ENV_PATH)

API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise RuntimeError("GEMINI_API_KEY not found in web/.env.local")

# 20-second timeout (in milliseconds) prevents indefinite hangs on congested endpoints
client = genai.Client(
    api_key=API_KEY,
    http_options=types.HttpOptions(timeout=20_000),
)

# Primary low-latency model first, with automatic fallbacks
MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
    "gemini-3.8-flash",
]

DEV_MODE = False


class ExtractedClaim(BaseModel):
    original_text: str = Field(
        description="The exact quote from the transcript."
    )
    normalized_claim: str = Field(
        description="The self-contained, verifiable factual claim extracted."
    )
    is_verifiable: bool = Field(
        description="True if this is a factual claim that can be fact-checked. False for opinions, predictions, or questions."
    )


class ClaimList(BaseModel):
    claims: list[ExtractedClaim]


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

    for model_name in MODELS:
        for attempt in range(max_retries):
            try:
                response = client.models.generate_content(
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


if __name__ == "__main__":
    sample_transcript = (
        "Look, my opponent is completely ignoring the reality of the situation. "
        "The fact is, India's solar capacity grew by over 20 percent last year. "
        "Can anyone seriously deny that? It's absurd. We are also seeing wind energy "
        "expanding in coastal states."
    )
    speaker = "debater-a"

    print(f"Analyzing transcript for {speaker}...")
    print(f"Raw Transcript: '{sample_transcript}'\n")

    result = extract_factual_claims(sample_transcript, speaker)

    if result and result.claims:
        for i, claim in enumerate(result.claims, 1):
            if claim.is_verifiable:
                print(f"--- Factual Claim {i} Detected ---")
                print(f"Original Text    : {claim.original_text}")
                print(f"Normalized Claim : {claim.normalized_claim}")
                print("-" * 40)
    else:
        print("No verifiable claims returned.")