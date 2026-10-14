/**
 * API Client for Teaching Assistant Python Backend
 * Handles all communication with the FastAPI backend on port 8000
 */

import logger from './logger';

const BACKEND_URL = process.env.TEACHING_ASSISTANT_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const BACKEND_API_KEY = process.env.TEACHING_ASSISTANT_API_KEY || 'test-key';

export interface BackendRequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: any;
    headers?: Record<string, string>;
    timeout?: number;
}

export class BackendAPIError extends Error {
    constructor(
        message: string,
        public status: number,
        public response?: any
    ) {
        super(message);
        this.name = 'BackendAPIError';
    }
}

/**
 * Make a request to the Teaching Assistant backend
 */
export async function backendRequest<T = any>(
    endpoint: string,
    options: BackendRequestOptions = {}
): Promise<T> {
    const { method = 'POST', body, headers = {}, timeout = 30000 } = options;

    const baseUrl = BACKEND_URL.replace(/\/$/, '');
    const cleanEndpoint = endpoint.replace(/^\/+/, '');
    const url = `${baseUrl}/${cleanEndpoint}`;

    const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BACKEND_API_KEY}`,
        ...headers,
    };

    logger.debug({ url, method }, 'Making backend request');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            method,
            headers: requestHeaders,
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const responseData = await response.json();

        if (!response.ok) {
            logger.error(
                { status: response.status, url, responseData },
                'Backend request failed'
            );
            throw new BackendAPIError(
                responseData.error || responseData.detail || 'Backend request failed',
                response.status,
                responseData
            );
        }

        logger.debug({ url, status: response.status }, 'Backend request succeeded');
        return responseData as T;
    } catch (err: any) {
        clearTimeout(timeoutId);

        if (err.name === 'AbortError') {
            logger.error({ url, timeout }, 'Backend request timeout');
            throw new BackendAPIError('Request timeout', 408);
        }

        if (err instanceof BackendAPIError) {
            throw err;
        }

        logger.error({ err, url }, 'Backend request error');
        throw new BackendAPIError(
            err.message || 'Failed to connect to backend',
            500
        );
    }
}

/**
 * Streaming request to the Teaching Assistant backend
 * Returns a ReadableStream for SSE/streaming responses
 */
export async function backendStreamRequest(
    endpoint: string,
    body: any
): Promise<ReadableStream> {
    const baseUrl = BACKEND_URL.replace(/\/$/, '');
    const cleanEndpoint = endpoint.replace(/^\/+/, '');
    const url = `${baseUrl}/${cleanEndpoint}`;

    const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BACKEND_API_KEY}`,
    };

    logger.debug({ url }, 'Making streaming backend request');

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new BackendAPIError(
                errorData.error || errorData.detail || 'Streaming request failed',
                response.status,
                errorData
            );
        }

        if (!response.body) {
            throw new BackendAPIError('No response body for streaming request', 500);
        }

        logger.debug({ url }, 'Streaming backend request initiated');
        return response.body;
    } catch (err: any) {
        if (err instanceof BackendAPIError) {
            throw err;
        }

        logger.error({ err, url }, 'Streaming backend request error');
        throw new BackendAPIError(
            err.message || 'Failed to establish streaming connection',
            500
        );
    }
}

/**
 * Health check for the Teaching Assistant backend
 */
export async function checkBackendHealth(): Promise<boolean> {
    try {
        const response = await backendRequest('/v1/agents/health', {
            method: 'GET',
            timeout: 5000,
        });
        logger.info({ response }, 'Backend health check passed');
        return response.status === 'ok' || response.status === 'healthy';
    } catch (err) {
        logger.warn({ err }, 'Backend health check failed');
        return false;
    }
}
