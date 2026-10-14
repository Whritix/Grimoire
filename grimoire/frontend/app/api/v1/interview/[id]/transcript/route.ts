import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/interview/stateMachine';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;
    const session = sessionManager.get(id);

    if (!session) {
        return NextResponse.json({
            error: { message: 'Interview session not found', type: 'not_found_error' }
        }, { status: 404 });
    }

    return NextResponse.json({
        session_id: session.getSessionId(),
        transcript: session.getTranscript().map(t => ({
            role: t.role,
            content: t.content,
            timestamp: t.timestamp.toISOString()
        }))
    });
}
