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

    if (!session.dispatch({ type: 'CONSENT' })) {
        return NextResponse.json({
            error: {
                message: `Cannot consent in state: ${session.getState()}`,
                type: 'state_error'
            }
        }, { status: 400 });
    }

    return NextResponse.json({
        status: session.getState(),
        consented_at: session.getSession().consentedAt
    });
}
