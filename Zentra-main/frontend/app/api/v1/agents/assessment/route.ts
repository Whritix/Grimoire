/**
 * POST /api/v1/agents/assessment
 * Generates assessment questions or grades answers
 */

import { NextRequest, NextResponse } from 'next/server';
import type {
    AssessmentRequest,
    AssessmentGenerateResponse,
    AssessmentGradeResponse,
} from '@/lib/server/types';
import { getTenantFromRequest } from '@/lib/server/auth';
import { getMockAssessmentQuestions, getMockAssessmentGrade } from '@/lib/server/mockData';
import logger, { logRequest } from '@/lib/server/logger';

import { backendRequest, BackendAPIError } from '@/lib/server/api-client';

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        // Authenticate request
        const tenant = await getTenantFromRequest(request);

        // Parse request body
        const body: AssessmentRequest = await request.json();
        const { mode, lesson_content, question_count, difficulty_level, question_text, correct_answer, user_answer, rubric, difficulty_distribution, answers, topic, difficulty, mcq_only, is_assignment } = body as any;

        if (!mode || !['generate', 'grade', 'flashcards'].includes(mode)) {
            return NextResponse.json(
                { error: 'Mode must be "generate", "grade", or "flashcards"' },
                { status: 400 }
            );
        }

        logger.info({ tenantId: tenant.tenantId, mode, difficulty_level, lesson_content: lesson_content?.substring(0, 50) }, 'Assessment request received');

        // Check if we're in mock mode
        const useMock = process.env.USE_MOCK === 'true';

        let response: AssessmentGenerateResponse | AssessmentGradeResponse;

        const actualTopic = topic || lesson_content || 'General';
        const rawDiff = String(difficulty || difficulty_level || 'medium').toLowerCase();
        const actualDifficulty: 'easy' | 'medium' | 'hard' = 
            rawDiff.includes('beg') || rawDiff.includes('easy') ? 'easy' :
            rawDiff.includes('adv') || rawDiff.includes('hard') ? 'hard' : 'medium';

        const numQuestions = parseInt(String(question_count || 5), 10) || 5;

        if (useMock) {
            if (mode === 'generate' || mode === 'flashcards') {
                // Generate assessment questions
                response = getMockAssessmentQuestions(actualDifficulty, actualTopic, numQuestions);
            } else {
                // Grade assessment
                if (!answers || answers.length === 0) {
                    return NextResponse.json(
                        { error: 'Answers are required for grading mode' },
                        { status: 400 }
                    );
                }
                response = getMockAssessmentGrade(answers);
            }

            const duration = Date.now() - startTime;
            logRequest('/api/v1/agents/assessment', 'POST', 200, duration, {
                tenantId: tenant.tenantId,
                mode,
                mock: true,
            });

            return NextResponse.json(response, { status: 200 });
        } else {
            // Real mode: proxy to Teaching Assistant backend

            try {
                // Build request body matching backend Pydantic schemas
                const backendBody: any = {
                    mode,
                    model: body.model || 'assessment-v1',
                    temperature: body.temperature || 0.3,
                    max_tokens: body.max_tokens || 4096,
                };

                if (mode === 'generate' || mode === 'flashcards') {
                    backendBody.lesson_content = lesson_content || '';
                    backendBody.question_count = question_count || 5;
                    backendBody.difficulty_level = difficulty_level || 'Intermediate';
                    if (body.difficulty_distribution) {
                        backendBody.difficulty_distribution = body.difficulty_distribution;
                    }
                    // Pass mcq_only and is_assignment flags
                    if (mcq_only !== undefined) {
                        backendBody.mcq_only = mcq_only;
                    }
                    if (is_assignment !== undefined) {
                        backendBody.is_assignment = is_assignment;
                    }
                } else if (mode === 'grade') {
                    backendBody.question_text = question_text || '';
                    backendBody.correct_answer = correct_answer || '';
                    backendBody.user_answer = user_answer || '';
                    backendBody.rubric = rubric || '';
                }

                const backendResponse = await backendRequest<AssessmentGenerateResponse | AssessmentGradeResponse>(
                    '/v1/agents/assessment',
                    {
                        method: 'POST',
                        body: backendBody,
                    }
                );

                const duration = Date.now() - startTime;
                logRequest('/api/v1/agents/assessment', 'POST', 200, duration, {
                    tenantId: tenant.tenantId,
                    mode,
                    mock: false,
                });

                return NextResponse.json(backendResponse, { status: 200 });
            } catch (backendErr: any) {
                logger.warn({ backendErr: backendErr.message }, 'Backend API error, falling back to mock assessment');
                if (mode === 'generate' || mode === 'flashcards') {
                    const fallbackResp = getMockAssessmentQuestions(actualDifficulty, actualTopic, numQuestions);
                    return NextResponse.json(fallbackResp, { status: 200 });
                }
                if (backendErr instanceof BackendAPIError) {
                    const duration = Date.now() - startTime;
                    logRequest('/api/v1/agents/assessment', 'POST', backendErr.status, duration, {
                        tenantId: tenant.tenantId,
                        error: backendErr.message,
                    });

                    return NextResponse.json(
                        { error: backendErr.message },
                        { status: backendErr.status }
                    );
                }
                throw backendErr;
            }
        }
    } catch (err: any) {
        const duration = Date.now() - startTime;
        const status = err.status || 500;

        logger.error({ err, status }, 'Assessment request failed');
        logRequest('/api/v1/agents/assessment', 'POST', status, duration, { error: err.message });

        return NextResponse.json(
            {
                error: err.message || 'Internal server error',
            },
            { status }
        );
    }
}
