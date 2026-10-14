import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/interview/stateMachine';

export async function POST(
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

    session.dispatch({ type: 'COMPLETE' });

    return NextResponse.json({
        status: session.getState(),
        completed_at: session.getSession().completedAt,
        duration_minutes: session.getDurationMinutes(),
        question_count: session.getQuestionCount()
    });
}
