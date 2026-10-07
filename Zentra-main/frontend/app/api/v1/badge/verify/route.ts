/**
 * GET /api/v1/badge/verify
 * Verifies badge signatures
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyBadge } from '@/lib/server/signer';
import { cacheGet } from '@/lib/server/cache';
import logger, { logRequest } from '@/lib/server/logger';

export async function GET(request: NextRequest) {
    const startTime = Date.now();

    try {
        // Get query parameters
        const { searchParams } = new URL(request.url);
        const badgeId = searchParams.get('badgeId');
        const signature = searchParams.get('signature');

        if (!badgeId || !signature) {
            return NextResponse.json(
                { error: 'Both badgeId and signature parameters are required' },
                { status: 400 }
            );
        }

        logger.info({ badgeId }, 'Badge verification request received');

        // Get badge metadata from cache
        const badgeData = await cacheGet<Record<string, unknown>>(`badge:${badgeId}`);

        if (!badgeData) {
            const duration = Date.now() - startTime;
            logRequest('/api/v1/badge/verify', 'GET', 404, duration, { badgeId, found: false });

            return NextResponse.json(
                {
                    valid: false,
                    error: 'Badge not found',
                },
                { status: 404 }
            );
        }

        // Verify signature
        const isValid = verifyBadge(badgeData, signature);

        const duration = Date.now() - startTime;
        logRequest('/api/v1/badge/verify', 'GET', 200, duration, { badgeId, valid: isValid });

        return NextResponse.json(
            {
                valid: isValid,
                badge: isValid ? badgeData : undefined,
            },
            { status: 200 }
        );
    } catch (err: any) {
        const duration = Date.now() - startTime;
        const status = err.status || 500;

        logger.error({ err, status }, 'Badge verification failed');
        logRequest('/api/v1/badge/verify', 'GET', status, duration, { error: err.message });

        return NextResponse.json(
            {
                valid: false,
                error: err.message || 'Internal server error',
            },
            { status }
        );
    }
}
