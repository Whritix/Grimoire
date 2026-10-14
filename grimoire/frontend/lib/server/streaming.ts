/**
 * SSE (Server-Sent Events) streaming helpers
 * Compatible with Vercel serverless functions
 */

import type { SSEEvent } from './types';
import type { Resource } from '@/lib/types';

/**
 * Format SSE event
 */
export function formatSSEEvent(event: SSEEvent): string {
    return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Create SSE response headers
 */
export function getSSEHeaders(): HeadersInit {
    return {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
    };
}

/**
 * Stream tokens for mock mode
 * Simulates token-by-token streaming with realistic timing
 */
export async function* streamMockTokens(text: string, delayMs: number = 30): AsyncGenerator<SSEEvent> {
    const words = text.split(' ');

    for (const word of words) {
        yield { type: 'token', token: word + ' ' };
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
}

/**
 * Create readable stream for SSE
 */
export function createSSEStream(
    generator: AsyncGenerator<SSEEvent>
): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();

    return new ReadableStream({
        async start(controller) {
            try {
                for await (const event of generator) {
                    const formatted = formatSSEEvent(event);
                    controller.enqueue(encoder.encode(formatted));
                }
                controller.close();
            } catch (err) {
                controller.error(err);
            }
        },
    });
}

/**
 * Mock doubt assistant stream
 */
export async function* mockDoubtAssistantStream(
    query: string
): AsyncGenerator<SSEEvent> {
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Generate mock response based on query
    const responses = [
        'Great question! Let me help you understand this concept.',
        'In simple terms, this works by breaking down the problem into smaller parts.',
        'The key thing to remember is that each component has a specific responsibility.',
        'You can think of it as a pipeline where data flows through different stages.',
        'This approach ensures better maintainability and scalability in the long run.',
    ];

    const response = responses[Math.floor(Math.random() * responses.length)];

    // Stream tokens
    yield* streamMockTokens(response, 40);

    // Send sources
    yield {
        type: 'done',
        sources: [
            {
                url: 'https://developer.mozilla.org/en-US/docs/Web',
                title: 'MDN Web Docs',
                sourceType: 'documentation',
            },
            {
                url: 'https://react.dev/learn',
                title: 'React Documentation',
                sourceType: 'documentation',
            },
        ],
    };
}

/**
 * Generic mock stream for testing
 */
export async function* mockGenericStream(
    text?: string
): AsyncGenerator<SSEEvent> {
    const defaultText = text || 'This is a test stream. Each word is sent as a separate token.';

    yield* streamMockTokens(defaultText, 50);

    yield { type: 'done' };
}
