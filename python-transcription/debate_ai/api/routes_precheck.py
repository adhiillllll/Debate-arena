"""FastAPI routes for Topic Brief generation and Precheck Debater validation."""

import psycopg2
from fastapi import APIRouter, Depends, HTTPException

from debate_ai.api.dependencies import verify_internal_secret
from debate_ai.schemas.precheck import (
    PrecheckValidationRequest,
    PrecheckValidationResponse,
    TopicBriefRequest,
    TopicBriefResponse,
)
from debate_ai.services.topic_precheck_service import (
    fetch_participant_precheck_submissions,
    fetch_topic_brief,
    generate_and_store_topic_brief,
    validate_and_store_precheck,
)

precheck_router = APIRouter(
    tags=["precheck"],
    dependencies=[Depends(verify_internal_secret)],
)


@precheck_router.post("/topic-brief", response_model=TopicBriefResponse)
def create_or_update_topic_brief(payload: TopicBriefRequest) -> TopicBriefResponse:
    """Generate a structured topic brief via Gemini and store it in PostgreSQL."""
    try:
        return generate_and_store_topic_brief(payload)
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Database error storing topic brief (check debate_id exists): {exc.pgerror or str(exc)}",
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@precheck_router.get("/topic-brief/{debate_id}", response_model=TopicBriefResponse)
def get_topic_brief(debate_id: str) -> TopicBriefResponse:
    """Retrieve the stored topic brief for a debate."""
    brief = fetch_topic_brief(debate_id)
    if brief is None:
        raise HTTPException(status_code=404, detail="Topic brief not found for this debate.")
    return brief


@precheck_router.post("/validate-precheck", response_model=PrecheckValidationResponse)
def validate_precheck_answer(
    payload: PrecheckValidationRequest,
) -> PrecheckValidationResponse:
    """Validate a debater's precheck response against the stored topic brief and evidence."""
    try:
        return validate_and_store_precheck(payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Database error saving precheck submission: {exc.pgerror or str(exc)}",
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@precheck_router.get(
    "/precheck-submissions/{debate_id}/{participant_id}",
    response_model=list[PrecheckValidationResponse],
)
def get_participant_submissions(
    debate_id: str,
    participant_id: str,
) -> list[PrecheckValidationResponse]:
    """List all precheck question evaluations for a debater in a debate."""
    return fetch_participant_precheck_submissions(debate_id, participant_id)