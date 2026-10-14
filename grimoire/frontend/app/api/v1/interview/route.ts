import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sessionManager } from '@/lib/interview/stateMachine';

const createInterviewSchema = z.object({
    job_role: z.string().min(1),
    skills: z.array(z.string()).min(1),
    level: z.enum(['junior', 'mid', 'senior']).default('mid'),
    candidate_language: z.string().default('en'),
    company_id: z.string().optional()
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsedBody = createInterviewSchema.parse(body);

        const session = sessionManager.create(
            parsedBody.job_role,
            parsedBody.skills,
            parsedBody.level,
            parsedBody.candidate_language,
            undefined, // resumeText handled separately or can be added if needed, but sessionManager supports it. Method signature: resumeText, companyId
            parsedBody.company_id
        );

        return NextResponse.json({
            id: session.getSessionId(),
            status: session.getState(),
            job_role: parsedBody.job_role,
            skills: parsedBody.skills,
            level: parsedBody.level,
            level: parsedBody.level,
            candidate_language: parsedBody.candidate_language,
            company_id: parsedBody.company_id,
            created_at: session.getSession().createdAt.toISOString()
        }, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: {
                    message: 'Invalid request body',
                    type: 'validation_error',
                    details: error.errors
                }
            }, { status: 400 });
        }
        return NextResponse.json({
            error: {
                message: 'Internal server error',
                type: 'server_error',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        }, { status: 500 });
    }
}
