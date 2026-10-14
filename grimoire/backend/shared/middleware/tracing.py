"""
Request Tracing Middleware - X-Request-ID support.
Generates and propagates request IDs for distributed tracing.
"""

import uuid
from contextvars import ContextVar
from typing import Optional
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

# Context variable for request ID - thread/async safe
request_id_context: ContextVar[Optional[str]] = ContextVar("request_id", default=None)

# Header names
REQUEST_ID_HEADER = "X-Request-ID"
CORRELATION_ID_HEADER = "X-Correlation-ID"


def get_request_id() -> Optional[str]:
    """Get the current request ID from context."""
    return request_id_context.get()


def generate_request_id() -> str:
    """Generate a new unique request ID."""
    return f"req_{uuid.uuid4().hex[:16]}"


class TracingMiddleware(BaseHTTPMiddleware):
    """
    Middleware that handles X-Request-ID for distributed tracing.
    
    - Accepts incoming X-Request-ID header or generates new one
    - Stores in context for logging and downstream propagation
    - Adds X-Request-ID to response headers
    """
    
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        # Get existing request ID from header or generate new one
        request_id = request.headers.get(REQUEST_ID_HEADER)
        correlation_id = request.headers.get(CORRELATION_ID_HEADER)
        
        if not request_id:
            request_id = generate_request_id()
        
        # Store in context for use elsewhere (logging, downstream calls)
        token = request_id_context.set(request_id)
        
        # Add to request state for easy access
        request.state.request_id = request_id
        request.state.correlation_id = correlation_id
        
        try:
            # Process request
            response = await call_next(request)
            
            # Add request ID to response headers
            response.headers[REQUEST_ID_HEADER] = request_id
            if correlation_id:
                response.headers[CORRELATION_ID_HEADER] = correlation_id
            
            return response
        finally:
            # Reset context
            request_id_context.reset(token)


class TracingLogFilter:
    """
    Log filter that adds request_id to log records.
    Use with structlog or standard logging.
    """
    
    def __call__(self, logger, method_name, event_dict):
        request_id = get_request_id()
        if request_id:
            event_dict["request_id"] = request_id
        return event_dict


def get_tracing_headers() -> dict[str, str]:
    """
    Get headers for propagating trace context to downstream services.
    Use when making HTTP calls to other microservices.
    """
    headers = {}
    request_id = get_request_id()
    if request_id:
        headers[REQUEST_ID_HEADER] = request_id
    return headers
