"""
Database operations for evidence_sources and evidence_chunks tables,
plus the match_evidence_chunks() JOIN query used for semantic retrieval.
"""

import uuid

from psycopg2.extras import execute_values

from debate_ai.config import MATCH_COUNT, SIMILARITY_THRESHOLD
from debate_ai.db.connection import get_connection


# ---------------------------------------------------------------------------
# Write helpers (ingestion)
# ---------------------------------------------------------------------------

def insert_evidence(
    title: str,
    url: str,
    chunks: list[tuple[str, int, str]],
) -> str:
    """
    Insert one evidence_source row and its evidence_chunks.

    Parameters
    ----------
    title : str
        Human-readable title of the source.
    url : str
        Origin URL.
    chunks : list[tuple[str, int, str]]
        Each tuple is (content, chunkIndex, vector_str).

    Returns
    -------
    str
        The UUID of the newly created evidence_source.
    """
    source_id = str(uuid.uuid4())
    conn = None
    cur = None
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            INSERT INTO public.evidence_sources (id, title, url, "sourceType", "retrievedAt")
            VALUES (%s, %s, %s, 'RESEARCH_PAPER', NOW())
            """,
            (source_id, title, url),
        )

        chunk_records = []
        for content, chunk_index, vector_str in chunks:
            chunk_id = str(uuid.uuid4())
            chunk_records.append((chunk_id, source_id, content, chunk_index, vector_str))

        insert_query = """
            INSERT INTO public.evidence_chunks (id, "sourceId", content, "chunkIndex", embedding)
            VALUES %s
        """
        execute_values(cur, insert_query, chunk_records)

        conn.commit()
        return source_id
    except Exception:
        if conn is not None:
            conn.rollback()
        raise
    finally:
        if cur is not None:
            cur.close()
        if conn is not None:
            conn.close()


# ---------------------------------------------------------------------------
# Read helpers (retrieval)
# ---------------------------------------------------------------------------

def match_evidence_chunks(
    vector_str: str,
    match_count: int = MATCH_COUNT,
    similarity_threshold: float = SIMILARITY_THRESHOLD,
) -> list[dict]:
    """
    Call the ``match_evidence_chunks`` Postgres function and JOIN with
    ``evidence_sources`` to include source title and URL in results.
    """
    conn = None
    cur = None
    try:
        conn = get_connection()
        cur = conn.cursor()

        query = """
            SELECT
                m.id,
                m."sourceId",
                m.content,
                m."chunkIndex",
                m.similarity,
                s.title,
                s.url
            FROM public.match_evidence_chunks(%s::vector(768), %s, %s) m
            JOIN public.evidence_sources s ON s.id = m."sourceId"
            ORDER BY m.similarity DESC;
        """
        cur.execute(query, (vector_str, match_count, similarity_threshold))
        rows = cur.fetchall()

        results = []
        for row in rows:
            chunk_id, source_id, content, chunk_index, similarity, title, url = row
            results.append(
                {
                    "chunkId": str(chunk_id),
                    "sourceId": str(source_id),
                    "chunkIndex": chunk_index,
                    "similarity": round(float(similarity), 4),
                    "title": title,
                    "url": url,
                    "content": content,
                }
            )
        return results
    finally:
        if cur is not None:
            cur.close()
        if conn is not None:
            conn.close()
