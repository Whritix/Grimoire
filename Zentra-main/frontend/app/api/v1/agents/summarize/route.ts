/**
 * POST /api/v1/agents/summarize
 * Summarizes text content
 */

import { NextRequest, NextResponse } from 'next/server';
import type { SummarizeRequest, SummarizeResponse } from '@/lib/server/types';
import { getTenantFromRequest } from '@/lib/server/auth';
import logger, { logRequest } from '@/lib/server/logger';

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        // Authenticate request
        const tenant = await getTenantFromRequest(request);

        // Parse request body
        const body: SummarizeRequest = await request.json();
        const { text, length = 'medium' } = body;

        if (!text || text.trim().length === 0) {
            return NextResponse.json(
                { error: 'Text parameter is required' },
                { status: 400 }
            );
        }

        logger.info(
            { tenantId: tenant.tenantId, textLength: text.length, summaryLength: length },
            'Summarize request received'
        );

        // Check if we're in mock mode
        const useMock = process.env.USE_MOCK === 'true';

        if (useMock) {
            // Mock summarization: take first N sentences based on length
            const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
            let summaryLength: number;

            switch (length) {
                case 'short':
                    summaryLength = Math.min(2, sentences.length);
                    break;
                case 'long':
                    summaryLength = Math.min(5, sentences.length);
                    break;
                case 'medium':
                default:
                    summaryLength = Math.min(3, sentences.length);
            }

            const summary = sentences.slice(0, summaryLength).join(' ').trim();

            const response: SummarizeResponse = {
                summary,
                metadata: {
                    originalLength: text.length,
                    summaryLength: summary.length,
                },
            };

            const duration = Date.now() - startTime;
            logRequest('/api/v1/agents/summarize', 'POST', 200, duration, {
                tenantId: tenant.tenantId,
                length,
            });

            return NextResponse.json(response, { status: 200 });
        } else {
            // Real mode: proxy to Teaching Assistant backend
            const { backendRequest, BackendAPIError } = await import('@/lib/server/api-client');

            try {
                const backendResponse = await backendRequest<SummarizeResponse>('/v1/agents/summarize', {
                    method: 'POST',
                    body: {
                        text,
                        max_length: length === 'short' ? 50 : length === 'long' ? 200 : 150,
                        style: 'concise',
                        tenant_id: tenant.tenantId,
                    },
                });

                const duration = Date.now() - startTime;
                logRequest('/api/v1/agents/summarize', 'POST', 200, duration, {
                    tenantId: tenant.tenantId,
                    length,
                    mock: false,
                });

                return NextResponse.json(backendResponse, { status: 200 });
            } catch (backendErr: any) {
                if (backendErr instanceof BackendAPIError) {
                    const duration = Date.now() - startTime;
                    logRequest('/api/v1/agents/summarize', 'POST', backendErr.status, duration, {
                        tenantId: tenant.tenantId,
                        error: backendErr.message,
                    });

                    return NextResponse.json(
                        { error: backendErr.message },
                        { status: backendErr.status }
                    );
                }
                throw backendErr;
            }
        }
    } catch (err: any) {
        const duration = Date.now() - startTime;
        const status = err.status || 500;

        logger.error({ err, status }, 'Summarize request failed');
        logRequest('/api/v1/agents/summarize', 'POST', status, duration, { error: err.message });

        return NextResponse.json(
            {
                error: err.message || 'Internal server error',
            },
            { status }
        );
    }
}
