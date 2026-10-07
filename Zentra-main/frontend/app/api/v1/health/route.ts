/**
 * GET /api/v1/health
 * Health check endpoint with service status
 */

import { NextRequest, NextResponse } from 'next/server';
import type { HealthCheck } from '@/lib/server/types';
import { isRedisAvailable } from '@/lib/server/cache';
import logger from '@/lib/server/logger';

const startTime = Date.now();

export async function GET(request: NextRequest) {
    try {
        const services: HealthCheck['services'] = {};

        // Check Redis if configured
        if (process.env.REDIS_URL) {
            services.redis = isRedisAvailable() ? 'ok' : 'down';
        }

        // Determine overall status
        const hasDownServices = Object.values(services).some((status) => status === 'down');
        const status: HealthCheck['status'] = hasDownServices ? 'degraded' : 'ok';

        const response: HealthCheck = {
            status,
            services,
            timestamp: new Date().toISOString(),
            uptime: Math.floor((Date.now() - startTime) / 1000),
        };

        logger.info({ status, services }, 'Health check performed');

        return NextResponse.json(response, { status: status === 'ok' ? 200 : 503 });
    } catch (err: any) {
        logger.error({ err }, 'Health check failed');

        return NextResponse.json(
            {
                status: 'down',
                error: err.message,
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        );
    }
}
