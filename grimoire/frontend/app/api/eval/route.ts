/**
 * POST /api/eval
 * Frontend-friendly wrapper for assessment grading
 */

import { NextRequest, NextResponse } from 'next/server';
import type { AssessmentAnswer } from '@/lib/types';

export async function POST(request: NextRequest) {
    try {
        // Parse request body
        const body = await request.json();
        const { answers } = body;

        // Forward to assessment endpoint with mode='grade'
        const assessmentUrl = new URL('/api/v1/agents/assessment', request.url);

        const response = await fetch(assessmentUrl.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': request.headers.get('Authorization') || '',
            },
            body: JSON.stringify({
                mode: 'grade',
                answers,
            }),
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
