"""Pydantic models for claim extraction and fact-check verification."""

from enum import Enum

from pydantic import BaseModel, Field


class ExtractedClaim(BaseModel):
    original_text: str = Field(
        description="The exact quote from the transcript."
    )
    normalized_claim: str = Field(
        description="The self-contained, verifiable factual claim extracted."
    )
    is_verifiable: bool = Field(
        description=(
            "True if this is a factual claim that can be fact-checked. "
            "False for opinions, predictions, or questions."
        )
    )


class ClaimList(BaseModel):
    claims: list[ExtractedClaim]


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
        description=(
            "A concise explanation for the human moderator detailing how the "
            "evidence supports, contradicts, or falls short of verifying the claim."
        )
    )
