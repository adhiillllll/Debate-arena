"""Optional X-Internal-Secret header verification for internal API calls."""

from fastapi import Header, HTTPException

from debate_ai.config import INTERNAL_API_SECRET


async def verify_internal_secret(
    x_internal_secret: str | None = Header(default=None),
) -> None:
    """
    If INTERNAL_API_SECRET is set in the environment, require a matching
    ``X-Internal-Secret`` header on every request.  When the env var is
    unset the check is a no-op (open access).
    """
    if INTERNAL_API_SECRET is None:
        return  # No secret configured → allow all requests

    if x_internal_secret != INTERNAL_API_SECRET:
        raise HTTPException(status_code=403, detail="Invalid or missing internal secret")
