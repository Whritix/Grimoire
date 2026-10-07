"""
Model Router - Routes requests between Gemini (90%) and Local LLM (10%).
Implements fallback logic and caveat flagging.
"""

import json
import httpx
import google.generativeai as genai
from openai import AsyncOpenAI
from enum import Enum
from typing import Any
from dataclasses import dataclass, field
from fastapi import HTTPException

from shared.config import get_settings


class ModelTarget(str, Enum):
    """Target model for routing."""
    GEMINI = "gemini"
    GROQ = "groq"  # Fallback when Gemini fails
    LOCAL_LLM = "local_llm"


class AgentType(str, Enum):
    """Agent types for routing decisions."""
    PLANNER = "planner"
    RETRIEVER = "retriever"
    COMPOSER = "composer"
    ASSESSMENT = "assessment"
    DOUBT = "doubt"
    RL_CONTROLLER = "rl_controller"
    BADGE = "badge"
    SUMMARIZE = "summarize"
    INTERVIEW = "interview"
    PODCAST = "podcast"


# Routing configuration: which agents prefer which model
ROUTING_CONFIG: dict[AgentType, ModelTarget] = {
    AgentType.PLANNER: ModelTarget.GEMINI,
    AgentType.RETRIEVER: ModelTarget.GEMINI,
    AgentType.COMPOSER: ModelTarget.GEMINI,
    AgentType.ASSESSMENT: ModelTarget.GEMINI,
    AgentType.DOUBT: ModelTarget.GEMINI,
    AgentType.RL_CONTROLLER: ModelTarget.GEMINI,
    AgentType.BADGE: ModelTarget.LOCAL_LLM,  # Lightweight validation
    AgentType.SUMMARIZE: ModelTarget.LOCAL_LLM,  # Fast summarization
    AgentType.INTERVIEW: ModelTarget.GROQ, # Interactive latency is critical
    AgentType.PODCAST: ModelTarget.GROQ, # User requested GPT-OSS/Non-Gemini
}


@dataclass
class ModelResponse:
    """Response from model inference."""
    content: str
    model_used: str
    target: ModelTarget
    caveat: bool = False
    caveat_reason: str | None = None
    tokens_used: int = 0
    latency_ms: float = 0.0
    raw_response: dict[str, Any] = field(default_factory=dict)


class ModelRouter:
    """
    Routes AI requests between Gemini, Groq, and Local LLM.
    
    Strategy:
    - 90% of workload goes to Gemini (complex tasks)
    - 10% goes to Local LLM (summarization, lightweight tasks)
    - Fallback to Groq if Gemini fails
    - Fallback to Local LLM if both Gemini and Groq fail
    """

    def __init__(self) -> None:
        self.settings = get_settings()
        self._gemini_configured = False
        self._groq_configured = False
        self._groq_client: AsyncOpenAI | None = None
        self._configure_gemini()
        self._configure_groq()
        
        # Response caching with TTL (for repeated identical prompts)
        self._response_cache: dict[str, tuple[ModelResponse, float]] = {}
        self._cache_ttl = 300  # 5 minutes TTL
        self._max_cache_size = 100  # Max cached responses
        
        self._groq_rate_limited_until: float = 0.0
        
        # Gemini CachedContent cache (reuse across requests)
        self._gemini_caches: dict[str, Any] = {}

    def _configure_gemini(self) -> None:
        """Configure Gemini API client."""
        if self.settings.gemini_api_key:
            # Initialize key index
            self._current_key_index = 0
            # Set initial key
            keys = self.settings.gemini_api_keys
            if keys:
                genai.configure(api_key=keys[0])
            else:
                genai.configure(api_key=self.settings.gemini_api_key)
            self._gemini_configured = True

    def _configure_groq(self) -> None:
        """Configure Groq API client."""
        if self.settings.groq_api_key and self.settings.groq_enabled:
            self._groq_client = AsyncOpenAI(
                api_key=self.settings.groq_api_key,
                base_url="https://api.groq.com/openai/v1",
            )
            self._groq_configured = True
            print("[INFO] Groq API configured as PRIMARY (Gemini as backup on limit)")

    def get_target(self, agent_type: AgentType) -> ModelTarget:
        """
        Determine which model to use.
        - Primary: Groq (if configured and not currently rate-limited)
        - Backup: Gemini (only takes over when Groq limit is reached or Groq fails)
        """
        import time
        now = time.time()
        
        # 1. Primary: Groq
        if self._groq_configured:
            if now >= self._groq_rate_limited_until:
                return ModelTarget.GROQ
            else:
                remaining = int(self._groq_rate_limited_until - now)
                print(f"[INFO] Groq token limit is currently active ({remaining}s remaining). Routing to Gemini backup.")

        # 2. Backup: Gemini (active when Groq limit exceeded)
        if self._gemini_configured:
            return ModelTarget.GEMINI
        
        # 3. Last resort: local LLM
        if self.settings.local_llm_enabled:
            return ModelTarget.LOCAL_LLM
        
        return ModelTarget.GROQ if self._groq_configured else ModelTarget.GEMINI

    async def generate_stream(
        self,
        agent_type: AgentType,
        prompt: str,
        system_prompt: str | None = None,
        images: list[Any] | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        force_target: ModelTarget | None = None,
    ):
        """
        Generate a streaming response using the appropriate model.
        Returns an async generator yielding text chunks.
        """
        # Note: Streaming doesn't use cache easily
        if images and self._gemini_configured and not self._groq_configured:
            target = ModelTarget.GEMINI
        else:
            target = force_target or self.get_target(agent_type)
        
        try:
            if target == ModelTarget.GROQ:
                async for chunk in self._call_groq_stream(prompt, system_prompt, images, temperature, max_tokens):
                    yield chunk
            elif target == ModelTarget.GEMINI:
                async for chunk in self._call_gemini_stream(prompt, system_prompt, images, temperature, max_tokens):
                    yield chunk
            else:
                # Simplified local LLM stream
                async for chunk in self._call_local_llm_stream(prompt, system_prompt, temperature, max_tokens):
                    yield chunk
        except Exception as e:
            err_str = str(e).lower()
            if target == ModelTarget.GROQ and self._gemini_configured:
                import time
                if "429" in err_str or "rate_limit" in err_str or "token" in err_str or "quota" in err_str or "request too large" in err_str:
                    self._groq_rate_limited_until = time.time() + 60.0
                    print(f"[WARN] Groq token limit reached! Cooling down for 60s. Gemini backup taking over stream: {e}")
                else:
                    print(f"[WARN] Groq stream failed, switching to Gemini backup: {e}")
                async for chunk in self._call_gemini_stream(prompt, system_prompt, images, temperature, max_tokens):
                    yield chunk
            else:
                yield f"[Error: {str(e)}]"

    async def generate(
        self,
        agent_type: AgentType,
        prompt: str,
        system_prompt: str | None = None,
        images: list[Any] | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        force_target: ModelTarget | None = None,
        response_format: dict[str, Any] | None = None,
    ) -> ModelResponse:
        """
        Generate a response using the appropriate model.
        
        Priority: Groq (default) -> Gemini (fallback) -> Local LLM (last resort)
        Note: Images require Gemini (Groq doesn't support images well)
        
        Args:
            agent_type: Type of agent making the request
            prompt: User/input prompt
            system_prompt: Optional system instructions
            images: Optional list of images (PIL or bytes)
            temperature: Creativity parameter (0.0-1.0)
            max_tokens: Maximum output tokens
            force_target: Override routing decision
            response_format: Optional format specification (e.g. {"type": "json_object"})
        
        Returns:
            ModelResponse with content and metadata
        """
        import time
        import hashlib
        start_time = time.time()
        
        # Check response cache for identical prompts (skip if images provided)
        if not images and temperature <= 0.3:  # Only cache deterministic requests
            cache_key = hashlib.md5(f"{prompt}:{system_prompt}:{max_tokens}".encode()).hexdigest()
            if cache_key in self._response_cache:
                cached_response, cached_time = self._response_cache[cache_key]
                if (time.time() - cached_time) < self._cache_ttl:
                    cached_response.latency_ms = 0.1  # Indicate cache hit
                    return cached_response
                else:
                    del self._response_cache[cache_key]  # Expired
        else:
            cache_key = None
        
        # Images used to require Gemini, but now Groq supports them too.
        # If Groq is configured, we can use it for images.
        if images and self._gemini_configured and not self._groq_configured:
            target = ModelTarget.GEMINI
        else:
            target = force_target or self.get_target(agent_type)
        
        try:
            # Try primary target
            if target == ModelTarget.GROQ:
                response = await self._call_groq(
                    prompt, system_prompt, images, temperature, max_tokens, response_format
                )
            elif target == ModelTarget.GEMINI:
                response = await self._call_gemini(
                    prompt, system_prompt, images, temperature, max_tokens, response_format
                )
            else:
                response = await self._call_local_llm(
                    prompt, system_prompt, temperature, max_tokens
                )
            
            response.latency_ms = (time.time() - start_time) * 1000
            
            # Store in cache if applicable
            if cache_key:
                # Limit cache size
                if len(self._response_cache) >= self._max_cache_size:
                    # Remove oldest entries
                    oldest_keys = sorted(self._response_cache.keys(), 
                                        key=lambda k: self._response_cache[k][1])[:10]
                    for k in oldest_keys:
                        del self._response_cache[k]
                self._response_cache[cache_key] = (response, time.time())
            
            return response
            
        except Exception as e:
            # Fallback logic: Groq failed -> Try Gemini -> Try Local LLM
            if target == ModelTarget.GROQ:
                err_str = str(e).lower()
                import time
                if "429" in err_str or "rate_limit" in err_str or "token" in err_str or "quota" in err_str or "request too large" in err_str:
                    self._groq_rate_limited_until = time.time() + 60.0
                    print(f"[WARN] Groq token limit reached! Cooling down for 60s. Gemini backup taking over now: {e}")
                else:
                    print(f"[WARN] Groq failed, Gemini backup taking over: {str(e)[:100]}")

                # First try Gemini as fallback
                if self._gemini_configured:
                    try:
                        response = await self._call_gemini(
                            prompt, system_prompt, images, temperature, max_tokens, response_format
                        )
                        response.caveat = True
                        response.caveat_reason = f"Groq limit reached, handled by Gemini backup"
                        response.latency_ms = (time.time() - start_time) * 1000
                        return response
                    except Exception as gemini_error:
                        print(f"[WARN] Gemini backup also failed: {gemini_error}")
                        # Continue to local LLM fallback
                
                # Then try local LLM as last resort
                if self.settings.local_llm_enabled:
                    try:
                        response = await self._call_local_llm(
                            prompt, system_prompt, temperature, max_tokens
                        )
                        response.caveat = True
                        response.caveat_reason = f"Groq and Gemini failed, used local LLM: {str(e)}"
                        response.latency_ms = (time.time() - start_time) * 1000
                        return response
                    except Exception as fallback_error:
                        raise RuntimeError(
                            f"All models failed (Groq, Gemini, Local LLM): {e}, {fallback_error}"
                        )
            
            # Gemini failed -> Try Groq -> Try Local LLM
            elif target == ModelTarget.GEMINI:
                    try:
                        response = await self._call_local_llm(
                            prompt, system_prompt, temperature, max_tokens
                        )
                        response.caveat = True
                        response.caveat_reason = f"Gemini and Groq failed, used local LLM: {str(e)}"
                        response.latency_ms = (time.time() - start_time) * 1000
                        return response
                    except Exception as fallback_error:
                        raise RuntimeError(
                            f"All models failed (Gemini, Groq, Local LLM): {e}, {fallback_error}"
                        )
            raise

    async def _call_gemini(
        self,
        prompt: str,
        system_prompt: str | None,
        images: list[Any] | None,
        temperature: float,
        max_tokens: int,
        response_format: dict[str, Any] | None = None,
    ) -> ModelResponse:
        """Call Gemini API with Caching and Retry Logic."""
        import asyncio
        import google.api_core.exceptions
        
        if not self._gemini_configured:
            raise ValueError("Gemini API key not configured")

        async def _make_request():
             # Caching logic for heavy system prompts
            if system_prompt and len(system_prompt) > 1000:
                import hashlib
                from google.generativeai import caching
                import datetime

                h = hashlib.md5(system_prompt.encode()).hexdigest()
                cache_id = f"sys_{h}"
                
                try:
                    # Try to reuse or create cache
                    cached_content = caching.CachedContent.create(
                        model="models/gemini-flash-latest",
                        display_name=cache_id,
                        system_instruction=system_prompt,
                        contents=[],
                        ttl=datetime.timedelta(minutes=60),
                    )
                    
                    model = genai.GenerativeModel.from_cached_content(cached_content=cached_content)
                    
                    content = [prompt]
                    if images:
                        content.extend(images)

                    response = await model.generate_content_async(
                        content,
                        generation_config=genai.GenerationConfig(
                            temperature=temperature,
                            max_output_tokens=max_tokens,
                            response_mime_type="application/json" if response_format and response_format.get("type") == "json_object" else "text/plain",
                        )
                    )
                    
                    return ModelResponse(
                        content=response.text,
                        model_used="gemini-flash-latest-cached",
                        target=ModelTarget.GEMINI,
                        tokens_used=response.usage_metadata.total_token_count if response.usage_metadata else 0,
                        raw_response={"candidates": len(response.candidates), "cached": True},
                    )
                    
                except Exception:
                    pass # Fallback to standard if cache fails

            # Standard non-cached path
            model = genai.GenerativeModel(
                model_name="gemini-flash-latest",
                system_instruction=system_prompt,
                generation_config=genai.GenerationConfig(
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                    response_mime_type="application/json" if response_format and response_format.get("type") == "json_object" else "text/plain",
                ),
            )
            
            content = [prompt]
            if images:
                content.extend(images)
                
            response = await model.generate_content_async(content)
            
            return ModelResponse(
                content=response.text,
                model_used="gemini-flash-latest",
                target=ModelTarget.GEMINI,
                tokens_used=response.usage_metadata.total_token_count if response.usage_metadata else 0,
                raw_response={"candidates": len(response.candidates) if response.candidates else 0},
            )

        # Key Rotation and Retry Logic
        api_keys = self.settings.gemini_api_keys
        if not api_keys:
             # Should be covered by _gemini_configured but safe fallback
             api_keys = [self.settings.gemini_api_key]

        # Use a localized index to try all keys if needed, starting from current global index
        start_index = getattr(self, '_current_key_index', 0)
        total_keys = len(api_keys)
        
        # Try each key once
        for i in range(total_keys):
            current_index = (start_index + i) % total_keys
            current_key = api_keys[current_index]
            
            # Configure with current key
            genai.configure(api_key=current_key)
            
            # Update global index so next request starts here (load balancing/stickiness)
            self._current_key_index = current_index
            
            try:
                # Try request with simple retry for transient network errors
                for attempt in range(2):
                    try:
                        return await _make_request()
                    except (google.api_core.exceptions.ServiceUnavailable, google.api_core.exceptions.DeadlineExceeded):
                        if attempt == 1: raise # Re-raise to trigger key rotation
                        await asyncio.sleep(1)
            
            except google.api_core.exceptions.ResourceExhausted:
                # Quota exceeded for this key -> Try next key
                print(f"[WARN] Quota exceeded for key ...{current_key[-4:]}. Rotating...")
                continue
                
            except Exception as e:
                # Fatal error for this key, or other API error -> Try next key if looks like auth/permission
                if "403" in str(e) or "API_KEY_INVALID" in str(e):
                     print(f"[WARN] Invalid key ...{current_key[-4:]}. Rotating...")
                     continue
                raise e # Other errors (bad prompt, etc) should fail fast

        raise RuntimeError("All Gemini API keys exhausted or failed.")

    async def _call_gemini_stream(
        self,
        prompt: str,
        system_prompt: str | None,
        images: list[Any] | None,
        temperature: float,
        max_tokens: int,
    ):
        """Streaming generator for Gemini."""
        import google.generativeai as genai
        
        if not self._gemini_configured:
            raise ValueError("Gemini API key not configured")
        
        model = genai.GenerativeModel(
            model_name="gemini-flash-latest",
            system_instruction=system_prompt,
            generation_config=genai.GenerationConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
            ),
        )
        
        content = [prompt]
        if images:
            content.extend(images)
            
        response_stream = await model.generate_content_async(content, stream=True)
        
        async for chunk in response_stream:
            if chunk.text:
                yield chunk.text



    async def _call_groq_stream(
        self,
        prompt: str,
        system_prompt: str | None,
        images: list[Any] | None,
        temperature: float,
        max_tokens: int,
        response_format: dict[str, Any] | None = None,
    ):
        """Streaming generator for Groq."""
        if not self._groq_client:
            raise ValueError("Groq API not configured")
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
            
        model = self.settings.groq_model
        
        # Image logic same as regular call
        if images:
             if "vision" not in model and "llama-3.2" not in model and "llama-4" not in model:
                model = "meta-llama/llama-4-scout-17b-16e-instruct"
             
             content_list = []
             for img_str in images:
                url = img_str if isinstance(img_str, str) and img_str.startswith("data:") else f"data:image/jpeg;base64,{img_str}"
                content_list.append({"type": "image_url", "image_url": {"url": url}})
             content_list.append({"type": "text", "text": prompt})
             messages.append({"role": "user", "content": content_list})
        else:
             messages.append({"role": "user", "content": prompt})

        # Cap max_tokens if qwen is used to prevent the 1000 OTPM rate limit
        if "qwen" in model.lower() and max_tokens > 800:
            max_tokens = 800

        try:
            stream = await self._groq_client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
            )
            
            async for chunk in stream:
                content = chunk.choices[0].delta.content
                if content:
                    yield content
        except Exception as e:
            # If 429 / rate limit or model error, fallback to openai/gpt-oss-20b
            if ("429" in str(e) or "rate_limit" in str(e) or "Request too large" in str(e)) and model != "openai/gpt-oss-20b":
                print(f"[WARN] Groq model {model} rate limited, falling back to openai/gpt-oss-20b...")
                try:
                    fallback_stream = await self._groq_client.chat.completions.create(
                        model="openai/gpt-oss-20b",
                        messages=messages,
                        temperature=temperature,
                        max_tokens=min(max_tokens, 2048),
                        stream=True,
                    )
                    async for chunk in fallback_stream:
                        content = chunk.choices[0].delta.content
                        if content:
                            yield content
                    return
                except Exception as fb_err:
                    raise RuntimeError(f"Groq streaming failed on fallback: {fb_err}")
            raise RuntimeError(f"Groq streaming failed: {e}")

    async def _call_local_llm_stream(
        self,
        prompt: str,
        system_prompt: str | None,
        temperature: float,
        max_tokens: int,
    ):
        """Streaming generator for Local LLM (Ollama)."""
        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        import httpx
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                self.settings.local_llm_endpoint,
                json={
                    "model": self.settings.local_llm_model,
                    "prompt": full_prompt,
                    "stream": True, # ENABLE STREAMING
                    "options": {"temperature": temperature, "num_predict": max_tokens},
                },
            ) as response:
                 async for line in response.aiter_lines():
                     if line:
                        try:
                            # Ollama streams complete JSON objects
                            import json
                            data = json.loads(line)
                            chunk = data.get("response", "")
                            if chunk:
                                yield chunk
                            if data.get("done"):
                                break
                        except:
                            pass

    async def _call_groq(
        self,
        prompt: str,
        system_prompt: str | None,
        images: list[Any] | None,
        temperature: float,
        max_tokens: int,
        response_format: dict[str, Any] | None = None,
    ) -> ModelResponse:
        """Call Groq API (OpenAI-compatible) as fallback."""
        if not self._groq_client:
            raise ValueError("Groq API not configured")
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
            
        # Determine model first to log it correctly
        model = self.settings.groq_model
        
        # Force a vision model if images are present and the current model is not known to be vision-capable
        if images:
                # Use Llama 4 Scout as per Groq documentation (user provided)
                if "vision" not in model and "llama-3.2" not in model and "llama-4" not in model:
                    model = "meta-llama/llama-4-scout-17b-16e-instruct" 

        print(f"DEBUG: Calling Groq with model: {model}")

        if images:
            print("DEBUG: Including images in Groq request")
            # Multimodal request format: Images FIRST, then Text
            content_list = []
            
            for img_str in images:
                if isinstance(img_str, str) and img_str.startswith("data:"):
                    url = img_str
                else:
                    url = f"data:image/jpeg;base64,{img_str}"
                    
                content_list.append({
                    "type": "image_url",
                    "image_url": {
                        "url": url
                    }
                })
            
            # Text prompt comes after images
            content_list.append({"type": "text", "text": prompt})
            messages.append({"role": "user", "content": content_list})
            
            print(f"DEBUG: Message structure: {json.dumps(messages, indent=2)}")
        else:
            # Standard text-only request
            messages.append({"role": "user", "content": prompt})

        # Cap max_tokens if qwen is used to prevent the 1000 OTPM rate limit
        if "qwen" in model.lower() and max_tokens > 800:
            max_tokens = 800

        try:
            # Note: We intentionally DON'T pass response_format to Groq because
            # Groq's JSON mode is unreliable and often fails with json_validate_failed.
            # We handle JSON parsing ourselves in the schema validator.
            response = await self._groq_client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                # response_format intentionally omitted - causes failures with Groq
            )

            content = response.choices[0].message.content or ""
            if not content and hasattr(response.choices[0].message, "reasoning"):
                content = getattr(response.choices[0].message, "reasoning", "") or ""
            tokens_used = response.usage.total_tokens if response.usage else 0
            
            return ModelResponse(
                content=content,
                model_used=f"groq/{model}",
                target=ModelTarget.GROQ,
                tokens_used=tokens_used,
                raw_response={"model": response.model, "id": response.id},
            )
        except Exception as e:
            if ("429" in str(e) or "rate_limit" in str(e) or "Request too large" in str(e)) and model != "openai/gpt-oss-20b":
                print(f"[WARN] Groq model {model} rate limited, falling back to openai/gpt-oss-20b...")
                try:
                    response = await self._groq_client.chat.completions.create(
                        model="openai/gpt-oss-20b",
                        messages=messages,
                        temperature=temperature,
                        max_tokens=min(max_tokens, 2048),
                    )
                    content = response.choices[0].message.content or ""
                    if not content and hasattr(response.choices[0].message, "reasoning"):
                        content = getattr(response.choices[0].message, "reasoning", "") or ""
                    tokens_used = response.usage.total_tokens if response.usage else 0
                    return ModelResponse(
                        content=content,
                        model_used="groq/openai/gpt-oss-20b",
                        target=ModelTarget.GROQ,
                        tokens_used=tokens_used,
                        raw_response={"model": response.model, "id": response.id},
                    )
                except Exception as fb_err:
                    raise RuntimeError(f"Groq API call failed on fallback: {fb_err}")
            raise RuntimeError(f"Groq API call failed: {e}")

    async def _call_local_llm(
        self,
        prompt: str,
        system_prompt: str | None,
        temperature: float,
        max_tokens: int,
    ) -> ModelResponse:
        """Call local LLM (Ollama API)."""
        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                self.settings.local_llm_endpoint,
                json={
                    "model": self.settings.local_llm_model,
                    "prompt": full_prompt,
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens,
                    },
                },
            )
            response.raise_for_status()
            data = response.json()
        
        return ModelResponse(
            content=data.get("response", ""),
            model_used=self.settings.local_llm_model,
            target=ModelTarget.LOCAL_LLM,
            tokens_used=data.get("eval_count", 0),
            raw_response=data,
        )


# Global router instance
_router: ModelRouter | None = None


def get_model_router() -> ModelRouter:
    """Get or create the global model router."""
    global _router
    if _router is None:
        _router = ModelRouter()
    return _router
