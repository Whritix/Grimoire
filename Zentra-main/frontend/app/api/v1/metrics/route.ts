/**
 * GET /api/v1/metrics
 * Returns API metrics and request counts
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Metrics } from '@/lib/server/types';
import logger from '@/lib/server/logger';

// Simple in-memory metrics store
const metricsStore = new Map<string, { count: number; success: number; failure: number }>();
const startTime = Date.now();

/**
 * Record a request metric
 */
export function recordMetric(endpoint: string, success: boolean) {
    const current = metricsStore.get(endpoint) || { count: 0, success: 0, failure: 0 };
    current.count++;
    if (success) {
        current.success++;
    } else {
        current.failure++;
    }
    metricsStore.set(endpoint, current);
}

export async function GET(request: NextRequest) {
    try {
        const requests: Record<string, { count: number; success: number; failure: number }> = {};

        // Convert Map to object
        metricsStore.forEach((value, key) => {
            requests[key] = value;
        });

        const response: Metrics = {
            requests,
            uptime: Math.floor((Date.now() - startTime) / 1000),
            timestamp: new Date().toISOString(),
        };

        logger.debug({ metrics: response }, 'Metrics retrieved');

        return NextResponse.json(response, { status: 200 });
    } catch (err: any) {
        logger.error({ err }, 'Metrics retrieval failed');

        return NextResponse.json(
            {
                error: err.message || 'Internal server error',
            },
            { status: 500 }
        );
    }
}
