"""
JSON Schema validator with auto-repair attempts.
"""

import json
import re
from pathlib import Path
from typing import Any
from jsonschema import validate, ValidationError, Draft7Validator


# Load schemas from files
SCHEMAS_DIR = Path(__file__).parent.parent / "schemas"


def load_schema(schema_name: str) -> dict[str, Any]:
    """Load a JSON schema by name."""
    schema_path = SCHEMAS_DIR / f"{schema_name}.schema.json"
    if not schema_path.exists():
        raise FileNotFoundError(f"Schema not found: {schema_name}")
    
    with open(schema_path, "r", encoding="utf-8") as f:
        return json.load(f)


def cleanup_json_text(text: str) -> str:
    """
    Clean up JSON text by removing comments and trailing commas.
    """
    # Remove single-line comments // ...
    text = re.sub(r"//.*", "", text)
    # Remove multi-line comments /* ... */
    text = re.sub(r"/\*[\s\S]*?\*/", "", text)
    # Fix trailing commas before closing braces/brackets
    text = re.sub(r",\s*([\]}])", r"\1", text)
    return text.strip()


def extract_json_from_text(text: str) -> dict[str, Any] | None:
    """
    Attempt to extract JSON from text that might contain extra content.
    Handles cases where model returns JSON with surrounding text or in code blocks.
    Also handles truncated code blocks where closing ``` is missing.
    """
    # First, try to strip markdown code fences if present
    # Handle complete code blocks: ```json ... ```
    code_block_match = re.search(r"```(?:json)?\s*\n?([\s\S]*?)\n?```", text)
    if code_block_match:
        content = cleanup_json_text(code_block_match.group(1))
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass
    
    # Handle truncated code blocks: ```json ... (no closing ```)
    # This is common when max_tokens cuts off the response
    truncated_block_match = re.search(r"```(?:json)?\s*\n?([\s\S]+)", text)
    if truncated_block_match:
        block_content = truncated_block_match.group(1)
        # Clean up any trailing incomplete content
        # Try to find the last complete JSON structure
        try:
            return json.loads(cleanup_json_text(block_content))
        except json.JSONDecodeError:
            # Try to repair truncated JSON by finding last valid closing
            repaired = repair_truncated_json(block_content)
            if repaired:
                return repaired
    
    # Try to find standalone JSON object
    json_match = re.search(r"\{[\s\S]*\}", text)
    if json_match:
        content = cleanup_json_text(json_match.group())
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            # Try to repair truncated JSON
            repaired = repair_truncated_json(json_match.group())
            if repaired:
                return repaired

    # Handle truncated JSON object without a closing brace.
    # This happens when long outputs are cut off by max_tokens.
    first_brace = text.find("{")
    if first_brace != -1:
        repaired = repair_truncated_json(text[first_brace:])
        if repaired:
            return repaired
    
    # Try to find JSON array
    array_match = re.search(r"\[[\s\S]*\]", text)
    if array_match:
        content = cleanup_json_text(array_match.group())
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass
    
    return None


def repair_truncated_json(text: str) -> dict[str, Any] | None:
    """
    Attempt to repair truncated JSON by closing open brackets/braces.
    This handles cases where response was cut off due to max_tokens.
    """
    # Count open vs. closed brackets
    open_braces = text.count('{') - text.count('}')
    open_brackets = text.count('[') - text.count(']')
    
    # Remove any trailing incomplete string (cut off in middle of a string value)
    # Look for unclosed quotes
    in_string = False
    escape_next = False
    last_safe_pos = len(text)
    
    for i, char in enumerate(text):
        if escape_next:
            escape_next = False
            continue
        if char == '\\':
            escape_next = True
            continue
        if char == '"':
            in_string = not in_string
        if not in_string and char in ',]}':
            last_safe_pos = i + 1
    
    # If we ended in a string, truncate to last safe position
    if in_string:
        text = text[:last_safe_pos]
        # Recalculate brackets after truncation
        open_braces = text.count('{') - text.count('}')
        open_brackets = text.count('[') - text.count(']')
    
    # Add missing closing brackets/braces
    repaired = text.rstrip()
    
    # Remove trailing comma if any
    if repaired.endswith(','):
        repaired = repaired[:-1]
    
    # Close arrays first, then objects
    repaired += ']' * open_brackets
    repaired += '}' * open_braces
    
    try:
        return json.loads(repaired)
    except json.JSONDecodeError:
        return None


def sanitize_modules_data(data: dict[str, Any]) -> dict[str, Any]:
    """
    Sanitize roadmap module data to fix common LLM type mismatches.
    
    Common issues fixed:
    1. evaluation_questions containing lesson objects instead of strings
    2. practice_exercises containing nested arrays instead of strings
    3. learning_outcomes containing objects instead of strings
    4. Other string-array fields containing wrong types
    """
    # Fields that should be arrays of strings
    STRING_ARRAY_FIELDS = [
        "evaluation_questions",
        "practice_exercises", 
        "learning_outcomes",
        "objectives",
        "prerequisites",
        "topics",
        "key_concepts"
    ]
    
    def extract_string_from_item(item: Any) -> str | None:
        """Extract a string from an item (could be string, dict, or list)."""
        if isinstance(item, str):
            return item
        elif isinstance(item, dict):
            # Try common string fields in order of priority
            for field in ["title", "text", "content", "question", "name", "description"]:
                if field in item and isinstance(item[field], str):
                    return item[field]
            # Fallback: stringify the dict
            return None
        elif isinstance(item, list):
            # Flatten: extract strings from nested list
            strings = []
            for sub in item:
                extracted = extract_string_from_item(sub)
                if extracted:
                    strings.append(extracted)
            return strings[0] if len(strings) == 1 else None  # Only return if single item
        return None
    
    def sanitize_string_array(arr: Any) -> list[str]:
        """Sanitize an array that should contain only strings."""
        if not isinstance(arr, list):
            return []
        
        result = []
        for item in arr:
            if isinstance(item, str):
                result.append(item)
            elif isinstance(item, dict):
                extracted = extract_string_from_item(item)
                if extracted:
                    result.append(extracted)
            elif isinstance(item, list):
                # Flatten nested arrays
                for sub_item in item:
                    extracted = extract_string_from_item(sub_item)
                    if extracted:
                        result.append(extracted)
        
        return result

    def normalize_assessment_type(value: Any) -> str | None:
        """Normalize common enum variants to schema-safe values."""
        if not isinstance(value, str):
            return None

        normalized = re.sub(r"[\s\-]+", "_", value.strip().lower())
        normalized = re.sub(r"_+", "_", normalized).strip("_")

        if normalized in {"quiz", "project", "peer_review"}:
            return normalized

        if normalized.replace("_", "") == "peerreview":
            return "peer_review"

        return None
    
    # Make a deep copy to avoid mutating input
    import copy
    data = copy.deepcopy(data)
    
    # Sanitize modules array
    if "modules" in data and isinstance(data["modules"], list):
        for module in data["modules"]:
            if not isinstance(module, dict):
                continue
            
            # Fix each string-array field
            for field in STRING_ARRAY_FIELDS:
                if field in module:
                    original = module[field]
                    if not isinstance(original, list):
                        # Convert non-list to empty list
                        module[field] = []
                    else:
                        # Check if needs sanitization
                        needs_fix = any(not isinstance(item, str) for item in original)
                        if needs_fix:
                            module[field] = sanitize_string_array(original)

    # Normalize checkpoint enum variants, e.g. "peer review" -> "peer_review".
    if "checkpoints" in data and isinstance(data["checkpoints"], list):
        for checkpoint in data["checkpoints"]:
            if not isinstance(checkpoint, dict):
                continue
            normalized_assessment = normalize_assessment_type(
                checkpoint.get("assessment_type")
            )
            if normalized_assessment:
                checkpoint["assessment_type"] = normalized_assessment
    
    return data


def validate_and_repair(
    data: dict[str, Any] | str,
    schema_name: str,
) -> tuple[dict[str, Any], list[str]]:
    """
    Validate data against schema and attempt repairs if needed.
    
    Args:
        data: Data to validate (dict or JSON string)
        schema_name: Name of schema file (without extension)
    
    Returns:
        Tuple of (validated_data, list_of_warnings)
    
    Raises:
        ValidationError: If validation fails after repair attempts
    """
    warnings: list[str] = []
    schema = load_schema(schema_name)
    
    # Parse if string
    if isinstance(data, str):
        try:
            parsed = json.loads(data)
        except json.JSONDecodeError:
            # Try to extract JSON from text
            parsed = extract_json_from_text(data)
            if parsed is None:
                raise ValidationError("Could not parse JSON from response")
            warnings.append("Extracted JSON from surrounding text")
        data = parsed
    
    # Pre-sanitize roadmap data to fix common LLM type mismatches
    if schema_name == "roadmap" and isinstance(data, dict):
        data = sanitize_modules_data(data)
    
    # Validate
    validator = Draft7Validator(schema)
    errors = list(validator.iter_errors(data))
    
    if not errors:
        return data, warnings
    
    # Attempt repairs for common issues
    repaired_data = dict(data)

    def _normalize_enum_token(value: str) -> str:
        token = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
        return re.sub(r"_+", "_", token)

    def _canonicalize_enum_value(instance: Any, allowed_values: Any) -> str | None:
        if not isinstance(instance, str) or not isinstance(allowed_values, list):
            return None

        normalized_instance = _normalize_enum_token(instance)
        collapsed_instance = normalized_instance.replace("_", "")

        for allowed in allowed_values:
            if not isinstance(allowed, str):
                continue
            normalized_allowed = _normalize_enum_token(allowed)
            collapsed_allowed = normalized_allowed.replace("_", "")
            if normalized_instance == normalized_allowed or collapsed_instance == collapsed_allowed:
                return allowed

        return None

    def _set_nested_value(container: Any, path: list[Any], value: Any) -> bool:
        if not path:
            return False

        cursor = container
        for part in path[:-1]:
            if isinstance(cursor, dict):
                cursor = cursor.get(part)
            elif isinstance(cursor, list) and isinstance(part, int) and 0 <= part < len(cursor):
                cursor = cursor[part]
            else:
                return False

        last = path[-1]
        if isinstance(cursor, dict):
            cursor[last] = value
            return True

        if isinstance(cursor, list) and isinstance(last, int) and 0 <= last < len(cursor):
            cursor[last] = value
            return True

        return False
    
    for error in errors:
        path = list(error.absolute_path)
        
        # Missing required field - try to add default
        if error.validator == "required":
            missing = set(error.validator_value) - set(error.instance.keys())
            for field in missing:
                # Add empty defaults based on schema
                field_schema = schema.get("properties", {}).get(field, {})
                field_type = field_schema.get("type", "string")
                
                if field_type == "string":
                    repaired_data[field] = ""
                elif field_type == "array":
                    repaired_data[field] = []
                elif field_type == "object":
                    repaired_data[field] = {}
                elif field_type == "integer":
                    repaired_data[field] = 0
                elif field_type == "number":
                    repaired_data[field] = 0.0
                elif field_type == "boolean":
                    repaired_data[field] = False
                
                warnings.append(f"Added default for missing field: {field}")

        # Enum mismatch with equivalent formatting, e.g. "peer review" vs "peer_review"
        elif error.validator == "enum":
            canonical_value = _canonicalize_enum_value(
                error.instance,
                error.validator_value,
            )
            if canonical_value is not None and _set_nested_value(repaired_data, path, canonical_value):
                warnings.append(
                    f"Normalized enum value at {path}: {error.instance!r} -> {canonical_value!r}"
                )
    
    # Re-validate after repairs
    errors = list(validator.iter_errors(repaired_data))
    if errors:
        error_messages = [f"{e.path}: {e.message}" for e in errors[:5]]
        raise ValidationError(
            f"Schema validation failed: {'; '.join(error_messages)}"
        )
    
    return repaired_data, warnings


class SchemaValidationResult:
    """Result of schema validation."""
    
    def __init__(
        self,
        success: bool,
        data: dict[str, Any] | None = None,
        errors: list[str] | None = None,
        warnings: list[str] | None = None,
    ):
        self.success = success
        self.data = data
        self.errors = errors or []
        self.warnings = warnings or []


def safe_validate(
    data: dict[str, Any] | str,
    schema_name: str,
) -> SchemaValidationResult:
    """
    Safely validate data, catching all exceptions.
    
    Returns SchemaValidationResult instead of raising.
    """
    try:
        validated, warnings = validate_and_repair(data, schema_name)
        return SchemaValidationResult(
            success=True,
            data=validated,
            warnings=warnings,
        )
    except ValidationError as e:
        return SchemaValidationResult(
            success=False,
            errors=[str(e)],
        )
    except Exception as e:
        return SchemaValidationResult(
            success=False,
            errors=[f"Unexpected error: {str(e)}"],
        )
