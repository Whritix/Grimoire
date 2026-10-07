import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/interview/stateMachine';
import { grokAdapter } from '@/lib/interview/grokAdapter';
import { getInterviewerPrompt } from '@/lib/interview/prompts';

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

    if (!session.dispatch({ type: 'START' })) {
        return NextResponse.json({
            error: {
                message: `Cannot start in state: ${session.getState()}`,
                type: 'state_error'
            }
        }, { status: 400 });
    }

    // Generate first question
    const data = session.getSession();
    const systemPrompt = getInterviewerPrompt({
        jobRole: data.jobRole,
        skills: data.skills,
        level: data.level,
        candidateLanguage: data.candidateLanguage
    });

    session.addSystemMessage(systemPrompt);

    try {
        const firstQuestion = await grokAdapter.generateInterviewQuestion({
            jobRole: data.jobRole,
            skills: data.skills,
            level: data.level,
            candidateLanguage: data.candidateLanguage,
            level: data.level,
            candidateLanguage: data.candidateLanguage,
            messages: [],
            resume_text: data.resumeText,
            company_id: data.companyId
        });

        if (firstQuestion) {
            session.dispatch({ type: 'ASK_QUESTION', question: firstQuestion });
        }

        return NextResponse.json({
            status: session.getState(),
            question: firstQuestion,
            question_number: session.getQuestionCount()
        });
    } catch (error) {
        console.error('LLM Error generating first question:', error);
        return NextResponse.json({
            error: {
                message: 'Failed to generate first question',
                type: 'llm_error',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        }, { status: 500 });
    }
}
