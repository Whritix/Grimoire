/**
 * POST /api/v1/agents/badge
 * Creates and signs achievement badges
 */

import { NextRequest, NextResponse } from 'next/server';
import type { BadgeRequest, BadgeResponse } from '@/lib/server/types';
import { getTenantFromRequest } from '@/lib/server/auth';
import { signBadge, generateBadgeId } from '@/lib/server/signer';
import { cacheSet } from '@/lib/server/cache';
import logger, { logRequest } from '@/lib/server/logger';

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        // Authenticate request
        const tenant = await getTenantFromRequest(request);

        // Parse request body
        const body: BadgeRequest = await request.json();
        const { userId, achievement, metadata = {} } = body;

        if (!userId || !achievement) {
            return NextResponse.json(
                { error: 'userId and achievement are required' },
                { status: 400 }
            );
        }

        logger.info({ tenantId: tenant.tenantId, userId, achievement }, 'Badge creation request received');

        // Check if we're in mock mode
        const useMock = process.env.USE_MOCK === 'true';

        if (useMock) {
            // Generate badge ID
            const badgeId = generateBadgeId();

            // Create badge payload
            const badgePayload = {
                badgeId,
                userId,
                achievement,
                timestamp: new Date().toISOString(),
                ...metadata,
            };

            // Sign the badge
            const signature = signBadge(badgePayload);

            // Create badge URL with signature
            const appOrigin = process.env.APP_ORIGIN || 'https://zentra-8kb6.vercel.app';
            const badgeUrl = `${appOrigin}/api/v1/badge/verify?badgeId=${badgeId}&signature=${encodeURIComponent(signature)}`;

            // Store badge metadata in cache (in production, this would go to a database)
            await cacheSet(`badge:${badgeId}`, badgePayload, 86400 * 365); // 1 year

            const response: BadgeResponse = {
                badgeId,
                signature,
                badgeUrl,
                metadata: badgePayload,
            };

            const duration = Date.now() - startTime;
            logRequest('/api/v1/agents/badge', 'POST', 200, duration, {
                tenantId: tenant.tenantId,
                badgeId,
                achievement,
            });

            return NextResponse.json(response, { status: 200 });
        } else {
            // Real mode: proxy to Teaching Assistant backend
            const { backendRequest, BackendAPIError } = await import('@/lib/server/api-client');

            try {
                const backendResponse = await backendRequest<BadgeResponse>('/v1/agents/badge', {
                    method: 'POST',
                    body: {
                        user_id: userId,
                        badge_name: achievement,
                        evidence: metadata,
                        tenant_id: tenant.tenantId,
                    },
                });

                const duration = Date.now() - startTime;
                logRequest('/api/v1/agents/badge', 'POST', 200, duration, {
                    tenantId: tenant.tenantId,
                    badgeId: backendResponse.badgeId,
                    achievement,
                    mock: false,
                });

                return NextResponse.json(backendResponse, { status: 200 });
            } catch (backendErr: any) {
                if (backendErr instanceof BackendAPIError) {
                    const duration = Date.now() - startTime;
                    logRequest('/api/v1/agents/badge', 'POST', backendErr.status, duration, {
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

        logger.error({ err, status }, 'Badge creation failed');
        logRequest('/api/v1/agents/badge', 'POST', status, duration, { error: err.message });

        return NextResponse.json(
            {
                error: err.message || 'Internal server error',
            },
            { status }
        );
    }
}
