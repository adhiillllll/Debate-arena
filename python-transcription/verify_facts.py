import os
import time
from enum import Enum
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

client = genai.Client(
    api_key=API_KEY,
    http_options=types.HttpOptions(timeout=20_000),
)

MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
    "gemini-3.8-flash",
]

DEV_MODE = False


class Verdict(str, Enum):
    SUPPORTED = "SUPPORTED"
    REFUTED = "REFUTED"
    PARTIALLY_SUPPORTED = "PARTIALLY_SUPPORTED"
    CONTRADICTORY_EVIDENCE = "CONTRADICTORY_EVIDENCE"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"


class FactCheckResult(BaseModel):
    verdict: Verdict = Field(
        description="The final verdict based ONLY on the provided evidence."
    )
    confidence: float = Field(
        description="Confidence score between 0.0 and 1.0."
    )
    explanation: str = Field(
        description="A concise explanation for the human moderator detailing how the evidence supports, contradicts, or falls short of verifying the claim."
    )


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
            explanation="The retrieved evidence explicitly confirms that wind energy capacity is expanding in coastal states like Tamil Nadu and Gujarat.",
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

    for model_name in MODELS:
        for attempt in range(max_retries):
            try:
                response = client.models.generate_content(
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


if __name__ == "__main__":
    test_evidence = [
        "India's renewable energy production has increased significantly over the last decade. "
        "The country has set an ambitious target of achieving 500 GW of non-fossil fuel-based "
        "energy capacity by 2030. Furthermore, wind energy capacity is expanding rapidly in "
        "coastal states like Tamil Nadu and Gujarat."
    ]

    test_cases = [
        ("Supported test", "Wind energy is expanding in coastal states in India."),
        ("Refuted test", "India's target for non-fossil fuel energy by 2030 is only 50 GW."),
        ("Insufficient test", "India's solar capacity grew by exactly 20 percent last year."),
    ]

    for label, claim in test_cases:
        print(f"\n=== {label} ===")
        print(f"Claim: '{claim}'")
        result = verify_claim(claim, test_evidence)
        if result:
            print(f"Verdict     : {result.verdict.value}")
            print(f"Confidence  : {result.confidence * 100:.1f}%")
            print(f"Explanation : {result.explanation}")
        else:
            print("Verification failed.")