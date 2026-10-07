"""
Authentication middleware for API key validation.
"""

from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader
from typing import Annotated
from pydantic import BaseModel

from shared.config import get_settings

api_key_header = APIKeyHeader(name="Authorization", auto_error=False)


class User(BaseModel):
    user_id: str


async def verify_api_key(
    api_key: Annotated[str | None, Security(api_key_header)]
) -> User:
    """
    Verify API key from Authorization header.
    Expects format: Bearer <api_key>
    
    Returns the validated API key wrapped in a User object.
    Raises HTTPException 401 if invalid.
    """
    settings = get_settings()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Extract token from "Bearer <token>"
    if api_key.startswith("Bearer "):
        token = api_key[7:]
    else:
        token = api_key
    
    # In production, validate against stored API keys
    # For now, accept any non-empty key in development
    if settings.is_production:
        # TODO: Validate against database of API keys
        # For now, check against secret
        if token != settings.api_key_secret:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key",
                headers={"WWW-Authenticate": "Bearer"},
            )
    elif not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empty API key",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return User(user_id=token)


# Dependency for protected routes
AuthenticatedUser = Annotated[User, Security(verify_api_key)]
