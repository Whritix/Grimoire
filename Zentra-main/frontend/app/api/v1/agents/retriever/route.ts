/**
 * POST /api/v1/agents/retriever
 * Retrieves curated learning resources based on query
 */

import { NextRequest, NextResponse } from 'next/server';
import type { RetrieverRequest, RetrieverResponse } from '@/lib/server/types';
import { getTenantFromRequest } from '@/lib/server/auth';
import { getMockResources } from '@/lib/server/mockData';

import { cacheGet, cacheSet } from '@/lib/server/cache';
import logger, { logRequest } from '@/lib/server/logger';

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        // Authenticate request
        const tenant = await getTenantFromRequest(request);

        // Parse request body
        const body: RetrieverRequest = await request.json();
        const { query, limit = 10 } = body;

        if (!query || query.trim().length === 0) {
            return NextResponse.json(
                { error: 'Query parameter is required' },
                { status: 400 }
            );
        }

        logger.info({ tenantId: tenant.tenantId, query, limit }, 'Retriever request received');

        // Check cache first
        const cacheKey = `retriever:${query}:${limit}`;
        const cached = await cacheGet<RetrieverResponse>(cacheKey);

        if (cached) {
            logger.info('Returning cached retriever results');
            const duration = Date.now() - startTime;
            logRequest('/api/v1/agents/retriever', 'POST', 200, duration, {
                tenantId: tenant.tenantId,
                cached: true,
            });
            return NextResponse.json(cached, { status: 200 });
        }

        // Check if we're in mock mode
        const useMock = process.env.USE_MOCK === 'true';

        let response: RetrieverResponse;

        if (useMock) {
            // Return mock resources
            response = getMockResources(query, limit);
        } else {
            // Real mode: proxy to Teaching Assistant backend
            const { backendRequest, BackendAPIError } = await import('@/lib/server/api-client');

            try {
                const backendResponse = await backendRequest<RetrieverResponse>('/v1/agents/retriever', {
                    method: 'POST',
                    body: {
                        query,
                        max_results: limit,
                        tenant_id: tenant.tenantId,
                    },
                });

                response = backendResponse;
                const docs = (backendResponse as any)?.agent_output?.payload?.documents || (backendResponse as any)?.payload?.documents || (backendResponse as any)?.documents || [];
                if (docs.length > 0) {
                    (response as any).resources = docs.map((d: any) => ({
                        id: d.id,
                        title: d.title,
                        url: d.url,
                        sourceType: d.source_type || 'youtube',
                        snippet: d.snippet,
                        thumbnail: d.metadata?.thumbnail,
                    }));
                }
            } catch (err) {
                logger.error({ err }, 'Failed to fetch resources from backend, falling back to mock');
                response = getMockResources(query, limit);
            }
        }

        // Cache the results
        await cacheSet(cacheKey, response, 3600); // 1 hour TTL

        const duration = Date.now() - startTime;
        logRequest('/api/v1/agents/retriever', 'POST', 200, duration, {
            tenantId: tenant.tenantId,
            mock: useMock,
            count: response.resources?.length || 0,
        });

        return NextResponse.json(response, { status: 200 });
    } catch (err: any) {
        const duration = Date.now() - startTime;
        const status = err.status || 500;

        logger.error({ err, status }, 'Retriever request failed');
        logRequest('/api/v1/agents/retriever', 'POST', status, duration, { error: err.message });

        return NextResponse.json(
            {
                error: err.message || 'Internal server error',
            },
            { status }
        );
    }
}
