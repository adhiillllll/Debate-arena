"""
Ingestion service – chunk a document, generate embeddings, and store in Postgres.

Moved from the root ``ingest_evidence.py``.
"""

from debate_ai.db.evidence_repo import insert_evidence
from debate_ai.services.embedding_service import generate_embedding


def chunk_text(text: str, chunk_size: int = 400) -> list[str]:
    """
    Simple MVP chunking: split text into roughly equal parts without
    breaking in the middle of a sentence when possible.
    """
    sentences = text.replace("\n", " ").split(". ")
    chunks: list[str] = []
    current_chunk = ""

    for sentence in sentences:
        if len(current_chunk) + len(sentence) <= chunk_size:
            current_chunk += sentence + ". "
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = sentence + ". "

    if current_chunk:
        chunks.append(current_chunk.strip())

    return chunks


def ingest_document(title: str, url: str, content: str) -> tuple[str, int]:
    """
    Process a document end-to-end: chunk → embed → store.

    Returns
    -------
    tuple[str, int]
        (source_id, number_of_chunks_inserted)
    """
    chunks = chunk_text(content)
    print(f"Extracted {len(chunks)} chunks from the document.")

    prepared: list[tuple[str, int, str]] = []
    for index, chunk_content in enumerate(chunks):
        print(f"Generating embedding for chunk {index}...")
        vector = generate_embedding(chunk_content, "RETRIEVAL_DOCUMENT")
        vector_str = f"[{','.join(map(str, vector))}]"
        prepared.append((chunk_content, index, vector_str))

    source_id = insert_evidence(title, url, prepared)
    print(f"Inserted EvidenceSource {source_id} with {len(prepared)} chunks.")
    return source_id, len(prepared)
