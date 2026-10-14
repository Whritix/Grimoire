
import { NextRequest, NextResponse } from 'next/server';
import { backendRequest } from '@/lib/server/api-client';
import { getTenantFromRequest } from '@/lib/server/auth';
import logger, { logRequest } from '@/lib/server/logger';

export async function POST(request: NextRequest) {
    const startTime = Date.now();
    try {
        // Validate API key authentication
        const tenant = await getTenantFromRequest(request);
        const body = await request.json();
        const { message, videoContext, currentTimestamp, sessionId } = body;

        // Construct DoubtRequest for backend
        const backendBody = {
            messages: [
                { role: 'user', content: message }
            ],
            // We can pass video context as a "document" or pre-prompt info
            documents: videoContext ? [{
                id: 'video_context',
                title: 'Current Video Context',
                text: `Video Title: ${videoContext}\nCurrent Timestamp: ${currentTimestamp}s`
            }] : [],
            user_id: sessionId || 'anonymous',
            model: 'doubt-v1',
            use_general_knowledge: true
        };

        const backendResponse: any = await backendRequest('/v1/agents/doubt-assistant', {
            method: 'POST',
            body: backendBody,
            timeout: 60000 // Increase timeout to 1 minute for chat
        });

        const duration = Date.now() - startTime;
        logRequest('/api/v1/space/chat', 'POST', 200, duration, { tenantId: tenant.tenantId });

        // Backend response wrapper: { agent_output: { payload: { answer: "...", ... } } }

        // Correctly extract answer from nested structure
        const payload = backendResponse.agent_output?.payload || backendResponse.payload || {};
        const answer = payload.answer ||
            backendResponse.choices?.[0]?.message?.content ||
            "I couldn't generate a response.";

        const nextTopics = payload.next_topics || [];

        return NextResponse.json({
            reply: answer,
            relevantTimestamps: [], // Parse from answer if needed
            suggestions: nextTopics
        });

    } catch (error: any) {
        const status = error.status || 500;
        logger.error({ error, status }, 'Chat request failed');
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
    }
}
