import os
import time
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai import errors
from pydantic import BaseModel, Field

# Load environment variables
ENV_PATH = Path(__file__).resolve().parent.parent / "web" / ".env.local"
load_dotenv(ENV_PATH)

API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise RuntimeError("GEMINI_API_KEY not found in web/.env.local")

# Initialize the Gemini client
client = genai.Client(api_key=API_KEY)
MODEL = "gemini-3.8-flash"

# --- DEV MODE TOGGLE ---
# Set to False when Google's servers are stable again.
DEV_MODE = True 

# Define the exact output structure we want from the AI
class ExtractedClaim(BaseModel):
    original_text: str = Field(description="The exact quote from the transcript.")
    normalized_claim: str = Field(description="The self-contained, verifiable factual claim extracted.")
    is_verifiable: bool = Field(description="True if this is a factual claim that can be fact-checked. False for opinions, predictions, or questions.")

class ClaimList(BaseModel):
    claims: list[ExtractedClaim]

def extract_factual_claims(transcript_segment: str, speaker_name: str, max_retries: int = 2) -> ClaimList | None:
    """Uses AI to identify and extract factual claims from raw speech."""
    
    if DEV_MODE:
        print("\n[DEV MODE ACTIVE] Bypassing Gemini API. Returning mock claims instantly...")
        return ClaimList(
            claims=[
                ExtractedClaim(
                    original_text="The fact is, India's solar capacity grew by over 20 percent last year.",
                    normalized_claim="India's solar capacity grew by over 20 percent last year.",
                    is_verifiable=True
                ),
                ExtractedClaim(
                    original_text="We are also seeing wind energy expanding in coastal states.",
                    normalized_claim="Wind energy is expanding in coastal states in India.",
                    is_verifiable=True
                )
            ]
        )
    
    prompt = f"""
    You are an AI claim extractor for a live debate.
    Analyze the following transcript segment from a debater named {speaker_name}.
    Identify any factual propositions that can be verified against evidence.
    Ignore opinions, rhetorical questions, and conversational filler.
    Make the normalized_claim a complete, self-contained sentence.
    
    Transcript: "{transcript_segment}"
    """
    
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ClaimList,
                    temperature=0.1, 
                ),
            )
            return response.parsed
            
        except errors.ServerError:
            print(f"API busy (503). Retrying... (Attempt {attempt + 1}/{max_retries})")
            time.sleep(1)
            
    print("\n[DEV MODE] Gemini API is overloaded. Using a mock AI response to continue development...")
    return ClaimList(
        claims=[
            ExtractedClaim(
                original_text="The fact is, India's solar capacity grew by over 20 percent last year.",
                normalized_claim="India's solar capacity grew by over 20 percent last year.",
                is_verifiable=True
            )
        ]
    )

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
        print("No verifiable claims found in this segment.")