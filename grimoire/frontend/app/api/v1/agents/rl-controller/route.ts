/**
 * POST /api/v1/agents/rl-controller
 * Reinforcement learning controller for adaptive difficulty
 */

import { NextRequest, NextResponse } from 'next/server';
import type { RLControllerRequest, RLControllerResponse } from '@/lib/server/types';
import { getTenantFromRequest } from '@/lib/server/auth';
import { getMockRLSuggestion } from '@/lib/server/mockData';
import logger, { logRequest } from '@/lib/server/logger';

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        // Authenticate request
        const tenant = await getTenantFromRequest(request);

        // Parse request body
        const body: RLControllerRequest = await request.json();
        const { performanceMetrics } = body;

        if (!performanceMetrics || !performanceMetrics.recentScores) {
            return NextResponse.json(
                { error: 'Performance metrics with recentScores are required' },
                { status: 400 }
            );
        }

        logger.info(
            { tenantId: tenant.tenantId, metricsCount: performanceMetrics.recentScores.length },
            'RL controller request received'
        );

        // Check if we're in mock mode
        const useMock = process.env.USE_MOCK === 'true';

        if (useMock) {
            // Get mock RL suggestion based on performance
            const response = getMockRLSuggestion(performanceMetrics);

            const duration = Date.now() - startTime;
            logRequest('/api/v1/agents/rl-controller', 'POST', 200, duration, {
                tenantId: tenant.tenantId,
                difficulty: response.difficulty,
            });

            return NextResponse.json(response, { status: 200 });
        } else {
            // Real mode: proxy to Teaching Assistant backend
            const { backendRequest, BackendAPIError } = await import('@/lib/server/api-client');

            try {
                const backendResponse = await backendRequest<RLControllerResponse>('/v1/agents/rl-controller', {
                    method: 'POST',
                    body: {
                        signals: {
                            recent_quiz_scores: performanceMetrics.recentScores,
                            time_spent: performanceMetrics.timeSpent,
                            attempts: performanceMetrics.attemptsCount,
                        },
                        tenant_id: tenant.tenantId,
                    },
                });

                const duration = Date.now() - startTime;
                logRequest('/api/v1/agents/rl-controller', 'POST', 200, duration, {
                    tenantId: tenant.tenantId,
                    difficulty: backendResponse.difficulty,
                    mock: false,
                });

                return NextResponse.json(backendResponse, { status: 200 });
            } catch (backendErr: any) {
                if (backendErr instanceof BackendAPIError) {
                    const duration = Date.now() - startTime;
                    logRequest('/api/v1/agents/rl-controller', 'POST', backendErr.status, duration, {
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

        logger.error({ err, status }, 'RL controller request failed');
        logRequest('/api/v1/agents/rl-controller', 'POST', status, duration, { error: err.message });

        return NextResponse.json(
            {
                error: err.message || 'Internal server error',
            },
            { status }
        );
    }
}
