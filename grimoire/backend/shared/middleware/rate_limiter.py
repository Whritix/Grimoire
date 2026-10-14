"""
Rate limiting middleware using SlowAPI.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from fastapi.responses import JSONResponse

from shared.config import get_settings

settings = get_settings()

# Create limiter instance
limiter = Limiter(key_func=get_remote_address)


def get_default_limit() -> str:
    """Get default rate limit string."""
    return f"{settings.rate_limit_default}/minute"


def get_heavy_limit() -> str:
    """Get heavy endpoint rate limit string."""
    return f"{settings.rate_limit_heavy}/minute"


async def rate_limit_exceeded_handler(
    request: Request, exc: RateLimitExceeded
) -> JSONResponse:
    """Custom handler for rate limit exceeded errors."""
    retry_after = exc.detail.split("per")[0].strip()
    
    return JSONResponse(
        status_code=429,
        content={
            "error": {
                "code": "rate_limit_exceeded",
                "message": f"Rate limit exceeded: {exc.detail}",
                "type": "rate_limit_error",
            }
        },
        headers={"Retry-After": retry_after},
    )


# Decorators for different rate limits
default_limit = limiter.limit(get_default_limit)
heavy_limit = limiter.limit(get_heavy_limit)
