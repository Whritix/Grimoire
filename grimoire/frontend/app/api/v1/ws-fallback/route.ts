/**
 * GET /api/v1/ws-fallback
 * General SSE streaming endpoint for testing
 */

import { NextRequest } from 'next/server';
import { mockGenericStream, getSSEHeaders, createSSEStream } from '@/lib/server/streaming';
import logger, { logRequest } from '@/lib/server/logger';

export async function GET(request: NextRequest) {
    const startTime = Date.now();

    try {
        // Get query parameters
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q') || 'Default streaming test message';

        logger.info({ query }, 'WS fallback stream request received');

        // Create SSE stream
        const generator = mockGenericStream(query);
        const stream = createSSEStream(generator);

        const duration = Date.now() - startTime;
        logRequest('/api/v1/ws-fallback', 'GET', 200, duration, { streaming: true });

        return new Response(stream, {
            status: 200,
            headers: getSSEHeaders(),
        });
    } catch (err: any) {
        const duration = Date.now() - startTime;
        const status = err.status || 500;

        logger.error({ err, status }, 'WS fallback stream failed');
        logRequest('/api/v1/ws-fallback', 'GET', status, duration, { error: err.message });

        return new Response(
            JSON.stringify({ error: err.message || 'Internal server error' }),
            {
                status,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
}
