"""FastAPI route for post-debate analytical report generation."""

from fastapi import APIRouter, Depends, HTTPException

from debate_ai.api.dependencies import verify_internal_secret
from debate_ai.schemas.report import DebateReportRequest, DebateReportResponse
from debate_ai.services.report_service import generate_debate_report

report_router = APIRouter(
    tags=["report"],
    dependencies=[Depends(verify_internal_secret)],
)


@report_router.post("/generate-report", response_model=DebateReportResponse)
def create_debate_report(payload: DebateReportRequest) -> DebateReportResponse:
    """Generate a structured analytical report from persisted debate transcripts and verdicts."""
    try:
        return generate_debate_report(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc