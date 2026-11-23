"""
Embedding service – wraps the Gemini embedding model with SSL client-reset retry logic.

Model  : gemini-embedding-2
Dims   : 768
"""

import time

from google import genai
from google.genai import types

from debate_ai.config import (
    EMBEDDING_DIMENSIONS,
    EMBEDDING_MODEL,
    GEMINI_API_KEY,
    embedding_client,
)

# Module-level mutable reference so the retry logic can reset the client.
_client: genai.Client = embedding_client


def generate_embedding(
    text: str,
    task_type: str,
    max_retries: int = 3,
) -> list[float]:
    """Generate a 768-dimensional embedding with retry on transient SSL/network errors."""
    global _client

    if not text or not text.strip():
        raise ValueError("Text cannot be empty")

    if task_type not in {"RETRIEVAL_DOCUMENT", "FACT_VERIFICATION"}:
        raise ValueError("Unsupported embedding task type")

    last_error: Exception | None = None
    for attempt in range(max_retries):
        try:
            response = _client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=text,
                config=types.EmbedContentConfig(
                    output_dimensionality=EMBEDDING_DIMENSIONS,
                    task_type=task_type,
                ),
            )

            embedding = response.embeddings[0].values

            if len(embedding) != EMBEDDING_DIMENSIONS:
                raise ValueError(
                    f"Expected {EMBEDDING_DIMENSIONS} dimensions, got {len(embedding)}"
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
                _client = genai.Client(api_key=GEMINI_API_KEY)
                time.sleep(1)

    raise last_error  # type: ignore[misc]
