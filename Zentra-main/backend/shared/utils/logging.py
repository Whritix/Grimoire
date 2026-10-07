"""
Structured logging using structlog.
"""

import logging
import structlog
from shared.config import get_settings


def configure_logging() -> None:
    """Configure structured logging based on settings."""
    settings = get_settings()
    
    # Map string log level to numeric value
    log_level = getattr(logging, settings.log_level.upper(), logging.INFO)
    
    processors = [
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]
    
    if settings.log_format == "json":
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.append(structlog.dev.ConsoleRenderer(colors=True))
    
    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str = __name__) -> structlog.BoundLogger:
    """Get a configured logger."""
    return structlog.get_logger(name)

