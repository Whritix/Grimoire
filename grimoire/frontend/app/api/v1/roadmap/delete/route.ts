
import { NextRequest, NextResponse } from 'next/server';
import { backendRequest, BackendAPIError } from '@/lib/server/api-client';

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const roadmapId = searchParams.get('roadmapId');
        const userId = searchParams.get('userId');

        if (!roadmapId || !userId) {
            return NextResponse.json({ error: 'Missing roadmapId or userId' }, { status: 400 });
        }

        // Proxy to backend using shared client
        // This handles URL resolution (TEACHING_ASSISTANT_URL) and Auth headers
        await backendRequest(`/v1/agents/roadmap/delete?roadmap_id=${roadmapId}&user_id=${userId}`, {
            method: 'DELETE'
        });

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error: any) {
        console.error('Error deleting roadmap:', error);

        if (error instanceof BackendAPIError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status }
            );
        }

        return NextResponse.json({ error: 'Failed to delete roadmap' }, { status: 500 });
    }
}
