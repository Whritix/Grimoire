/**
 * POST /api/v1/agents/assessment/submit
 * Submits assessment results to the backend
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/server/auth';
import logger, { logRequest } from '@/lib/server/logger';
import { backendRequest, BackendAPIError } from '@/lib/server/api-client';

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        // Authenticate request
        const tenant = await getTenantFromRequest(request);

        // Parse request body
        const body = await request.json();

        logger.info({ tenantId: tenant.tenantId, userId: body.user_id }, 'Assessment submission received');

        // Proxy to Teaching Assistant backend
        try {
            const backendResponse = await backendRequest(
                '/v1/agents/assessment/submit',
                {
                    method: 'POST',
                    body: body,
                }
            );

            const duration = Date.now() - startTime;
            logRequest('/api/v1/agents/assessment/submit', 'POST', 200, duration, {
                tenantId: tenant.tenantId,
            });

            return NextResponse.json(backendResponse, { status: 200 });
        } catch (backendErr: any) {
            if (backendErr instanceof BackendAPIError) {
                const duration = Date.now() - startTime;
                logRequest('/api/v1/agents/assessment/submit', 'POST', backendErr.status, duration, {
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

        logger.error({ err, status }, 'Assessment submission failed');
        logRequest('/api/v1/agents/assessment/submit', 'POST', status, duration, { error: err.message });

        return NextResponse.json(
            {
                error: err.message || 'Internal server error',
            },
            { status }
        );
    }
}
