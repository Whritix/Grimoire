"""
Function Call Registry - Implements callable functions for agent actions.
Provides fetch_transcript, sign_badge, append_to_notes functionality.
"""

import hmac
import hashlib
import time
import re
from typing import Any, Callable
from dataclasses import dataclass
from enum import Enum

from shared.config import get_settings
from shared.utils import get_logger

logger = get_logger(__name__)


class FunctionStatus(str, Enum):
    """Function execution status."""
    SUCCESS = "success"
    ERROR = "error"
    PENDING = "pending"


@dataclass
class FunctionResult:
    """Result from function execution."""
    name: str
    status: FunctionStatus
    result: Any
    error: str | None = None
    execution_time_ms: float = 0


# Type alias for function implementations
FunctionHandler = Callable[..., Any]

# Registry of available functions
_function_registry: dict[str, FunctionHandler] = {}


def register_function(name: str):
    """Decorator to register a function in the registry."""
    def decorator(func: FunctionHandler):
        _function_registry[name] = func
        return func
    return decorator


def get_available_functions() -> list[dict[str, Any]]:
    """Get list of available functions with their schemas."""
    return [
        {
            "name": "fetch_transcript",
            "description": "Fetch transcript from a YouTube video",
            "parameters": {
                "type": "object",
                "properties": {
                    "video_id": {
                        "type": "string",
                        "description": "YouTube video ID (e.g., 'dQw4w9WgXcQ')"
                    },
                    "language": {
                        "type": "string",
                        "description": "Preferred language code (default: 'en')",
                        "default": "en"
                    }
                },
                "required": ["video_id"]
            }
        },
        {
            "name": "sign_badge",
            "description": "Create a cryptographically signed badge claim",
            "parameters": {
                "type": "object",
                "properties": {
                    "badge_id": {
                        "type": "string",
                        "description": "Unique badge identifier"
                    },
                    "user_id": {
                        "type": "string",
                        "description": "User receiving the badge"
                    },
                    "achievement": {
                        "type": "string",
                        "description": "Description of the achievement"
                    },
                    "evidence": {
                        "type": "array",
                        "description": "Evidence supporting the badge",
                        "items": {"type": "object"}
                    }
                },
                "required": ["badge_id", "user_id", "achievement"]
            }
        },
        {
            "name": "append_to_notes",
            "description": "Append content to user's notes for a lesson",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "User ID"
                    },
                    "lesson_id": {
                        "type": "string",
                        "description": "Lesson ID the notes belong to"
                    },
                    "content": {
                        "type": "string",
                        "description": "Content to append to notes"
                    },
                    "note_type": {
                        "type": "string",
                        "enum": ["summary", "question", "insight", "bookmark"],
                        "description": "Type of note"
                    }
                },
                "required": ["user_id", "lesson_id", "content"]
            }
        }
    ]


# Global storage for video context (for video chat feature)
_video_contexts: dict[str, dict] = {}


async def transcribe_with_groq_whisper(audio_path: str) -> dict[str, Any]:
    """
    Transcribe audio file using Groq's Whisper model.
    
    Args:
        audio_path: Path to the audio file
        
    Returns:
        Dict with transcript text and metadata
    """
    from openai import OpenAI
    from shared.config import get_settings
    
    settings = get_settings()
    
    if not settings.groq_api_key:
        raise ValueError("Groq API key not configured")
    
    try:
        client = OpenAI(
            api_key=settings.groq_api_key,
            base_url="https://api.groq.com/openai/v1",
        )
        
        logger.info(f"🎤 Transcribing audio with Groq Whisper: {audio_path}")
        
        with open(audio_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                model="whisper-large-v3-turbo",
                file=audio_file,
                response_format="verbose_json",
            )
        
        logger.info(f"✅ Audio transcribed successfully. Length: {len(transcription.text)} chars")
        
        return {
            "text": transcription.text,
            "language": getattr(transcription, "language", "unknown"),
            "duration": getattr(transcription, "duration", 0),
            "segments": getattr(transcription, "segments", []),
        }
        
    except Exception as e:
        logger.error(f"Groq Whisper transcription failed: {str(e)}")
        raise


async def analyze_with_groq_llm(transcript: str, video_title: str, video_duration: int) -> dict[str, Any]:
    """
    Analyze transcript using Groq LLM to generate summary, lessons, and chapters.
    
    Args:
        transcript: The transcribed text
        video_title: Title of the video
        video_duration: Duration in seconds
        
    Returns:
        Dict with summary, lessons, chapters, etc.
    """
    from openai import AsyncOpenAI
    from shared.config import get_settings
    import json
    import re
    
    settings = get_settings()
    
    if not settings.groq_api_key:
        raise ValueError("Groq API key not configured")
    
    try:
        client = AsyncOpenAI(
            api_key=settings.groq_api_key,
            base_url="https://api.groq.com/openai/v1",
        )
        
        prompt = f"""Analyze this YouTube video transcript and provide:

VIDEO TITLE: {video_title}
DURATION: {video_duration // 60} minutes

TRANSCRIPT:
{transcript[:10000]}

Please provide:

1. **Summary** (2-3 paragraphs): What is this video about? What are the main points discussed?

2. **Key Lessons** (5-8 bullet points): What are the most important takeaways?

3. **Chapters** (identify topic changes with timestamps):
   - Create meaningful chapter titles for different sections
   - Estimate timestamps based on content flow
   - Format: [timestamp] Chapter Title

4. **Topics Covered**: List the main topics/concepts discussed

5. **Difficulty Level**: Beginner/Intermediate/Advanced

Respond in this JSON format:
{{
    "summary": "Full summary text...",
    "lessons": ["Lesson 1", "Lesson 2", ...],
    "chapters": [
        {{"title": "Chapter Name", "timestamp": "0:00", "start_time": 0}},
        ...
    ],
    "topics": ["topic1", "topic2", ...],
    "difficulty": "Beginner|Intermediate|Advanced"
}}"""
        
        logger.info("🤖 Analyzing transcript with Groq LLM...")
        
        response = await client.chat.completions.create(
            model=settings.groq_model,
            messages=[
                {"role": "system", "content": "You are a video content analyzer. Provide detailed analysis in valid JSON format."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=4096,
        )
        
        content = response.choices[0].message.content or ""
        content = content.replace("```json", "").replace("```", "").strip()
        
        try:
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                result = json.loads(json_match.group())
            else:
                result = {"summary": content, "lessons": [], "chapters": []}
        except json.JSONDecodeError:
            result = {"summary": content, "lessons": [], "chapters": []}
        
        logger.info("✅ Transcript analysis complete")
        return result
        
    except Exception as e:
        logger.error(f"Groq LLM analysis failed: {str(e)}")
        raise


async def analyze_video_with_groq_fallback(video_id: str, video_url: str, audio_path: str, video_title: str, video_duration: int) -> dict[str, Any]:
    """
    Fallback video analysis using Groq Whisper + LLM pipeline.
    Called when Gemini fails.
    
    Args:
        video_id: YouTube video ID
        video_url: Full YouTube URL
        audio_path: Path to downloaded audio file
        video_title: Title of the video
        video_duration: Duration in seconds
        
    Returns:
        Analysis result dict
    """
    import time
    
    try:
        logger.info(f"🔄 Using Groq Whisper fallback for video {video_id}")
        
        # Step 1: Transcribe audio with Whisper
        whisper_result = await transcribe_with_groq_whisper(audio_path)
        transcript_text = whisper_result.get("text", "")
        
        if not transcript_text:
            return {"error": "Whisper transcription returned empty text"}
        
        # Step 2: Analyze transcript with Groq LLM
        analysis = await analyze_with_groq_llm(transcript_text, video_title, video_duration)
        
        # Store context for video chat
        _video_contexts[video_id] = {
            "title": video_title,
            "duration": video_duration,
            "summary": analysis.get("summary", ""),
            "lessons": analysis.get("lessons", []),
            "topics": analysis.get("topics", []),
            "analyzed_at": time.time(),
        }
        
        return {
            "video_id": video_id,
            "embed_url": f"https://www.youtube.com/embed/{video_id}",
            "watch_url": video_url,
            "title": video_title,
            "source_language": whisper_result.get("language", "unknown"),
            "translated": False,
            "text": analysis.get("summary", ""),
            "summary": analysis.get("summary", ""),
            "lessons": analysis.get("lessons", []),
            "chapters": analysis.get("chapters", []),
            "topics": analysis.get("topics", []),
            "difficulty": analysis.get("difficulty", "Unknown"),
            "duration_seconds": video_duration,
            "duration_formatted": format_timestamp(video_duration),
            "analysis_method": "groq_whisper",
            "can_chat": True,
            "note": "📺 This video was analyzed using Groq Whisper + LLM (Gemini quota exceeded).",
        }
        
    except Exception as e:
        logger.error(f"Groq fallback failed: {str(e)}")
        return {"error": f"Groq fallback failed: {str(e)}", "video_id": video_id}


async def analyze_video_with_gemini(video_id: str, video_url: str) -> dict[str, Any]:
    """
    Analyze a YouTube video using Gemini's multimodal capabilities.
    Falls back to Groq Whisper + LLM if all Gemini keys are exhausted.
    
    Downloads audio and uses Gemini to generate summary, lessons, and chapters.
    If Gemini fails, uses Groq Whisper for transcription + Groq LLM for analysis.
    """
    import tempfile
    import os
    import shutil
    import google.generativeai as genai
    import google.api_core.exceptions
    from shared.config import get_settings
    
    settings = get_settings()
    
    # Validate API keys
    api_keys = settings.gemini_api_keys
    has_gemini = bool(api_keys)
    has_groq = bool(settings.groq_api_key and settings.groq_enabled)
    
    if not has_gemini and not has_groq:
        return {"error": "No API keys configured (neither Gemini nor Groq)"}
    
    uploaded_file = None
    last_error = None
    video_title = "Unknown"
    video_duration = 0
    
    # Create a persistent temp directory for audio (will be cleaned up manually)
    temp_dir = tempfile.mkdtemp()
    downloaded_file = None
    
    try:
        # Step 1: Download audio using yt-dlp (ONCE, before trying any API)
        import yt_dlp
        
        ydl_opts = {
            'format': 'bestaudio[ext=m4a]/bestaudio/best',
            'outtmpl': os.path.join(temp_dir, f'{video_id}.%(ext)s'),
            'quiet': True,
            'no_warnings': True,
        }
        
        logger.info(f"📥 Downloading audio for video {video_id}...")
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=True)
            video_title = info.get('title', 'Unknown')
            video_duration = info.get('duration', 0)
            
            # Find the downloaded file
            for file in os.listdir(temp_dir):
                if file.startswith(video_id):
                    downloaded_file = os.path.join(temp_dir, file)
                    break
            
            if not downloaded_file:
                raise Exception("Failed to find downloaded audio file")
            
            logger.info(f"✅ Downloaded audio: {downloaded_file}, size: {os.path.getsize(downloaded_file)} bytes")
        
        # Step 2: Try Groq Whisper + LLM FIRST (faster)
        if has_groq and downloaded_file:
            logger.info(f"🚀 Trying Groq Whisper + LLM (primary)...")
            try:
                groq_result = await analyze_video_with_groq_fallback(
                    video_id=video_id,
                    video_url=video_url,
                    audio_path=downloaded_file,
                    video_title=video_title,
                    video_duration=video_duration
                )
                if "error" not in groq_result:
                    return groq_result
                else:
                    logger.warning(f"⚠️ Groq failed: {groq_result.get('error')}. Trying Gemini fallback...")
                    last_error = groq_result.get("error")
            except Exception as groq_error:
                logger.warning(f"⚠️ Groq failed: {str(groq_error)}. Trying Gemini fallback...")
                last_error = str(groq_error)
        
        # Step 3: Fallback to Gemini API keys
        if has_gemini:
            max_gemini_attempts = 3  # Limit attempts to avoid timeout
            for key_index, api_key in enumerate(api_keys[:max_gemini_attempts]):
                try:
                    genai.configure(api_key=api_key)
                    logger.info(f"Trying Gemini API key {key_index + 1}/{len(api_keys)} (ending ...{api_key[-4:]})")
                    
                    # Upload audio to Gemini
                    uploaded_file = genai.upload_file(
                        path=downloaded_file,
                        display_name=f"youtube_{video_id}"
                    )
                    
                    # Wait for file to be processed
                    import time
                    while uploaded_file.state.name == "PROCESSING":
                        time.sleep(1)
                        uploaded_file = genai.get_file(uploaded_file.name)
                    
                    if uploaded_file.state.name == "FAILED":
                        logger.error(f"Gemini file processing failed: {uploaded_file}")
                        last_error = "File processing failed"
                        continue
                    
                    # Generate analysis with Gemini
                    model = genai.GenerativeModel(model_name="gemini-2.5-flash")
                    
                    prompt = f"""Analyze this YouTube video audio and provide:

VIDEO TITLE: {video_title}
DURATION: {video_duration // 60} minutes

Please provide:

1. **Summary** (2-3 paragraphs): What is this video about? What are the main points discussed?

2. **Key Lessons** (5-8 bullet points): What are the most important takeaways?

3. **Chapters** (identify topic changes with timestamps):
   - Create meaningful chapter titles for different sections
   - Estimate timestamps based on content flow
   - Format: [timestamp] Chapter Title

4. **Topics Covered**: List the main topics/concepts discussed

5. **Difficulty Level**: Beginner/Intermediate/Advanced

6. **Language**: What language is spoken? If not English, translate all content to English.

Respond in this JSON format:
{{
    "summary": "Full summary text...",
    "lessons": ["Lesson 1", "Lesson 2", ...],
    "chapters": [
        {{"title": "Chapter Name", "timestamp": "0:00", "start_time": 0}},
        ...
    ],
    "topics": ["topic1", "topic2", ...],
    "difficulty": "Beginner|Intermediate|Advanced",
    "original_language": "detected language",
    "is_translated": true/false
}}"""
                    
                    response = model.generate_content([uploaded_file, prompt])
                    
                    # Parse response
                    import json
                    import re
                    
                    content = response.text
                    content = content.replace("```json", "").replace("```", "").strip()
                    
                    try:
                        json_match = re.search(r'\{[\s\S]*\}', content)
                        if json_match:
                            result = json.loads(json_match.group())
                        else:
                            result = {"summary": content, "lessons": [], "chapters": []}
                    except json.JSONDecodeError:
                        result = {"summary": content, "lessons": [], "chapters": []}
                    
                    # Store context for video chat
                    _video_contexts[video_id] = {
                        "title": video_title,
                        "duration": video_duration,
                        "summary": result.get("summary", ""),
                        "lessons": result.get("lessons", []),
                        "topics": result.get("topics", []),
                        "analyzed_at": time.time(),
                    }
                    
                    # Success! Cleanup and return
                    logger.info(f"✅ Video analysis successful with Gemini API key {key_index + 1}")
                    
                    # Cleanup Gemini file
                    try:
                        genai.delete_file(uploaded_file.name)
                    except:
                        pass
                    
                    return {
                        "video_id": video_id,
                        "embed_url": f"https://www.youtube.com/embed/{video_id}",
                        "watch_url": video_url,
                        "title": video_title,
                        "source_language": result.get("original_language", "unknown"),
                        "translated": result.get("is_translated", False),
                        "text": result.get("summary", ""),
                        "summary": result.get("summary", ""),
                        "lessons": result.get("lessons", []),
                        "chapters": result.get("chapters", []),
                        "topics": result.get("topics", []),
                        "difficulty": result.get("difficulty", "Unknown"),
                        "duration_seconds": video_duration,
                        "duration_formatted": format_timestamp(video_duration),
                        "analysis_method": "gemini_multimodal",
                        "can_chat": True,
                    }
                
                except google.api_core.exceptions.ResourceExhausted as e:
                    logger.warning(f"⚠️ Quota exceeded for key {key_index + 1} (ending ...{api_key[-4:]}). Rotating...")
                    last_error = str(e)
                    if uploaded_file:
                        try:
                            genai.delete_file(uploaded_file.name)
                            uploaded_file = None
                        except:
                            pass
                    continue
                
                except Exception as e:
                    error_msg = str(e)
                    if "403" in error_msg or "API_KEY_INVALID" in error_msg or "invalid" in error_msg.lower():
                        logger.warning(f"⚠️ Invalid/forbidden key {key_index + 1} (ending ...{api_key[-4:]}). Rotating...")
                        last_error = error_msg
                        if uploaded_file:
                            try:
                                genai.delete_file(uploaded_file.name)
                                uploaded_file = None
                            except:
                                pass
                        continue
                    else:
                        logger.error(f"Video analysis failed with non-recoverable error: {error_msg}")
                        last_error = error_msg
                        break
            
            # Cleanup uploaded file after all keys exhausted
            if uploaded_file:
                try:
                    genai.delete_file(uploaded_file.name)
                except:
                    pass
        
        # All methods exhausted
        return {
            "error": f"Video analysis failed: {last_error or 'All APIs failed'}",
            "video_id": video_id,
        }
    
    except Exception as e:
        return {
            "error": f"Video analysis failed: {str(e)}",
            "video_id": video_id,
        }
    
    finally:
        # Cleanup temp directory
        try:
            shutil.rmtree(temp_dir)
        except:
            pass


@register_function("fetch_transcript")
async def fetch_transcript(video_id: str, language: str = "en", generate_summary: bool = True) -> dict[str, Any]:
    """
    Fetch transcript from a YouTube video with AI-powered summary and lessons.
    Supports any language - will translate to English if needed.
    
    Args:
        video_id: YouTube video ID
        language: Preferred transcript language
        generate_summary: Whether to generate AI summary and lessons
        
    Returns:
        Transcript text, chapters, summary, and lessons
    """
    import yt_dlp
    import requests
    from datetime import datetime, timezone
    try:
        import re
        
        # Extract video ID from URL or string
        vid = video_id.strip()
        
        # Multiple regex patterns for different YouTube URL formats
        patterns = [
            r'(?:youtube\.com\/watch\?v=|youtu\.be\/)([0-9A-Za-z_-]{11})',  # Standard and short URLs
            r'(?:youtube\.com\/embed\/)([0-9A-Za-z_-]{11})',  # Embed URLs
            r'(?:youtube\.com\/v\/)([0-9A-Za-z_-]{11})',  # Old format
            r'^([0-9A-Za-z_-]{11})$',  # Just the ID
        ]
        
        extracted = None
        for pattern in patterns:
            match = re.search(pattern, vid)
            if match:
                extracted = match.group(1)
                break
        
        if extracted:
            vid = extracted
        else:
            # Last resort - try to find any 11-char alphanumeric sequence
            id_match = re.search(r'([0-9A-Za-z_-]{11})', vid)
            if id_match:
                vid = id_match.group(1)
            
        # Fallback cleanup
        vid = vid.replace("yt_", "").strip()
        
        # Metadata defaults (filled from yt-dlp when available)
        video_title = f"YouTube Video {vid}"
        video_description = ""
        video_channel = ""
        video_thumbnail_url = f"https://img.youtube.com/vi/{vid}/maxresdefault.jpg"
        video_published_at = None
        fallback_duration_seconds = 0.0

        def parse_published_at(video_info: dict[str, Any]) -> str | None:
            """Normalize publish date from yt-dlp fields to ISO 8601."""
            timestamp = video_info.get("timestamp") or video_info.get("release_timestamp")
            if timestamp:
                try:
                    dt = datetime.fromtimestamp(int(timestamp), tz=timezone.utc)
                    return dt.isoformat().replace("+00:00", "Z")
                except Exception:
                    pass

            upload_date = video_info.get("upload_date") or video_info.get("release_date")
            if isinstance(upload_date, str):
                try:
                    if re.match(r"^\d{8}$", upload_date):
                        dt = datetime.strptime(upload_date, "%Y%m%d").replace(tzinfo=timezone.utc)
                        return dt.isoformat().replace("+00:00", "Z")
                except Exception:
                    pass

            return None

        # Transcript fetching with yt-dlp
        transcript_result = []
        source_language = language
        needs_translation = False
        
        try:
            url = f"https://www.youtube.com/watch?v={vid}"
            ydl_opts = {
                'skip_download': True,
                'quiet': True,
                'no_warnings': True,
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False) or {}

                # Reuse yt-dlp video metadata for frontend display.
                video_title = info.get("title") or video_title
                video_description = info.get("description") or ""
                video_channel = info.get("channel") or info.get("uploader") or ""
                video_published_at = parse_published_at(info)

                thumbnail = info.get("thumbnail")
                if thumbnail:
                    video_thumbnail_url = thumbnail
                else:
                    thumbnails = info.get("thumbnails")
                    if isinstance(thumbnails, list) and thumbnails:
                        candidate = thumbnails[-1].get("url")
                        if candidate:
                            video_thumbnail_url = candidate

                info_duration = info.get("duration")
                if isinstance(info_duration, (int, float)) and info_duration > 0:
                    fallback_duration_seconds = float(info_duration)
                
                # Check for subtitles (manual first, then auto)
                subs = info.get('subtitles', {})
                auto_subs = info.get('automatic_captions', {})
                
                sub_url = None
                
                # Helper to find json3 format
                def find_json3_url(sub_dict, lang):
                    if lang in sub_dict:
                        for fmt in sub_dict[lang]:
                            if fmt.get('ext') == 'json3':
                                return fmt['url']
                    return None
                
                # 1. Try manual preferred language
                sub_url = find_json3_url(subs, language)
                
                # 2. Try manual English
                if not sub_url and language != 'en':
                    sub_url = find_json3_url(subs, 'en')
                    if sub_url:
                        source_language = 'en'
                        needs_translation = True
                
                # 3. Try auto preferred language
                if not sub_url:
                    sub_url = find_json3_url(auto_subs, language)
                
                # 4. Try auto English
                if not sub_url and language != 'en':
                    sub_url = find_json3_url(auto_subs, 'en')
                    if sub_url:
                        source_language = 'en'
                        needs_translation = True
                
                if not sub_url:
                     raise Exception("No transcript available (manual or auto)")
                
                # Download subtitle content
                # Use headers to avoid 429
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
                response = requests.get(sub_url, headers=headers)
                response.raise_for_status()
                data = response.json()
                
                # Parse json3 format
                # Format: {'events': [{'tStartMs': 123, 'dDurationMs': 100, 'segs': [{'utf8': 'text'}]}]}
                events = data.get('events', [])
                for event in events:
                    segs = event.get('segs', [])
                    if not segs: continue
                    
                    text_parts = []
                    for s in segs:
                        t = s.get('utf8', '').strip()
                        if t and t != '\n':
                            text_parts.append(t)
                    
                    text = " ".join(text_parts)
                    if not text: continue
                    
                    start_ms = event.get('tStartMs', 0)
                    dur_ms = event.get('dDurationMs', 0)
                    
                    transcript_result.append({
                        "text": text,
                        "start": start_ms / 1000.0,
                        "duration": dur_ms / 1000.0
                    })
                        
        except Exception as dl_err:
             # Just re-raise to trigger fallback
             raise dl_err
        
        if not transcript_result:
            # Empty transcript is same as no transcript
             raise Exception("No transcript available (empty content)")
        
        # Convert to list of segments with timing
        segments = list(transcript_result)
        
        # Extract text and timing from segments
        timed_segments = []
        texts = []
        duration = 0
        
        for seg in segments:
            if hasattr(seg, 'text'):
                text = seg.text
                start = getattr(seg, 'start', 0)
                dur = getattr(seg, 'duration', 0)
            elif isinstance(seg, dict):
                text = seg.get("text", "")
                start = seg.get("start", 0)
                dur = seg.get("duration", 0)
            else:
                continue
            
            texts.append(text)
            timed_segments.append({
                "text": text,
                "start": start,
                "duration": dur,
                "timestamp": format_timestamp(start)
            })
            
            end_time = start + dur
            if end_time > duration:
                duration = end_time
        
        full_text = " ".join(texts)

        if duration <= 0 and fallback_duration_seconds > 0:
            duration = fallback_duration_seconds
        
        # Translate if needed (non-English transcript)
        translated_text = None
        if needs_translation and full_text:
            try:
                translated_text = await translate_transcript(full_text[:6000], source_language)
                # Use translated text for analysis
                analysis_text = translated_text
            except Exception:
                analysis_text = full_text  # Fallback to original
        else:
            analysis_text = full_text
        
        # Detect chapters from transcript
        chapters = []
        
        # Generate AI summary, lessons, and chapters in one call for speed
        summary = None
        lessons = []
        
        if generate_summary and analysis_text:
            try:
                ai_result = await generate_video_analysis(analysis_text[:8000], timed_segments, vid)
                summary = ai_result.get("summary", "")
                lessons = ai_result.get("lessons", [])
                chapters = ai_result.get("chapters", [])
            except Exception as e:
                summary = f"Analysis failed: {str(e)}"
        
        # Store context for video chat
        import time
        _video_contexts[vid] = {
            "title": video_title,
            "duration": duration,
            "summary": summary,
            "lessons": lessons,
            "topics": [],  # Could be extracted from summary
            "analyzed_at": time.time(),
        }
        
        return {
            "video_id": vid,
            "embed_url": f"https://www.youtube.com/embed/{vid}",
            "watch_url": f"https://www.youtube.com/watch?v={vid}",
            "title": video_title,
            "description": video_description,
            "channel": video_channel,
            "published_at": video_published_at,
            "thumbnail_url": video_thumbnail_url,
            "source_language": source_language,
            "translated": needs_translation,
            "text": translated_text if translated_text else full_text,
            "original_text": full_text if needs_translation else None,
            "segments_count": len(segments),
            "duration_seconds": duration,
            "duration_formatted": format_timestamp(duration),
            "chapters": chapters,
            "summary": summary,
            "lessons": lessons,
            "timed_segments": timed_segments[:50],  # First 50 for display
            "can_chat": True,  # Enable chat for transcript-analyzed videos too
        }
        
    except Exception as e:
        error_msg = str(e)
        
        # Check if this is a "no transcript" error - try Gemini multimodal fallback
        no_transcript_errors = [
            "Could not retrieve a transcript",
            "TranscriptsDisabled", 
            "NoTranscriptFound",
            "no transcripts",
            "no element found",
            "ParseError",
            "No transcript available",
            "Too Many Requests",
            "429",
        ]
        
        is_no_transcript = any(err in error_msg for err in no_transcript_errors)
        
        if is_no_transcript:
            # Try Gemini multimodal fallback
            try:
                video_url = f"https://www.youtube.com/watch?v={vid}"
                fallback_result = await analyze_video_with_gemini(vid, video_url)
                
                if "error" not in fallback_result:
                    # Add a note that this used AI analysis
                    fallback_result["note"] = "📺 This video was analyzed using AI (no captions available). Summary and chapters are AI-generated."
                    return fallback_result
                else:
                    # Gemini fallback also failed
                    error_msg = f"No transcript available and AI analysis failed: {fallback_result.get('error', 'Unknown error')}"
            except Exception as fallback_err:
                error_msg = f"No transcript available and AI fallback failed: {str(fallback_err)}"
        
        # Other errors or fallback failed
        elif "VideoUnavailable" in error_msg:
            error_msg = "❌ This video is unavailable (private, deleted, or region-restricted)."
        elif "TooManyRequests" in error_msg:
            error_msg = "⚠️ Rate limited by YouTube. Please wait a moment and try again."
        elif "InvalidVideoId" in error_msg:
            error_msg = "❌ Invalid YouTube video ID. Please check the URL and try again."
        else:
            error_msg = f"❌ Error fetching transcript: {error_msg}"
        
        return {
            "error": error_msg,
            "video_id": vid,
            "text": None,
            "help": "If the video has no captions and AI analysis failed, try a different video or check your internet connection."
        }


def format_timestamp(seconds: float) -> str:
    """Format seconds to MM:SS or HH:MM:SS."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


@register_function("video_chat")
async def video_chat(video_id: str, question: str) -> dict[str, Any]:
    """
    Ask a question about an analyzed video.
    Uses the stored video context from previous analysis.
    
    Args:
        video_id: The YouTube video ID
        question: User's question about the video
        
    Returns:
        AI response about the video content
    """
    from shared.models import get_model_router, AgentType
    
    # Check if we have context for this video
    if video_id not in _video_contexts:
        return {
            "error": "This video hasn't been analyzed yet. Please analyze the video first.",
            "video_id": video_id
        }
    
    context = _video_contexts[video_id]
    
    try:
        model_router = get_model_router()
        
        prompt = f"""You are an AI assistant helping users understand a YouTube video they watched.

VIDEO CONTEXT:
- Title: {context.get('title', 'Unknown')}
- Duration: {context.get('duration', 0) // 60 if context.get('duration') else 0} minutes
- Summary: {context.get('summary', 'No summary available')}
- Key Lessons: {', '.join(context.get('lessons', []))}
- Topics Covered: {', '.join(context.get('topics', []))}

USER QUESTION: {question}

Please answer the user's question based on the video context above. If the question is about something not covered in the video, say so. Be helpful and educational. Respond in Markdown format."""
        
        response = await model_router.generate(
            agent_type=AgentType.DOUBT,
            system_prompt="You are a helpful video analysis assistant.",
            prompt=prompt,
            max_tokens=2000,
        )
        
        return {
            "video_id": video_id,
            "question": question,
            "answer": response.content,
            "video_title": context.get('title', 'Unknown'),
        }
        
    except Exception as e:
        return {
            "error": f"Failed to answer question: {str(e)}",
            "video_id": video_id
        }


def get_video_context(video_id: str) -> dict | None:
    """Get stored video context for chat functionality."""
    return _video_contexts.get(video_id)


async def translate_transcript(text: str, source_language: str) -> str:
    """Translate transcript to English using AI."""
    try:
        from shared.models import get_model_router, AgentType
        
        model_router = get_model_router()
        
        prompt = f"""Translate the following text from {source_language} to English.
Keep the translation natural and accurate. Preserve the meaning and tone.

Text to translate:
{text}

Provide ONLY the English translation, nothing else."""
        
        response = await model_router.generate(
            agent_type=AgentType.SUMMARIZE,
            prompt=prompt,
            system_prompt="You are a professional translator. Translate accurately to English.",
            temperature=0.1,
            max_tokens=32000,
        )
        
        return response.content.strip()
        
    except Exception as e:
        # Return original if translation fails
        return text


async def generate_video_analysis(transcript_text: str, timed_segments: list, video_id: str) -> dict:
    """Use AI to generate summary, lessons, and intelligent chapters from transcript."""
    try:
        from shared.models import get_model_router, AgentType
        import json
        
        model_router = get_model_router()
        
        # Calculate video duration and target chapter count
        video_duration_seconds = 0
        if timed_segments:
            last_seg = timed_segments[-1]
            video_duration_seconds = last_seg.get("start", 0) + last_seg.get("duration", 0)
        
        video_minutes = max(1, video_duration_seconds // 60)
        # Target: at least half the minutes as chapters, min 5, max 20
        target_chapters = max(5, min(20, video_minutes // 2))
        
        # Build a more detailed timeline for chapter detection
        timeline = ""
        if timed_segments:
            # Sample more points for better chapter detection
            step = max(1, len(timed_segments) // 40)  # Sample ~40 points
            for i in range(0, len(timed_segments), step):
                seg = timed_segments[i]
                timeline += f"[{seg.get('timestamp', '0:00')}] {seg.get('text', '')[:60]}\n"
        
        prompt = f"""Analyze this video transcript and provide detailed chapters.

VIDEO DURATION: {video_minutes} minutes
TARGET: Create approximately {target_chapters} chapters (aim for 1 chapter every 2 minutes)

Provide:
1. **Summary**: 2-3 sentences describing what this video is about
2. **Key Lessons**: 4-5 main takeaways
3. **Chapters**: Create {target_chapters} chapters identifying topic changes, with timestamps evenly distributed throughout

Timeline with timestamps:
{timeline[:3000]}

Transcript excerpt:
{transcript_text[:3000]}

Respond ONLY in this exact JSON format:
{{
  "summary": "Brief 2-3 sentence summary",
  "lessons": ["Lesson 1", "Lesson 2", "Lesson 3", "Lesson 4"],
  "chapters": [
    {{"title": "Introduction", "timestamp": "0:00", "start_time": 0}},
    {{"title": "Topic 2", "timestamp": "2:00", "start_time": 120}},
    {{"title": "Topic 3", "timestamp": "4:00", "start_time": 240}}
  ]
}}"""

        response = await model_router.generate(
            agent_type=AgentType.SUMMARIZE,
            prompt=prompt,
            system_prompt="You are a fast video content analyzer. Identify key sections and insights. Be concise. Return valid JSON only.",
            temperature=0.2,
            max_tokens=2048,
        )
        
        # Parse JSON response with robust error handling
        content = response.content
        content = content.replace("```json", "").replace("```", "").strip()
        
        # Try to extract and parse JSON
        try:
            start = content.find("{")
            end = content.rfind("}") + 1
            
            if start != -1 and end > start:
                json_str = content[start:end]
                # Fix common JSON issues
                json_str = json_str.replace("\n", " ").replace("\r", " ")
                parsed = json.loads(json_str)
                
                # Validate and format chapters
                chapters = []
                for ch in parsed.get("chapters", []):
                    if isinstance(ch, dict) and "title" in ch:
                        chapters.append({
                            "title": ch.get("title", "Section")[:60],
                            "timestamp": ch.get("timestamp", "0:00"),
                            "start_time": ch.get("start_time", 0)
                        })
                
                return {
                    "summary": parsed.get("summary", ""),
                    "lessons": parsed.get("lessons", [])[:5],
                    "chapters": chapters[:20]
                }
        except json.JSONDecodeError:
            # Fallback: extract parts manually using regex
            import re
            
            summary = ""
            lessons = []
            chapters = []
            
            # Try to extract summary - handle incomplete JSON
            summary_match = re.search(r'"summary"\s*:\s*"([^"]*)"?', content)
            if summary_match:
                summary = summary_match.group(1)
            else:
                # Try to find summary value even if incomplete
                summary_match2 = re.search(r'"summary"\s*:\s*"(.{20,500})', content)
                if summary_match2:
                    summary = summary_match2.group(1).rstrip('"').rstrip()
            
            # Try to extract lessons
            lessons_match = re.search(r'"lessons"\s*:\s*\[(.*?)\]', content, re.DOTALL)
            if lessons_match:
                lesson_items = re.findall(r'"([^"]+)"', lessons_match.group(1))
                lessons = lesson_items[:5]
            
            # Try to extract chapters
            chapters_match = re.search(r'"chapters"\s*:\s*\[(.*?)\]', content, re.DOTALL)
            if chapters_match:
                chapter_items = re.findall(r'\{[^}]+\}', chapters_match.group(1))
                for ch_str in chapter_items[:20]:
                    title_match = re.search(r'"title"\s*:\s*"([^"]*)"', ch_str)
                    ts_match = re.search(r'"timestamp"\s*:\s*"([^"]*)"', ch_str)
                    st_match = re.search(r'"start_time"\s*:\s*(\d+)', ch_str)
                    if title_match:
                        chapters.append({
                            "title": title_match.group(1)[:60],
                            "timestamp": ts_match.group(1) if ts_match else "0:00",
                            "start_time": int(st_match.group(1)) if st_match else 0
                        })
            
            if summary or lessons or chapters:
                return {"summary": summary, "lessons": lessons, "chapters": chapters}
        
        # Ultimate fallback - try to clean up any JSON artifacts
        clean_content = content
        if clean_content.startswith('{'):
            # Remove JSON wrapper and extract just the text content
            summary_match = re.search(r'"summary"\s*:\s*"(.+)', clean_content)
            if summary_match:
                clean_content = summary_match.group(1).rstrip('"}').rstrip()
        
        return {"summary": clean_content[:500] if clean_content else "Analysis completed", "lessons": [], "chapters": []}
        
    except Exception as e:
        return {"summary": f"Analysis failed: {str(e)}", "lessons": [], "chapters": []}


@register_function("sign_badge")
async def sign_badge(
    badge_id: str,
    user_id: str,
    achievement: str,
    evidence: list[dict] | None = None
) -> dict[str, Any]:
    """
    Create a cryptographically signed badge claim.
    
    Args:
        badge_id: Unique badge identifier
        user_id: User receiving the badge
        achievement: Description of the achievement
        evidence: Optional evidence supporting the badge
        
    Returns:
        Signed badge claim with verification data
    """
    settings = get_settings()
    
    # Create timestamp
    issued_at = int(time.time())
    
    # Create claim data
    claim_data = f"{badge_id}:{user_id}:{achievement}:{issued_at}"
    
    # Sign with HMAC-SHA256
    signature = hmac.new(
        settings.badge_signing_secret.encode(),
        claim_data.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return {
        "badge_id": badge_id,
        "user_id": user_id,
        "achievement": achievement,
        "issued_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(issued_at)),
        "signed_claim": f"{claim_data}:{signature[:32]}",
        "verify_url": f"/v1/badges/verify/{badge_id}",
        "evidence_count": len(evidence) if evidence else 0
    }


@register_function("append_to_notes")
async def append_to_notes(
    user_id: str,
    lesson_id: str,
    content: str,
    note_type: str = "insight"
) -> dict[str, Any]:
    """
    Append content to user's notes for a lesson.
    
    Args:
        user_id: User ID
        lesson_id: Lesson the notes belong to
        content: Content to append
        note_type: Type of note (summary, question, insight, bookmark)
        
    Returns:
        Status of the operation
    """
    # In production, this would save to Firestore
    # For now, return success with note metadata
    
    note_id = f"note_{int(time.time())}_{user_id[:8]}"
    
    return {
        "status": "success",
        "note_id": note_id,
        "user_id": user_id,
        "lesson_id": lesson_id,
        "note_type": note_type,
        "content_length": len(content),
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }


async def execute_function(name: str, **kwargs) -> FunctionResult:
    """
    Execute a registered function by name.
    
    Args:
        name: Function name
        **kwargs: Function arguments
        
    Returns:
        FunctionResult with status and result/error
    """
    import time as time_module
    start = time_module.time()
    
    if name not in _function_registry:
        return FunctionResult(
            name=name,
            status=FunctionStatus.ERROR,
            result=None,
            error=f"Unknown function: {name}"
        )
    
    try:
        handler = _function_registry[name]
        result = await handler(**kwargs)
        
        return FunctionResult(
            name=name,
            status=FunctionStatus.SUCCESS,
            result=result,
            execution_time_ms=(time_module.time() - start) * 1000
        )
    except Exception as e:
        return FunctionResult(
            name=name,
            status=FunctionStatus.ERROR,
            result=None,
            error=str(e),
            execution_time_ms=(time_module.time() - start) * 1000
        )
