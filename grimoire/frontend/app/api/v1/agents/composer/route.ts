/**
 * POST /api/v1/agents/composer
 * Composes lesson content from context and metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ComposerRequest, ComposerResponse } from '@/lib/server/types';
import { getTenantFromRequest } from '@/lib/server/auth';
import { getMockLessonContent } from '@/lib/server/mockData';
import logger, { logRequest } from '@/lib/server/logger';

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        // Authenticate request
        const tenant = await getTenantFromRequest(request);

        // Parse request body
        const body: ComposerRequest = await request.json();
        const { contextIds, lessonMeta } = body;

        logger.info(
            { tenantId: tenant.tenantId, lessonTitle: lessonMeta?.title },
            'Composer request received'
        );

        // Check if we're in mock mode
        const useMock = process.env.USE_MOCK === 'true';

        if (useMock) {
            // For now, always use mock mode for composer
            // In the future, this would integrate with an AI service to generate lesson content
            const response = getMockLessonContent(lessonMeta?.title);

            const duration = Date.now() - startTime;
            logRequest('/api/v1/agents/composer', 'POST', 200, duration, {
                tenantId: tenant.tenantId,
                mock: true,
            });

            return NextResponse.json(response, { status: 200 });
        } else {
            // Real mode: proxy to Teaching Assistant backend
            const { backendRequest, BackendAPIError } = await import('@/lib/server/api-client');

            try {
                const backendResponse = await backendRequest<ComposerResponse>('/v1/agents/composer', {
                    method: 'POST',
                    body: {
                        topic: lessonMeta?.title || '',
                        documents: body.documents && body.documents.length > 0 
                            ? body.documents 
                            : (contextIds?.map((id: string) => ({ id, text: '' })) || []),
                        tenant_id: tenant.tenantId,
                        lesson_template: lessonMeta?.context // Pass context as template if needed, or rely on documents
                    },
                });

                const duration = Date.now() - startTime;
                logRequest('/api/v1/agents/composer', 'POST', 200, duration, {
                    tenantId: tenant.tenantId,
                    mock: false,
                });

                return NextResponse.json(backendResponse, { status: 200 });
            } catch (backendErr: any) {
                if (backendErr instanceof BackendAPIError) {
                    const duration = Date.now() - startTime;
                    logRequest('/api/v1/agents/composer', 'POST', backendErr.status, duration, {
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

        logger.error({ err, status }, 'Composer request failed');
        logRequest('/api/v1/agents/composer', 'POST', status, duration, { error: err.message });

        return NextResponse.json(
            {
                error: err.message || 'Internal server error',
            },
            { status }
        );
    }
}
