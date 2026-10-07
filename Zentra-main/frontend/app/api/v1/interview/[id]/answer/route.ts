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

    const { transcript, confidence } = await request.json();

    if (!transcript || typeof transcript !== 'string') {
        return NextResponse.json({
            error: { message: 'transcript is required', type: 'validation_error' }
        }, { status: 400 });
    }

    // Record the answer
    session.dispatch({ type: 'ANSWER', transcript, confidence });

    // Check if interview should end
    if (session.shouldEndInterview()) {
        session.dispatch({ type: 'COMPLETE' });
        return NextResponse.json({
            status: session.getState(),
            message: 'Interview completed',
            completed: true
        });
    }

    // Generate next question
    const data = session.getSession();


    const mockFollowUps = [
        "Can you walk me through your thought process and any architectural tradeoffs you considered?",
        "How would you optimize this solution for high concurrency or larger data volumes?",
        "Describe a time when you encountered a subtle bug in production. How did you diagnose and resolve it?",
        "How do you ensure testability and maintainability in your code?",
        "Thank you! To wrap up, what questions do you have for the engineering team?"
    ];

    const currentCount = session.getQuestionCount();

    if (process.env.USE_MOCK === 'true') {
        const nextQuestion = mockFollowUps[currentCount % mockFollowUps.length];
        session.dispatch({ type: 'ASK_QUESTION', question: nextQuestion });

        return NextResponse.json({
            status: session.getState(),
            question: nextQuestion,
            question_number: currentCount + 1,
            completed: false
        });
    }

    try {
        const { backendRequest } = await import('@/lib/server/api-client');
        
        const response: any = await backendRequest('/v1/agents/interview/generate-question', {
            method: 'POST',
            body: {
                job_role: data.jobRole,
                skills: data.skills,
                level: data.level,
                candidate_language: data.candidateLanguage,
                messages: session.getConversationHistory()
            }
        });

        const nextQuestion = response?.question || mockFollowUps[currentCount % mockFollowUps.length];

        if (nextQuestion) {
            session.dispatch({ type: 'ASK_QUESTION', question: nextQuestion });
        }

        return NextResponse.json({
            status: session.getState(),
            question: nextQuestion,
            question_number: session.getQuestionCount(),
            completed: false
        });
    } catch (error) {
        console.warn('Backend LLM not available, using mock follow-up question:', error);
        const nextQuestion = mockFollowUps[currentCount % mockFollowUps.length];
        session.dispatch({ type: 'ASK_QUESTION', question: nextQuestion });

        return NextResponse.json({
            status: session.getState(),
            question: nextQuestion,
            question_number: currentCount + 1,
            completed: false
        });
    }
}
