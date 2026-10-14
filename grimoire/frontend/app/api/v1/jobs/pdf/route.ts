/**
 * POST /api/v1/jobs/pdf
 * Creates background job for PDF generation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/server/auth';
import { createJob } from '@/lib/server/jobs';
import logger, { logRequest } from '@/lib/server/logger';

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        // Authenticate request
        const tenant = await getTenantFromRequest(request);

        // Parse request body
        const body = await request.json();
        const { userId, reportType = 'progress' } = body;

        if (!userId) {
            return NextResponse.json(
                { error: 'userId is required' },
                { status: 400 }
            );
        }

        logger.info({ tenantId: tenant.tenantId, userId, reportType }, 'PDF job creation requested');

        // Create job
        const job = createJob('pdf', { userId, reportType, tenantId: tenant.tenantId });

        const duration = Date.now() - startTime;
        logRequest('/api/v1/jobs/pdf', 'POST', 200, duration, {
            tenantId: tenant.tenantId,
            jobId: job.id,
        });

        return NextResponse.json(
            {
                jobId: job.id,
                status: job.status,
                message: 'PDF generation job created',
            },
            { status: 200 }
        );
    } catch (err: any) {
        const duration = Date.now() - startTime;
        const status = err.status || 500;

        logger.error({ err, status }, 'PDF job creation failed');
        logRequest('/api/v1/jobs/pdf', 'POST', status, duration, { error: err.message });

        return NextResponse.json(
            {
                error: err.message || 'Internal server error',
            },
            { status }
        );
    }
}
