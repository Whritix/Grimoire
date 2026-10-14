import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/interview/stateMachine';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> } // In Next.js 15, params is a Promise
) {
    const { id } = await context.params;
    const session = sessionManager.get(id);

    if (!session) {
        return NextResponse.json({
            error: {
                message: 'Interview session not found',
                type: 'not_found_error',
                code: 'session_not_found'
            }
        }, { status: 404 });
    }

    const data = session.getSession();
    return NextResponse.json({
        id: data.id,
        status: data.state,
        job_role: data.jobRole,
        skills: data.skills,
        level: data.level,
        candidate_language: data.candidateLanguage,
        question_count: session.getQuestionCount(),
        duration_minutes: session.getDurationMinutes(),
        created_at: data.createdAt.toISOString(),
        started_at: data.startedAt?.toISOString(),
        completed_at: data.completedAt?.toISOString()
    });
}
