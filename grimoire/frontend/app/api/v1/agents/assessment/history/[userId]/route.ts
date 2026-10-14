/**
 * GET /api/v1/agents/assessment/history/[userId]
 * Gets assessment history for a user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/server/auth';
import logger, { logRequest } from '@/lib/server/logger';
import { backendRequest, BackendAPIError } from '@/lib/server/api-client';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const startTime = Date.now();
    const { userId } = await params;

    try {
        // Authenticate request
        const tenant = await getTenantFromRequest(request);

        // Check if DB access is available
        const { db } = await import('@/lib/server/firebase');

        if (db) {
            try {
                // Direct DB access: collections 'assessments', filtered by 'user_id'
                // Note: orderBy requires composite index, sorting in-memory instead
                const snapshot = await db.collection('assessments')
                    .where('user_id', '==', userId)
                    .limit(20)
                    .get();

                const history = snapshot.docs
                    .map(doc => doc.data())
                    .sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));

                const duration = Date.now() - startTime;
                logRequest(`/api/v1/agents/assessment/history/${userId}`, 'GET (DB)', 200, duration, { tenantId: tenant.tenantId });
                return NextResponse.json({ history }, { status: 200 });

            } catch (dbError) {
                console.error('Firestore assessment fetch failed:', dbError);
                // Fallthrough to backend
            }
        }

        // Proxy to Teaching Assistant backend
        try {
            const backendResponse = await backendRequest(
                `/v1/agents/assessment/history/${userId}`,
                {
                    method: 'GET',
                }
            );

            const duration = Date.now() - startTime;
            logRequest(`/api/v1/agents/assessment/history/${userId}`, 'GET', 200, duration, {
                tenantId: tenant.tenantId,
            });

            return NextResponse.json(backendResponse, { status: 200 });
        } catch (backendErr: any) {
            if (backendErr instanceof BackendAPIError) {
                const duration = Date.now() - startTime;
                logRequest(`/api/v1/agents/assessment/history/${userId}`, 'GET', backendErr.status, duration, {
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

        logger.error({ err, status }, 'Assessment history fetch failed');
        logRequest(`/api/v1/agents/assessment/history/${userId}`, 'GET', status, duration, { error: err.message });

        return NextResponse.json(
            {
                error: err.message || 'Internal server error',
            },
            { status }
        );
    }
}
