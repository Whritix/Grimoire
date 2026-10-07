/**
 * GET /api/v1/proxy/youtube
 * Server-side proxy for YouTube Data API
 */

import { NextRequest, NextResponse } from 'next/server';
import type { YouTubeProxyResponse } from '@/lib/server/types';
import { getTenantFromRequest } from '@/lib/server/auth';

import logger, { logRequest } from '@/lib/server/logger';

export async function GET(request: NextRequest) {
    const startTime = Date.now();

    try {
        // Authenticate request
        const tenant = await getTenantFromRequest(request);

        // Get query parameters
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');
        const limitParam = searchParams.get('limit');
        const limit = limitParam ? parseInt(limitParam, 10) : 10;

        if (!query || query.trim().length === 0) {
            return NextResponse.json(
                { error: 'Query parameter "q" is required' },
                { status: 400 }
            );
        }

        logger.info({ tenantId: tenant.tenantId, query, limit }, 'YouTube proxy request received');

        // Call YouTube client (handles mock mode automatically)
        // Call backend retriever instead of local youtube client
        const { backendRequest } = await import('@/lib/server/api-client');
        
        // We use the retriever to get youtube results
        // Use any to avoid type mismatch with frontend/backend types
        const backendResponse = await backendRequest<any>('/v1/agents/retriever', {
            method: 'POST',
            body: { 
                query, 
                max_results: limit, 
            }
        });

        // Map documents to YouTubeVideo
        const videos = (backendResponse.documents || [])
            .filter((doc: any) => doc.source_type === 'youtube')
            .map((doc: any) => ({
                id: doc.id.replace('yt_', ''),
                title: doc.title,
                channelTitle: doc.metadata?.channel_title || 'YouTube',
                duration: typeof doc.duration === 'number' ? `PT${Math.floor(doc.duration/60)}M${doc.duration%60}S` : 'PT0M0S',
                thumbnail: doc.metadata?.thumbnail || `https://i.ytimg.com/vi/${doc.id.replace('yt_', '')}/mqdefault.jpg`,
                url: doc.url,
            }));

        const response: YouTubeProxyResponse = {
            videos,
            metadata: {
                query,
                totalResults: videos.length,
            },
        };

        const duration = Date.now() - startTime;
        logRequest('/api/v1/proxy/youtube', 'GET', 200, duration, {
            tenantId: tenant.tenantId,
            count: videos.length,
        });

        return NextResponse.json(response, { status: 200 });
    } catch (err: any) {
        const duration = Date.now() - startTime;
        const status = err.status || 500;

        logger.error({ err, status }, 'YouTube proxy request failed');
        logRequest('/api/v1/proxy/youtube', 'GET', status, duration, { error: err.message });

        return NextResponse.json(
            {
                error: err.message || 'Internal server error',
            },
            { status }
        );
    }
}
