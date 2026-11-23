"""Request / response models for the /ai/ingest endpoint."""

from pydantic import BaseModel, Field


class IngestRequest(BaseModel):
    title: str = Field(description="Title of the evidence source document.")
    url: str = Field(description="URL of the evidence source document.")
    content: str = Field(description="Full text content to ingest.")


class IngestResponse(BaseModel):
    source_id: str = Field(description="UUID of the created evidence source.")
    chunks_inserted: int = Field(description="Number of evidence chunks stored.")
