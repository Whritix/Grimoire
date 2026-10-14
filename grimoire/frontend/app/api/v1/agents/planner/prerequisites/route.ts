/**
 * POST /api/v1/agents/planner/prerequisites
 * Proxies prerequisite generation requests to the backend
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/server/auth';
import logger, { logRequest } from '@/lib/server/logger';

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        // Authenticate request
        const tenant = await getTenantFromRequest(request);
        const body = await request.json();

        logger.info({ tenantId: tenant.tenantId, topic: body.topic }, 'Prerequisites request received');

        // Real mode: proxy to Teaching Assistant backend
        const { backendRequest, BackendAPIError } = await import('@/lib/server/api-client');

        try {
            const backendResponse = await backendRequest<any>('/v1/agents/planner/prerequisites', {
                method: 'POST',
                body: body,
                timeout: 30000,
            });

            const duration = Date.now() - startTime;
            logRequest('/api/v1/agents/planner/prerequisites', 'POST', 200, duration, {
                tenantId: tenant.tenantId,
            });

            return NextResponse.json(backendResponse, { status: 200 });

        } catch (backendErr: any) {
            if (backendErr instanceof BackendAPIError) {
                const duration = Date.now() - startTime;
                logRequest('/api/v1/agents/planner/prerequisites', 'POST', backendErr.status, duration, {
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

    } catch (err: any) {
        const duration = Date.now() - startTime;
        const status = err.status || 500;

        logger.error({ err, status }, 'Prerequisites request failed');
        logRequest('/api/v1/agents/planner/prerequisites', 'POST', status, duration, { error: err.message });

        return NextResponse.json(
            {
                error: err.message || 'Internal server error',
            },
            { status }
        );
    }
}
