import os
import time
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types

ENV_PATH = Path(__file__).resolve().parent.parent / "web" / ".env.local"
load_dotenv(ENV_PATH)

API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    raise RuntimeError("GEMINI_API_KEY not found in web/.env.local")

MODEL = "gemini-embedding-2"
DIMENSIONS = 768

client = genai.Client(api_key=API_KEY)


def generate_embedding(
    text: str,
    task_type: str,
    max_retries: int = 3,
) -> list[float]:
    """Generate a 768-dimensional embedding with retry on transient SSL/network errors."""
    global client

    if not text or not text.strip():
        raise ValueError("Text cannot be empty")

    if task_type not in {"RETRIEVAL_DOCUMENT", "FACT_VERIFICATION"}:
        raise ValueError("Unsupported embedding task type")

    last_error = None
    for attempt in range(max_retries):
        try:
            response = client.models.embed_content(
                model=MODEL,
                contents=text,
                config=types.EmbedContentConfig(
                    output_dimensionality=DIMENSIONS,
                    task_type=task_type,
                ),
            )

            embedding = response.embeddings[0].values

            if len(embedding) != DIMENSIONS:
                raise ValueError(
                    f"Expected {DIMENSIONS} dimensions, got {len(embedding)}"
                )

            return embedding
        except Exception as exc:
            last_error = exc
            if attempt < max_retries - 1:
                print(
                    f"[embedding_service] Transient error ({exc}). "
                    f"Resetting client and retrying ({attempt + 1}/{max_retries})...",
                    flush=True,
                )
                client = genai.Client(api_key=API_KEY)
                time.sleep(1)

    raise last_error


if __name__ == "__main__":
    evidence = (
        "According to scientific research, greenhouse gases "
        "contribute to global warming."
    )

    claim = "Greenhouse gases contribute to rising global temperatures."

    evidence_vector = generate_embedding(evidence, "RETRIEVAL_DOCUMENT")
    claim_vector = generate_embedding(claim, "FACT_VERIFICATION")

    print("Evidence embedding dimensions:", len(evidence_vector))
    print("Claim embedding dimensions:", len(claim_vector))
    print("Embedding service working successfully!")