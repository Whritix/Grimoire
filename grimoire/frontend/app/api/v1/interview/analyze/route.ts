import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/server/auth';
import logger from '@/lib/server/logger';

const USE_MOCK = process.env.USE_MOCK === 'true';

export async function POST(request: NextRequest) {
    try {
        await getAuthContext(request);

        const body = await request.json();
        const { sessionId, transcript, videoAnalysis } = body;

        if (!sessionId) {
            return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
        }

        if (USE_MOCK) {
            // Generate realistic mock feedback
            const mockFeedback = {
                sessionId,
                overallScore: Math.floor(Math.random() * 20) + 75, // 75-95
                feedback: {
                    communication: {
                        score: Math.floor(Math.random() * 15) + 80,
                        comments: "Clear articulation and structured responses. Good use of examples to illustrate points. Maintained professional tone throughout."
                    },
                    technical: {
                        score: Math.floor(Math.random() * 20) + 70,
                        comments: "Demonstrated solid understanding of core concepts. Provided specific technical details when discussing past projects."
                    },
                    confidence: {
                        score: Math.floor(Math.random() * 15) + 75,
                        comments: "Confident delivery with good eye contact. Minimal filler words. Could improve by taking brief pauses before answering complex questions."
                    },
                    problemSolving: {
                        score: Math.floor(Math.random() * 20) + 70,
                        comments: "Good analytical approach to problem-solving questions. Showed systematic thinking and consideration of trade-offs."
                    }
                },
                strengths: [
                    "Excellent communication skills with clear, structured answers",
                    "Strong technical knowledge and practical experience",
                    "Good use of STAR method in behavioral questions",
                    "Maintained enthusiasm and positive attitude throughout",
                    "Demonstrated cultural fit with company values"
                ],
                improvements: [
                    "Provide more specific metrics when discussing achievements",
                    "Ask more clarifying questions before diving into answers",
                    "Expand on leadership experiences with concrete examples",
                    "Practice answering technical questions within time constraints",
                    "Research company's recent projects to show deeper interest"
                ]
            };

            logger.info({ sessionId }, 'Interview analyzed (mock)');
            return NextResponse.json(mockFeedback);
        }

        return NextResponse.json({ error: 'Real API not implemented yet' }, { status: 501 });

    } catch (err: any) {
        logger.error({ err }, 'Error analyzing interview');
        return NextResponse.json(
            { error: err.message || 'Internal server error' },
            { status: err.status || 500 }
        );
    }
}
