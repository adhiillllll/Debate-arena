"""POST /ai/ingest – ingest evidence documents."""

from fastapi import APIRouter, Depends

from debate_ai.api.dependencies import verify_internal_secret
from debate_ai.schemas.ingest import IngestRequest, IngestResponse
from debate_ai.services.ingestion_service import ingest_document

ingest_router = APIRouter()


@ingest_router.post("/ingest", response_model=IngestResponse)
async def ingest_evidence(
    body: IngestRequest,
    _: None = Depends(verify_internal_secret),
):
    """Chunk, embed, and store a new evidence document."""
    source_id, chunks_inserted = ingest_document(
        title=body.title,
        url=body.url,
        content=body.content,
    )
    return IngestResponse(source_id=source_id, chunks_inserted=chunks_inserted)
