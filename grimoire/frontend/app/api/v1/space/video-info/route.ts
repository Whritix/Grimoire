
import { NextRequest, NextResponse } from 'next/server';
import { backendRequest } from '@/lib/server/api-client';
import { getTenantFromRequest } from '@/lib/server/auth';
import logger, { logRequest } from '@/lib/server/logger';

interface YouTubeOEmbedResponse {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
}

async function fetchYouTubeOEmbed(videoId: string): Promise<YouTubeOEmbedResponse | null> {
    try {
        const videoUrl = encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`);
        const response = await fetch(`https://www.youtube.com/oembed?url=${videoUrl}&format=json`, {
            cache: 'no-store',
        });

        if (!response.ok) {
            return null;
        }

        return await response.json() as YouTubeOEmbedResponse;
    } catch {
        return null;
    }
}

export async function POST(request: NextRequest) {
    const startTime = Date.now();
    try {
        const tenant = await getTenantFromRequest(request);
        const { videoUrl } = await request.json();

        if (!videoUrl) {
            return NextResponse.json({ error: 'Video URL is required' }, { status: 400 });
        }

        // Extract video ID (simple logic, backend does heavy lifting usually)
        let videoId = null;
        const match = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\?\/]+)/);
        if (match) videoId = match[1];

        // Prepare backend request to 'fetch_transcript' function
        // The backend expects: { name: "fetch_transcript", arguments: { video_id: ... } }
        // OR we can use the retriever agent if it supports video lookup. 
        // Based on analysis, 'fetch_transcript' seems best for direct video info.

        let backendResponse;

        // Option 1: Call function directly
        if (videoId) {
            backendResponse = await backendRequest('/v1/functions/execute', {
                method: 'POST',
                body: {
                    name: 'fetch_transcript',
                    arguments: {
                        video_id: videoId
                        // user_id removed as it causes TypeError in backend function
                    }
                },
                timeout: 180000 // Increase timeout to 3 minutes for video analysis
            });
        } else {
            // If no video ID found (e.g. maybe playlist or raw text), fail or try another strategy
            return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
        }

        const duration = Date.now() - startTime;
        logRequest('/api/v1/space/video-info', 'POST', 200, duration, { tenantId: tenant.tenantId });

        // Transform backend response to frontend format
        const res = backendResponse.result;

        const requiresFallback = !res.title || !res.channel || !res.thumbnail_url;
        const oEmbed = requiresFallback && res.video_id
            ? await fetchYouTubeOEmbed(res.video_id)
            : null;

        return NextResponse.json({
            videoId: res.video_id,
            title: res.title || oEmbed?.title || 'Unknown Video',
            description: res.description || '',
            summary: res.summary,
            duration: res.duration_seconds || res.duration || 0,
            thumbnail: res.thumbnail_url || oEmbed?.thumbnail_url || `https://img.youtube.com/vi/${res.video_id}/maxresdefault.jpg`,
            channelName: res.channel || oEmbed?.author_name || 'Unknown Channel',
            uploadDate: res.published_at || new Date().toISOString(),
            transcript: res.text,
            keyTopics: res.lessons || [],
            chapters: res.chapters || []
        });

    } catch (error: any) {
        const status = error.status || 500;
        logger.error({ error, status }, 'Video info request failed');
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
    }
}
