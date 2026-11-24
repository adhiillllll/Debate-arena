"""Combine all sub-routers under the /ai prefix."""

from fastapi import APIRouter

from debate_ai.api.routes_health import health_router
from debate_ai.api.routes_ingest import ingest_router
from debate_ai.api.routes_precheck import precheck_router

api_router = APIRouter(prefix="/ai")
api_router.include_router(health_router)
api_router.include_router(ingest_router)
api_router.include_router(precheck_router)