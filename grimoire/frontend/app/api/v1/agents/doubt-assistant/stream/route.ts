/**
 * POST /api/v1/agents/doubt-assistant/stream
 * Proxy streaming endpoint to backend doubt-assistant/stream
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';

const BACKEND_URL = process.env.TEACHING_ASSISTANT_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export async function POST(request: NextRequest) {
    try {
        // Get user authentication
        const { userId } = await auth();
        
        if (!userId) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Parse request body
        const body = await request.json();
        
        // Ensure user_id is set
        body.user_id = body.user_id || userId;

        // If mock mode is active, stream mock response
        const lastMsg = body.messages?.[body.messages.length - 1]?.content || body.query || 'your question';
        if (process.env.USE_MOCK === 'true') {
            return new Response(createMockStream(lastMsg), {
                status: 200,
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            });
        }

        // Proxy to backend streaming endpoint
        try {
            const backendResponse = await fetch(`${BACKEND_URL}/v1/agents/doubt-assistant/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.TEACHING_ASSISTANT_API_KEY || process.env.BACKEND_API_KEY || 'test-key'}`,
                },
                body: JSON.stringify(body),
            });

            if (backendResponse.ok && backendResponse.body) {
                return new Response(backendResponse.body, {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/plain; charset=utf-8',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                    },
                });
            }
        } catch (fetchErr) {
            console.warn('Backend streaming unreachable, falling back to mock stream:', fetchErr);
        }

        // Fallback stream
        return new Response(createMockStream(lastMsg), {
            status: 200,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (err: any) {
        console.error('Stream proxy error:', err);
        return new Response(createMockStream('your question'), {
            status: 200,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
            },
        });
    }
}

function createMockStream(query: string) {
    const text = `Great question regarding "${query}"!\n\nHere is what you need to know:\n\n1. **Core Concept**: Understanding how this integrates into your application architecture is essential for building scalable solutions.\n2. **Best Practices**: Keep components modular, enforce strict type safety, and decouple data fetching from presentation logic.\n3. **Practical Application**: In enterprise projects, always ensure observability, robust unit testing, and graceful error handling.\n\nFeel free to ask for a code sample or further clarification!`;

    const encoder = new TextEncoder();
    return new ReadableStream({
        async start(controller) {
            const words = text.split(" ");
            for (const word of words) {
                controller.enqueue(encoder.encode(word + " "));
                await new Promise((resolve) => setTimeout(resolve, 25));
            }
            controller.close();
        },
    });
}
