/**
 * Simple in-memory cache for MVP
 * No Redis dependency - easy to run
 */

import NodeCache from 'node-cache';
import type { CacheEntry } from './types';
import logger from './logger';

// In-memory cache - always used for MVP
const memoryCache = new NodeCache({
    stdTTL: 600, // 10 minutes default
    checkperiod: 120, // Check for expired keys every 2 minutes
    useClones: false,
    maxKeys: 1000, // Limit cache size
});

// Log cache initialization
logger.info('Using in-memory cache (MVP mode)');

/**
 * Get value from cache
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
    try {
        return memoryCache.get<T>(key) || null;
    } catch (err) {
        logger.error({ err, key }, 'Cache get error');
        return null;
    }
}

/**
 * Set value in cache with TTL (in seconds)
 */
export async function cacheSet<T>(key: string, value: T, ttl: number = 600): Promise<void> {
    try {
        memoryCache.set(key, value, ttl);
    } catch (err) {
        logger.error({ err, key }, 'Cache set error');
    }
}

/**
 * Delete value from cache
 */
export async function cacheDel(key: string): Promise<void> {
    try {
        memoryCache.del(key);
    } catch (err) {
        logger.error({ err, key }, 'Cache delete error');
    }
}

/**
 * Check if Redis is available (always false in MVP mode)
 */
export function isRedisAvailable(): boolean {
    return false;
}

/**
 * Flush all cache
 */
export async function cacheFlush(): Promise<void> {
    try {
        memoryCache.flushAll();
        logger.info('Cache flushed');
    } catch (err) {
        logger.error({ err }, 'Cache flush error');
    }
}

/**
 * Get cache stats
 */
export function getCacheStats() {
    return memoryCache.getStats();
}

/**
 * Get Redis client (not available in MVP mode)
 * @deprecated Redis removed for MVP simplicity
 */
export function getRedisClient() {
    return null;
}
