"""
Input Sanitization Middleware
Prevents prompt injection and XSS attacks by sanitizing all user inputs.
"""

import re
import html
from typing import Any, Optional
from functools import wraps

# Maximum allowed input length
MAX_INPUT_LENGTH = 4000

# Patterns that suggest prompt injection attempts
INJECTION_PATTERNS = [
    r"ignore\s+(previous|above|all)\s+(instructions|prompts)",
    r"disregard\s+(previous|above|all)",
    r"forget\s+(everything|all|previous)",
    r"you\s+are\s+now\s+a",
    r"act\s+as\s+(if\s+you\s+are|a)",
    r"pretend\s+(to\s+be|you\s+are)",
    r"new\s+instructions:",
    r"system\s+prompt:",
    r"\[INST\]",
    r"\[/INST\]",
    r"<\|im_start\|>",
    r"<\|im_end\|>",
]

# Compile patterns for efficiency
COMPILED_PATTERNS = [re.compile(p, re.IGNORECASE) for p in INJECTION_PATTERNS]


def strip_html_tags(text: str) -> str:
    """Remove HTML tags from text."""
    # First, escape HTML entities
    text = html.escape(text)
    # Then remove any remaining tag-like patterns
    clean = re.sub(r'<[^>]+>', '', text)
    return clean


def remove_dangerous_characters(text: str) -> str:
    """Remove or escape potentially dangerous characters."""
    # Remove null bytes
    text = text.replace('\x00', '')
    # Remove other control characters except newlines and tabs
    text = ''.join(char for char in text if char == '\n' or char == '\t' or char >= ' ')
    return text


def truncate_input(text: str, max_length: int = MAX_INPUT_LENGTH) -> str:
    """Truncate input to maximum allowed length."""
    if len(text) > max_length:
        return text[:max_length] + "..."
    return text


def detect_injection_patterns(text: str) -> list[str]:
    """Detect potential prompt injection patterns. Returns list of detected patterns."""
    detected = []
    for i, pattern in enumerate(COMPILED_PATTERNS):
        if pattern.search(text):
            detected.append(INJECTION_PATTERNS[i])
    return detected


def sanitize_input(
    text: str,
    max_length: int = MAX_INPUT_LENGTH,
    strip_html: bool = True,
    check_injection: bool = True,
    log_issues: bool = True
) -> tuple[str, dict[str, Any]]:
    """
    Sanitize user input text.
    
    Returns:
        tuple: (sanitized_text, metadata)
        metadata contains:
            - was_truncated: bool
            - html_stripped: bool
            - dangerous_chars_removed: bool
            - injection_patterns_detected: list[str]
            - original_length: int
            - final_length: int
    """
    metadata = {
        "was_truncated": False,
        "html_stripped": False,
        "dangerous_chars_removed": False,
        "injection_patterns_detected": [],
        "original_length": len(text),
        "final_length": 0
    }
    
    original_text = text
    
    # Step 1: Remove dangerous characters
    text = remove_dangerous_characters(text)
    if text != original_text:
        metadata["dangerous_chars_removed"] = True
        original_text = text
    
    # Step 2: Strip HTML tags if enabled
    if strip_html:
        text = strip_html_tags(text)
        if text != original_text:
            metadata["html_stripped"] = True
            original_text = text
    
    # Step 3: Check for injection patterns if enabled
    if check_injection:
        detected = detect_injection_patterns(text)
        if detected:
            metadata["injection_patterns_detected"] = detected
    
    # Step 4: Truncate if too long
    if len(text) > max_length:
        text = truncate_input(text, max_length)
        metadata["was_truncated"] = True
    
    metadata["final_length"] = len(text)
    
    return text, metadata


def sanitize_message_content(messages: list[dict]) -> list[dict]:
    """
    Sanitize a list of chat messages.
    Only sanitizes 'user' role messages.
    """
    sanitized_messages = []
    
    for msg in messages:
        if msg.get("role") == "user":
            content = msg.get("content", "")
            sanitized_content, _ = sanitize_input(content)
            sanitized_messages.append({
                **msg,
                "content": sanitized_content
            })
        else:
            sanitized_messages.append(msg)
    
    return sanitized_messages


def sanitize_string_field(value: Optional[str], max_length: int = MAX_INPUT_LENGTH) -> Optional[str]:
    """Sanitize a single string field. Returns None if input is None."""
    if value is None:
        return None
    sanitized, _ = sanitize_input(value, max_length=max_length)
    return sanitized


class SanitizationResult:
    """Container for sanitization results with logging support."""
    
    def __init__(self, original: str, sanitized: str, metadata: dict):
        self.original = original
        self.sanitized = sanitized
        self.metadata = metadata
        self.had_issues = any([
            metadata.get("was_truncated"),
            metadata.get("html_stripped"),
            metadata.get("dangerous_chars_removed"),
            bool(metadata.get("injection_patterns_detected"))
        ])
    
    def log_if_issues(self, logger, user_id: str = "unknown"):
        """Log a warning if any sanitization occurred."""
        if self.had_issues:
            logger.warning(
                "Input sanitized",
                user_id=user_id,
                original_length=self.metadata["original_length"],
                final_length=self.metadata["final_length"],
                was_truncated=self.metadata["was_truncated"],
                html_stripped=self.metadata["html_stripped"],
                injection_detected=bool(self.metadata["injection_patterns_detected"])
            )
