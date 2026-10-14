/**
 * GET /api/v1/jobs/[id]
 * Gets job status by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/server/auth';
import { getJobStatus } from '@/lib/server/jobs';
import logger, { logRequest } from '@/lib/server/logger';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const startTime = Date.now();

    try {
        // Authenticate request
        const tenant = await getTenantFromRequest(request);

        const { id: jobId } = await params;

        logger.info({ tenantId: tenant.tenantId, jobId }, 'Job status request received');

        // Get job status
        const job = getJobStatus(jobId);

        if (!job) {
            const duration = Date.now() - startTime;
            logRequest(`/api/v1/jobs/${jobId}`, 'GET', 404, duration, { found: false });

            return NextResponse.json(
                { error: 'Job not found' },
                { status: 404 }
            );
        }

        const duration = Date.now() - startTime;
        logRequest(`/api/v1/jobs/${jobId}`, 'GET', 200, duration, {
            tenantId: tenant.tenantId,
            status: job.status,
        });

        return NextResponse.json(job, { status: 200 });
    } catch (err: any) {
        const duration = Date.now() - startTime;
        const status = err.status || 500;

        logger.error({ err, status }, 'Job status request failed');
        logRequest('/api/v1/jobs/[id]', 'GET', status, duration, { error: err.message });

        return NextResponse.json(
            {
                error: err.message || 'Internal server error',
            },
            { status }
        );
    }
}
