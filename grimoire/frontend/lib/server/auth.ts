/**
 * Authentication and tenant handling middleware
 * Supports API key validation and optional Firebase JWT verification
 */

import type { NextRequest } from 'next/server';
import type { TenantInfo, AuthContext } from './types';
import logger from './logger';
import { cacheGet, cacheSet } from './cache';

// Rate limiting store (in-memory for simplicity)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Extract and validate authorization header
 */
function extractToken(request: NextRequest): string | null {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return null;

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
        return null;
    }

    return parts[1];
}

/**
 * Validate API key (simple validation for development)
 */
async function validateApiKey(apiKey: string): Promise<TenantInfo | null> {
    const validKeys = [
        process.env.BACKEND_API_KEY || 'test-key',
        'test-key', // Always allow test-key in dev
    ];

    if (validKeys.includes(apiKey)) {
        // Return demo tenant for valid API key
        return {
            tenantId: 'demo-tenant',
            plan: 'pro',
            quota: {
                requestsPerHour: 1000,
                requestsUsed: 0,
            },
            metadata: {
                apiKey,
            },
        };
    }

    return null;
}

/**
 * Validate Firebase JWT token (optional)
 * TODO: Implement Firebase Admin SDK verification when credentials are provided
 */
async function validateFirebaseToken(token: string): Promise<TenantInfo | null> {
    // Check if Firebase credentials are configured
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CREDENTIALS_JSON_PATH) {
        logger.debug('Firebase credentials not configured, skipping JWT validation');
        return null;
    }

    // TODO: Implement Firebase Admin SDK verification
    // For now, return null (not implemented)
    logger.warn('Firebase JWT validation not yet implemented');
    return null;
}

/**
 * Get tenant information from request
 * Throws Error with HTTP status code if authentication fails
 */
export async function getTenantFromRequest(request: NextRequest): Promise<TenantInfo> {
    const token = extractToken(request);

    // Development Bypass: If no token and in dev mode, return dev tenant
    if (!token && process.env.NODE_ENV === 'development') {
        return {
            tenantId: 'dev-tenant',
            plan: 'enterprise',
            quota: { requestsPerHour: 10000, requestsUsed: 0 },
            metadata: { isDev: true }
        };
    }

    if (!token) {
        logger.warn('Missing authorization header');
        const error = new Error('Missing authorization header') as Error & { status: number };
        error.status = 401;
        throw error;
    }

    // Try API key validation first
    let tenant = await validateApiKey(token);

    // If not a valid API key, try Firebase JWT
    if (!tenant) {
        tenant = await validateFirebaseToken(token);
    }

    if (!tenant) {
        // In development, if the token is invalid (e.g. it's a Clerk token, not an API key), 
        // fallback to dev tenant to allow the request to proceed if valid user auth exists elsewhere.
        if (process.env.NODE_ENV === 'development') {
            logger.warn('Invalid API key in development, falling back to dev tenant');
            return {
                tenantId: 'dev-tenant',
                plan: 'enterprise',
                quota: { requestsPerHour: 10000, requestsUsed: 0 },
                metadata: { isDev: true }
            };
        }

        logger.warn({ token: token.substring(0, 10) + '...' }, 'Invalid token');
        const error = new Error('Invalid authorization token') as Error & { status: number };
        error.status = 401;
        throw error;
    }

    return tenant;
}

/**
 * Check rate limit for tenant
 * Returns true if rate limit exceeded, false otherwise
 */
export async function checkRateLimit(tenantId: string, limit: number = 100): Promise<boolean> {
    const now = Date.now();
    const windowMs = 60 * 60 * 1000; // 1 hour
    const key = `ratelimit:${tenantId}`;

    // Try to get from cache first
    const cached = await cacheGet<{ count: number; resetAt: number }>(key);
    if (cached) {
        if (now > cached.resetAt) {
            // Window expired, reset
            const newData = { count: 1, resetAt: now + windowMs };
            await cacheSet(key, newData, 3600);
            return false;
        } else {
            // Increment count
            cached.count++;
            await cacheSet(key, cached, Math.ceil((cached.resetAt - now) / 1000));
            return cached.count > limit;
        }
    } else {
        // First request in this window
        const newData = { count: 1, resetAt: now + windowMs };
        await cacheSet(key, newData, 3600);
        return false;
    }
}

/**
 * Get auth context from request (includes tenant and optional user ID)
 */
export async function getAuthContext(request: NextRequest): Promise<AuthContext> {
    const tenant = await getTenantFromRequest(request);

    // Check rate limit
    const rateLimitExceeded = await checkRateLimit(tenant.tenantId, tenant.quota.requestsPerHour);
    if (rateLimitExceeded) {
        logger.warn({ tenantId: tenant.tenantId }, 'Rate limit exceeded');
        const error = new Error('Rate limit exceeded') as Error & { status: number };
        error.status = 429;
        throw error;
    }

    return {
        tenant,
        apiKey: tenant.metadata?.apiKey as string | undefined,
    };
}

/**
 * Middleware helper to extract tenant with error handling
 */
export async function withAuth<T>(
    request: NextRequest,
    handler: (authContext: AuthContext) => Promise<T>
): Promise<T> {
    try {
        const authContext = await getAuthContext(request);
        return await handler(authContext);
    } catch (err) {
        throw err; // Re-throw to be handled by route handler
    }
}
