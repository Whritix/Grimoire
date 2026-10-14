/**
 * POST /api/v1/agents/assessment/analyze
 * Uses LLM to generate personalized strengths/weaknesses based on quiz results
 */

import { NextRequest, NextResponse } from 'next/server';
import { backendRequest, BackendAPIError } from '@/lib/server/api-client';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { topic, score, totalQuestions, correctCount, wrongQuestions, correctQuestions } = body;

        // Create a concise prompt for the LLM
        const analysisPrompt = `Analyze this quiz performance and provide VERY CONCISE feedback (3-4 words each item max).

Topic: ${topic}
Score: ${score}% (${correctCount}/${totalQuestions} correct)

${wrongQuestions?.length > 0 ? `Wrong answers on: ${wrongQuestions.map((q: any) => q.question).slice(0, 3).join('; ')}` : 'Perfect score - no wrong answers!'}

${correctQuestions?.length > 0 ? `Correctly answered: ${correctQuestions.slice(0, 2).join('; ')}` : ''}

Respond ONLY with valid JSON in this exact format:
{
  "strengths": ["3-4 word strength", "another strength", "one more"],
  "weaknesses": ["3-4 word weakness", "another weakness"],
  "suggested_goal": "Role Title Here"
}

Rules:
- Each strength/weakness MUST be 3-4 words max
- For 100% score: strengths should celebrate, weaknesses should be empty array []
- For low scores: be constructive, not discouraging
- suggested_goal should be a job title like "Python Developer" or "ML Engineer"
- Return ONLY the JSON, no other text`;

        try {
            // Call the teaching agent for analysis
            const backendResponse = await backendRequest<any>(
                '/v1/agents/teaching',
                {
                    method: 'POST',
                    body: {
                        mode: 'chat',
                        model: 'gemini-2.0-flash',
                        message: analysisPrompt,
                        temperature: 0.3,
                        max_tokens: 500,
                    }
                }
            );

            // Extract the response text
            let responseText = backendResponse?.agent_output?.payload?.message ||
                backendResponse?.payload?.message ||
                backendResponse?.message || '';

            // Try to parse JSON from the response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return NextResponse.json({
                    strengths: parsed.strengths || [],
                    weaknesses: parsed.weaknesses || [],
                    suggested_goal: parsed.suggested_goal || `${topic} Developer`
                });
            }
        } catch (backendErr) {
            console.error('Backend analysis failed:', backendErr);
        }

        // Fallback response if LLM fails
        const fallbackStrengths = score === 100
            ? ["Perfect Score!", `${topic} Mastery`, "Great Understanding"]
            : score >= 70
                ? ["Good Knowledge", "Problem Solving", "Quick Thinking"]
                : ["Keep Practicing", "Good Effort"];

        const fallbackWeaknesses = score === 100
            ? []
            : score >= 70
                ? ["Advanced Topics"]
                : ["Core Concepts", "More Practice Needed"];

        return NextResponse.json({
            strengths: fallbackStrengths,
            weaknesses: fallbackWeaknesses,
            suggested_goal: score >= 80 ? `Senior ${topic} Developer` : `${topic} Developer`
        });

    } catch (err: any) {
        console.error('Assessment analyze error:', err);
        return NextResponse.json(
            { error: err.message || 'Analysis failed' },
            { status: 500 }
        );
    }
}
