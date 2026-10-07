import { NextRequest, NextResponse } from 'next/server';
import { backendRequest, BackendAPIError } from '@/lib/server/api-client';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Ensure userId is present (handle null from frontend)
        if (!body.userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        // Proxy to backend using shared client
        // This handles URL resolution (TEACHING_ASSISTANT_URL) and Auth headers
        const data = await backendRequest('/v1/agents/roadmap/save', {
            method: 'POST',
            body: body
        });

        return NextResponse.json(data, { status: 200 });
    } catch (error: any) {
        console.error('Error saving roadmap:', error);

        if (error instanceof BackendAPIError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status }
            );
        }

        return NextResponse.json(
            { error: 'Failed to save roadmap' },
            { status: 500 }
        );
    }
}
