"""
Centralised configuration: environment loading, API keys, model constants, and thresholds.

Environment variables are loaded from the Next.js web directory:
  - web/.env        → DATABASE_URL
  - web/.env.local  → GEMINI_API_KEY, INTERNAL_API_SECRET (optional)
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
WEB_DIR = Path(__file__).resolve().parent.parent.parent / "web"

load_dotenv(WEB_DIR / ".env")          # DATABASE_URL
load_dotenv(WEB_DIR / ".env.local")    # GEMINI_API_KEY, INTERNAL_API_SECRET

GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
DATABASE_URL: str = os.getenv("DATABASE_URL", "")
INTERNAL_API_SECRET: str | None = os.getenv("INTERNAL_API_SECRET")

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY not found in web/.env.local")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not found in web/.env")

# ---------------------------------------------------------------------------
# Embedding model
# ---------------------------------------------------------------------------
EMBEDDING_MODEL = "gemini-embedding-2"
EMBEDDING_DIMENSIONS = 768

# ---------------------------------------------------------------------------
# Extraction & verification models  (primary → fallback chain)
# ---------------------------------------------------------------------------
EXTRACTION_MODELS: list[str] = [
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
    "gemini-3.8-flash",
]
EXTRACTION_TIMEOUT_MS = 20_000
DEV_MODE = False

# ---------------------------------------------------------------------------
# LiveKit transcription model
# ---------------------------------------------------------------------------
TRANSCRIPTION_MODEL = "gemini-3.5-transcribe-live"
TRANSCRIPTION_API_VERSION = "v1beta"
TRANSCRIPTION_LANGUAGE_CODES: list[str] = ["en-IN", "ml-IN"]
TRANSCRIPTION_FRAME_MS = 40
TRANSCRIPTION_SILENCE_MS = 1200

# ---------------------------------------------------------------------------
# Fact-check pipeline thresholds
# ---------------------------------------------------------------------------
SIMILARITY_THRESHOLD = 0.70
MATCH_COUNT = 3
MIN_TRANSCRIPT_CHARS = 20
MIN_TRANSCRIPT_WORDS = 4

# ---------------------------------------------------------------------------
# Pre-built Genai clients
# ---------------------------------------------------------------------------
embedding_client = genai.Client(api_key=GEMINI_API_KEY)

extraction_client = genai.Client(
    api_key=GEMINI_API_KEY,
    http_options=types.HttpOptions(timeout=EXTRACTION_TIMEOUT_MS),
)
