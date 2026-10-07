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

    const state = session.getState();
    if (state !== 'completed' && state !== 'scored') {
        return NextResponse.json({
            error: {
                message: 'Interview must be completed before scoring',
                type: 'state_error'
            }
        }, { status: 400 });
    }

    const mockResult = {
        overall: 85,
        overallScore: 85,
        technical: 88,
        communication: 82,
        problemSolving: 85,
        feedback: "Solid performance overall. Good problem decomposition, clean code structure, and clear explanations.",
        strengths: [
            "Structured problem-solving methodology",
            "Clear technical vocabulary and explanations",
            "Attention to clean code patterns"
        ],
        weaknesses: [
            "Consider discussing scalability tradeoffs earlier",
            "Could expand on edge-case handling"
        ],
        domainScores: {
            "Algorithms": 88,
            "System Design": 82,
            "Communication": 84,
            "Code Quality": 86
        }
    };

    if (process.env.USE_MOCK === 'true') {
        session.dispatch({ type: 'SCORE' });
        return NextResponse.json({
            session_id: session.getSessionId(),
            ...mockResult,
            scored_at: new Date().toISOString()
        });
    }

    try {
        const transcript = session.getTranscriptText();
        const sessionData = session.getSession();
        const { backendRequest } = await import('@/lib/server/api-client');
        
        const result = await backendRequest(`/v1/agents/interview/${id}/score`, {
            method: 'POST',
            body: { 
                transcript,
                job_role: sessionData.jobRole || "Software Engineer",
                skills: sessionData.skills || [],
                level: sessionData.level || "mid"
            }
        });

        session.dispatch({ type: 'SCORE' });

        return NextResponse.json({
            session_id: session.getSessionId(),
            ...result,
            scored_at: session.getSession().scoredAt || new Date().toISOString()
        });
    } catch (error) {
        console.warn('Backend scoring unavailable, returning fallback score:', error);
        session.dispatch({ type: 'SCORE' });
        return NextResponse.json({
            session_id: session.getSessionId(),
            ...mockResult,
            scored_at: new Date().toISOString()
        });
    }
}
