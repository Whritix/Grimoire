/**
 * POST /api/v1/agents/planner
 * Generates personalized learning roadmap based on user assessment and goals
 */

import { NextRequest, NextResponse } from 'next/server';
import type { PlannerRequest, PlannerResponse } from '@/lib/server/types';
import { getTenantFromRequest } from '@/lib/server/auth';
import { getMockRoadmap } from '@/lib/server/mockData';
import logger, { logRequest } from '@/lib/server/logger';

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        // Authenticate request
        const tenant = await getTenantFromRequest(request);

        // Parse request body
        const body: PlannerRequest = await request.json();
        const { user_goal, availability_hours_per_week, plan_type, time_horizon_weeks, diagnostic_results } = body;

        logger.info({ tenantId: tenant.tenantId, user_goal, plan_type, hours: availability_hours_per_week }, 'Planner request received');

        // Check if we're in mock mode
        const useMock = process.env.USE_MOCK === 'true';

        if (useMock) {
            // Return mock roadmap
            const response = getMockRoadmap(user_goal, diagnostic_results?.score);
            const duration = Date.now() - startTime;

            logRequest('/api/v1/agents/planner', 'POST', 200, duration, {
                tenantId: tenant.tenantId,
                mock: true,
            });

            return NextResponse.json(response, { status: 200 });
        } else {
            // Real mode: proxy to Teaching Assistant backend
            const { backendRequest, BackendAPIError } = await import('@/lib/server/api-client');

            try {
                const backendBody: any = {
                    model: body.model || 'planner-v1',
                    messages: body.messages || [{ role: 'user', content: user_goal || '' }],
                    temperature: body.temperature || 0.0,
                    max_tokens: body.max_tokens || 40000,
                    user_goal: user_goal || '',
                    availability_hours_per_week: availability_hours_per_week || 10,
                    plan_type: plan_type || 'curriculum',
                    time_horizon_weeks: time_horizon_weeks || 12,
                };

                if (diagnostic_results) {
                    backendBody.diagnostic_results = diagnostic_results;
                }

                const backendResponse = await backendRequest<PlannerResponse>('/v1/agents/planner', {
                    method: 'POST',
                    body: backendBody,
                    timeout: 210000, // 3.5 minutes
                });

                const duration = Date.now() - startTime;
                logRequest('/api/v1/agents/planner', 'POST', 200, duration, {
                    tenantId: tenant.tenantId,
                    mock: false,
                });

                return NextResponse.json(backendResponse, { status: 200 });
            } catch (backendErr: any) {
                if (backendErr instanceof BackendAPIError) {
                    const duration = Date.now() - startTime;
                    logRequest('/api/v1/agents/planner', 'POST', backendErr.status, duration, {
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

        logger.error({ err, status }, 'Planner request failed');
        logRequest('/api/v1/agents/planner', 'POST', status, duration, { error: err.message });

        return NextResponse.json(
            {
                error: err.message || 'Internal server error',
            },
            { status }
        );
    }
}
