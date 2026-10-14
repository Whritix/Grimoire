/**
 * POST /api/v1/agents/doubt-assistant
 * Non-streaming doubt resolution endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import type { DoubtAssistantRequest, DoubtAssistantResponse } from '@/lib/server/types';
import { getTenantFromRequest } from '@/lib/server/auth';
import { getMockDoubtResponse } from '@/lib/server/mockData';
import logger, { logRequest } from '@/lib/server/logger';

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        // Authenticate request
        const tenant = await getTenantFromRequest(request);

        // Parse request body
        const body: DoubtAssistantRequest = await request.json();
        const { messages, documents, images, current_lesson, user_id, max_tokens, use_general_knowledge } = body;

        if (!messages || messages.length === 0) {
            return NextResponse.json(
                { error: 'Messages array is required' },
                { status: 400 }
            );
        }

        const lastMessage = messages[messages.length - 1];
        logger.info(
            { tenantId: tenant.tenantId, messageCount: messages.length, use_general_knowledge, has_documents: !!documents, has_images: !!images },
            'Doubt assistant request received'
        );

        // Check if we're in mock mode
        const useMock = process.env.USE_MOCK === 'true';

        if (useMock) {
            // For now, always use mock response
            // In the future, this would integrate with an AI service for RAG-based doubt resolution
            const response = getMockDoubtResponse(lastMessage.content);

            const duration = Date.now() - startTime;
            logRequest('/api/v1/agents/doubt-assistant', 'POST', 200, duration, {
                tenantId: tenant.tenantId,
                mock: true,
            });

            return NextResponse.json(response, { status: 200 });
        } else {
            // Real mode: proxy to Teaching Assistant backend
            const { backendRequest, BackendAPIError } = await import('@/lib/server/api-client');

            try {
                const backendBody: any = {
                    messages,
                    temperature: body.temperature || 0.3,
                    max_tokens: max_tokens || 8192,
                    use_general_knowledge: use_general_knowledge !== undefined ? use_general_knowledge : true,
                };

                if (documents && documents.length > 0) {
                    backendBody.documents = documents;
                }

                if (images && images.length > 0) {
                    backendBody.images = images;
                }

                if (current_lesson) {
                    backendBody.current_lesson = current_lesson;
                }

                backendBody.user_id = user_id || tenant.tenantId || 'default_user';

                if (body.user_profile) {
                    backendBody.user_profile = body.user_profile;
                }


                const backendResponse = await backendRequest<DoubtAssistantResponse>(
                    '/v1/agents/doubt-assistant',
                    {
                        method: 'POST',
                        body: backendBody,
                        timeout: 60000, // Increase timeout to 60s for RAG
                    }
                );

                const duration = Date.now() - startTime;
                logRequest('/api/v1/agents/doubt-assistant', 'POST', 200, duration, {
                    tenantId: tenant.tenantId,
                    mock: false,
                });

                return NextResponse.json(backendResponse, { status: 200 });
            } catch (backendErr: any) {
                if (backendErr instanceof BackendAPIError) {
                    const duration = Date.now() - startTime;
                    logRequest('/api/v1/agents/doubt-assistant', 'POST', backendErr.status, duration, {
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

        logger.error({ err, status }, 'Doubt assistant request failed');
        logRequest('/api/v1/agents/doubt-assistant', 'POST', status, duration, { error: err.message });

        return NextResponse.json(
            {
                error: err.message || 'Internal server error',
            },
            { status }
        );
    }
}
