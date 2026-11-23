"""
Entrypoint 1: FastAPI application served by Uvicorn.

Usage:
    uvicorn api_server:app --host 0.0.0.0 --port 8000 --reload
"""

from fastapi import FastAPI

from debate_ai.api.router import api_router

app = FastAPI(title="Debate Arena AI API")
app.include_router(api_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api_server:app", host="0.0.0.0", port=8000, reload=True)
