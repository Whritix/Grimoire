/**
 * POST /api/roadmap
 * Frontend-friendly wrapper for roadmap generation
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        // Parse request body
        const body = await request.json();

        // Forward to planner endpoint
        const plannerUrl = new URL('/api/v1/agents/planner', request.url);

        const response = await fetch(plannerUrl.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': request.headers.get('Authorization') || '',
            },
            body: JSON.stringify(body),
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
