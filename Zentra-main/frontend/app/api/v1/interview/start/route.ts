import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/server/auth';
import logger from '@/lib/server/logger';
import crypto from 'crypto';

const USE_MOCK = process.env.USE_MOCK === 'true';

export async function POST(request: NextRequest) {
    try {
        await getAuthContext(request);

        const body = await request.json();
        const { role, jobDescription, company } = body;

        if (!role || !jobDescription) {
            return NextResponse.json(
                { error: 'role and jobDescription required' },
                { status: 400 }
            );
        }

        if (USE_MOCK) {
            const sessionId = `session_${crypto.randomBytes(8).toString('hex')}`;

            const mockQuestions = [
                {
                    questionId: 'q1',
                    question: `Tell me about yourself and  why you're interested in the ${role} position${company ? ` at ${company}` : ''}.`,
                    type: 'behavioral' as const,
                    difficulty: 'easy' as const,
                    answered: false
                },
                {
                    questionId: 'q2',
                    question: "Describe a challenging technical problem you've solved recently. How did you approach it?",
                    type: 'technical' as const,
                    difficulty: 'medium' as const,
                    answered: false
                },
                {
                    questionId: 'q3',
                    question: "How do you handle disagreements with team members about technical decisions?",
                    type: 'behavioral' as const,
                    difficulty: 'medium' as const,
                    answered: false
                },
                {
                    questionId: 'q4',
                    question: `Based on the job description, can you explain your experience with the key technologies mentioned?`,
                    type: 'technical' as const,
                    difficulty: 'hard' as const,
                    answered: false
                },
                {
                    questionId: 'q5',
                    question: "Where do you see yourself in 5 years, and how does this role fit into your career goals?",
                    type: 'situational' as const,
                    difficulty: 'medium' as const,
                    answered: false
                }
            ];

            const mockSession = {
                sessionId,
                role,
                company,
                jobDescription,
                status: 'active' as const,
                questions: mockQuestions,
                startedAt: Date.now()
            };

            logger.info({ sessionId, role }, 'Interview session started (mock)');
            return NextResponse.json(mockSession);
        }

        return NextResponse.json({ error: 'Real API not implemented yet' }, { status: 501 });

    } catch (err: any) {
        logger.error({ err }, 'Error starting interview');
        return NextResponse.json(
            { error: err.message || 'Internal server error' },
            { status: err.status || 500 }
        );
    }
}
