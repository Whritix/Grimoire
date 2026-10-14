
"""
Podcast Agent Service
"""

import os
import json
import uuid
from io import BytesIO
from pathlib import Path
from typing import List, Dict
from shared.models import get_model_router, AgentType
from services.podcast.prompts import PODCAST_SCRIPT_PROMPT

class PodcastService:
    def __init__(self):
        backend_root = Path(__file__).resolve().parents[2]
        self.output_dir = str(backend_root / "assets" / "podcast_audio")
        os.makedirs(self.output_dir, exist_ok=True)

    def _get_edge_tts(self):
        try:
            import edge_tts
        except ModuleNotFoundError as exc:
            raise ModuleNotFoundError(
                "Podcast generation requires the optional 'edge-tts' package. "
                "Install backend dependencies with 'pip install -r requirements.txt'."
            ) from exc
        return edge_tts

    def _to_web_audio_path(self, absolute_path: str) -> str:
        """Convert an on-disk audio file path to a web path served by FastAPI static files."""
        filename = os.path.basename(absolute_path)
        return f"/assets/podcast_audio/{filename}"

    async def _save_streamed_audio(self, segment_audio_buffers: List[bytes]) -> str:
        """Persist streamed segment bytes as a single MP3 file and return its web path."""
        from pydub import AudioSegment

        if not segment_audio_buffers:
            raise ValueError("No audio segments to save")

        combined_audio = AudioSegment.empty()
        for audio_bytes in segment_audio_buffers:
            segment = AudioSegment.from_file(BytesIO(audio_bytes), format="mp3")
            combined_audio += segment
            combined_audio += AudioSegment.silent(duration=500)

        combined_audio_path = os.path.join(self.output_dir, f"{uuid.uuid4()}.mp3")
        combined_audio.export(combined_audio_path, format="mp3")
        return self._to_web_audio_path(combined_audio_path)

    async def generate_script(self, content: str) -> List[Dict[str, str]]:
        """
        Generates a podcast script from the given content using LLM.
        """
        import re
        
        # Truncate content to avoid token limits (Groq has 8000 TPM limit on free tier)
        # Rough estimate: 1 token ≈ 4 chars, so 2000 chars ≈ 500 tokens
        # Leave room for prompt template and response
        MAX_CONTENT_CHARS = 3000
        truncated_content = content[:MAX_CONTENT_CHARS]
        if len(content) > MAX_CONTENT_CHARS:
            truncated_content += "... [content truncated for brevity]"
            print(f"[PodcastService] Truncated content from {len(content)} to {MAX_CONTENT_CHARS} chars")
        
        prompt = PODCAST_SCRIPT_PROMPT.format(content=truncated_content)

        try:
            router = get_model_router()
            response = await router.generate(
                agent_type=AgentType.PODCAST,
                prompt=prompt,
                temperature=0.7,
                max_tokens=2000
            )
            
            raw_content = response.content
            print(f"[PodcastService] Raw LLM response (first 500 chars): {raw_content[:500]}")
            
            if not raw_content or not raw_content.strip():
                raise ValueError("Empty response from LLM")
            
            # Helper to parse JSON from LLM response if it returns markdown code block
            cleaned_response = raw_content.replace("```json", "").replace("```", "").strip()
            
            # Try direct parse first
            try:
                script = json.loads(cleaned_response)
            except json.JSONDecodeError:
                # Try to extract JSON array from response using regex
                json_match = re.search(r'\[[\s\S]*\]', cleaned_response)
                if json_match:
                    script = json.loads(json_match.group())
                else:
                    # Fallback: create a simple script from the content
                    print(f"[PodcastService] Failed to parse JSON, creating fallback script")
                    script = [
                        {"speaker": "Host 1", "text": f"Today we're discussing some interesting topics."},
                        {"speaker": "Host 2", "text": f"Let me share the key points: {content[:500]}"},
                        {"speaker": "Host 1", "text": "That's really insightful. Thanks for listening!"}
                    ]
            
            if not isinstance(script, list) or len(script) == 0:
                raise ValueError("Script must be a non-empty list")
                
            return script
        except Exception as e:
            print(f"[PodcastService] Error generating script: {e}")
            raise


    async def generate_audio(self, script: List[Dict[str, str]]) -> str:
        """
        Generates audio from the script using edge-tts.
        Returns the path to the generated MP3 file.
        """
        edge_tts = self._get_edge_tts()
        # Voice mapping
        VOICE_HOST_1 = "en-US-GuyNeural"
        VOICE_HOST_2 = "en-US-JennyNeural"

        combined_audio_path = os.path.join(self.output_dir, f"{uuid.uuid4()}.mp3")
        
        # We will generate individual segments and then concatenate them?
        # Creating a single communications list for edge-tts might be complex if we want to stream 
        # or merge strictly.
        # Simplest approach for "free" is to generate separate files and merge, 
        # or use edge-tts communicate feature if supported for multi-voice (it's not natively "dialogue" aware in one call).
        
        # Actually edge-tts is CLI/API for single text. 
        # We will generate N audio files and stitch them using ffmpeg or just file concatenation (MP3s can often be concatenated).
        # Better to use pydub for stitching to ensure headers are correct.
        
        from pydub import AudioSegment
        
        combined_audio = AudioSegment.empty()
        
        temp_files = []
        
        for idx, turn in enumerate(script):
            speaker = turn.get("speaker")
            text = turn.get("text")
            
            voice = VOICE_HOST_1 if speaker == "Host 1" else VOICE_HOST_2
            temp_file = os.path.join(self.output_dir, f"temp_{uuid.uuid4()}_{idx}.mp3")
            
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(temp_file)
            temp_files.append(temp_file)
            
            segment = AudioSegment.from_mp3(temp_file)
            combined_audio += segment
            # Add a small pause
            combined_audio += AudioSegment.silent(duration=500) 

        # Export final
        combined_audio.export(combined_audio_path, format="mp3")
        
        # Cleanup temp
        for f in temp_files:
            try:
                os.remove(f)
            except:
                pass
                
        return combined_audio_path

    async def create_podcast(self, content: str) -> str:
        """
        End-to-end pipeline: Script -> Audio (Batch mode)
        """
        script = await self.generate_script(content)
        audio_path = await self.generate_audio(script)
        return self._to_web_audio_path(audio_path)

    async def generate_audio_stream(self, script: List[Dict[str, str]], host_names: Dict[str, str]):
        """
        Async generator that yields audio segments and raw bytes as they're generated.
        """
        import base64
        edge_tts = self._get_edge_tts()
        
        VOICE_HOST_1 = "en-US-GuyNeural"
        VOICE_HOST_2 = "en-US-JennyNeural"
        
        for idx, turn in enumerate(script):
            speaker = turn.get("speaker", "Host 1")
            text = turn.get("text", "")
            
            if not text.strip():
                continue
            
            # Map speaker to display name
            display_name = host_names.get(speaker, speaker)
            voice = VOICE_HOST_1 if speaker == "Host 1" else VOICE_HOST_2
            
            # Generate audio to memory buffer instead of file
            audio_chunks = []
            communicate = edge_tts.Communicate(text, voice)
            
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_chunks.append(chunk["data"])
            
            # Combine all chunks for this segment
            audio_bytes = b"".join(audio_chunks)
            
            if audio_bytes:
                audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
                yield {
                    "index": idx,
                    "speaker": display_name,
                    "text": text,  # Full text for live transcript
                    "audio_b64": audio_b64,
                    "audio_bytes": audio_bytes,
                }

    async def create_podcast_stream(self, content: str):
        """
        Streaming pipeline: Script -> Stream Audio Segments
        Yields SSE events as each audio segment is generated.
        """
        import random
        
        # Generate random host names
        MALE_NAMES = ["Alex", "Jordan", "Sam", "Chris", "Ryan", "Taylor", "Morgan", "Casey", "Drew", "Jamie"]
        FEMALE_NAMES = ["Maya", "Sophia", "Emma", "Olivia", "Ava", "Isabella", "Mia", "Luna", "Aria", "Chloe"]
        
        host1_name = random.choice(MALE_NAMES)
        host2_name = random.choice(FEMALE_NAMES)
        
        host_names = {
            "Host 1": host1_name,
            "Host 2": host2_name
        }
        
        # First generate the script (this part is not streamed)
        script = await self.generate_script(content)
        
        # Yield script info first with host names
        yield {
            "type": "script_ready",
            "total_segments": len(script),
            "speakers": [host1_name, host2_name],
            "host_names": host_names
        }

        segment_audio_buffers: List[bytes] = []
        
        # Then stream each audio segment
        async for segment in self.generate_audio_stream(script, host_names):
            segment_audio_buffers.append(segment["audio_bytes"])
            yield {
                "type": "segment",
                "index": segment["index"],
                "speaker": segment["speaker"],
                "text": segment["text"],
                "audio": segment["audio_b64"],
            }

        if segment_audio_buffers:
            saved_audio_url = await self._save_streamed_audio(segment_audio_buffers)
            yield {"type": "saved", "audio_url": saved_audio_url}

        yield {"type": "complete", "total_segments": len(script)}
