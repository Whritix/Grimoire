/**
 * Job queue abstraction
 * Uses in-memory Map for lightweight job management (suitable for hackathon)
 * Can be extended to use BullMQ + Redis for production
 */

import type { Job } from './types';
import logger from './logger';
import crypto from 'crypto';

// In-memory job store
const jobs = new Map<string, Job>();

/**
 * Create a new job
 */
export function createJob(type: Job['type'], data: Record<string, unknown>): Job {
    const id = crypto.randomBytes(16).toString('hex');
    const now = Date.now();

    const job: Job = {
        id,
        type,
        status: 'pending',
        data,
        createdAt: now,
        updatedAt: now,
    };

    jobs.set(id, job);
    logger.info({ jobId: id, type }, 'Job created');

    // Start processing asynchronously
    processJob(id).catch((err) => {
        logger.error({ err, jobId: id }, 'Job processing error');
    });

    return job;
}

/**
 * Get job status
 */
export function getJobStatus(id: string): Job | null {
    return jobs.get(id) || null;
}

/**
 * Update job
 */
export function updateJob(
    id: string,
    updates: Partial<Pick<Job, 'status' | 'result' | 'error'>>
): void {
    const job = jobs.get(id);
    if (!job) {
        logger.warn({ jobId: id }, 'Job not found for update');
        return;
    }

    Object.assign(job, updates, { updatedAt: Date.now() });
    jobs.set(id, job);
    logger.info({ jobId: id, status: updates.status }, 'Job updated');
}

/**
 * Process job (background worker)
 */
async function processJob(id: string): Promise<void> {
    const job = jobs.get(id);
    if (!job) {
        logger.error({ jobId: id }, 'Job not found for processing');
        return;
    }

    try {
        updateJob(id, { status: 'processing' });

        // Simulate processing based on job type
        await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay

        let result: unknown;

        switch (job.type) {
            case 'pdf':
                result = await generatePDF(job.data);
                break;
            case 'export':
                result = await exportData(job.data);
                break;
            default:
                result = { message: 'Job type not implemented' };
        }

        updateJob(id, { status: 'completed', result });
    } catch (err) {
        logger.error({ err, jobId: id }, 'Job failed');
        updateJob(id, { status: 'failed', error: String(err) });
    }
}

/**
 * Generate PDF (stub for now)
 */
async function generatePDF(data: Record<string, unknown>): Promise<{ pdfUrl: string }> {
    // TODO: Implement actual PDF generation
    // For now, return a mock URL
    logger.info({ data }, 'Generating PDF (mock)');

    return {
        pdfUrl: `/exports/report_${Date.now()}.pdf`,
    };
}

/**
 * Export data (stub for now)
 */
async function exportData(data: Record<string, unknown>): Promise<{ exportUrl: string }> {
    logger.info({ data }, 'Exporting data (mock)');

    return {
        exportUrl: `/exports/data_${Date.now()}.json`,
    };
}

/**
 * Clean up old jobs (call periodically)
 */
export function cleanupOldJobs(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, job] of jobs.entries()) {
        if (now - job.createdAt > maxAgeMs) {
            jobs.delete(id);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        logger.info({ cleaned }, 'Cleaned up old jobs');
    }
}

// Clean up old jobs every hour
setInterval(() => cleanupOldJobs(), 60 * 60 * 1000);
