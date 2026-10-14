/**
 * Structured logging utility using Pino
 * Logs in JSON format for production, pretty-print for development
 */

import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

// Create logger instance
export const logger = pino({
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname',
            },
        }
        : undefined,
    base: {
        env: process.env.NODE_ENV || 'development',
    },
});

/**
 * Create a child logger with additional context
 */
export function createRequestLogger(context: {
    requestId: string;
    endpoint: string;
    tenantId?: string;
    userId?: string;
}) {
    return logger.child(context);
}

/**
 * Log API request with timing
 */
export function logRequest(
    endpoint: string,
    method: string,
    statusCode: number,
    durationMs: number,
    meta?: Record<string, unknown>
) {
    const logData = {
        endpoint,
        method,
        statusCode,
        durationMs,
        ...meta,
    };

    if (statusCode >= 500) {
        logger.error(logData, 'API request failed');
    } else if (statusCode >= 400) {
        logger.warn(logData, 'API request error');
    } else {
        logger.info(logData, 'API request completed');
    }
}

/**
 * Log external API call
 */
export function logExternalCall(
    service: string,
    endpoint: string,
    durationMs: number,
    success: boolean,
    meta?: Record<string, unknown>
) {
    const logData = {
        service,
        endpoint,
        durationMs,
        success,
        ...meta,
    };

    if (success) {
        logger.info(logData, 'External API call completed');
    } else {
        logger.error(logData, 'External API call failed');
    }
}

export default logger;
