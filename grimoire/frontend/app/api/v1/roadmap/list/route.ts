import { NextRequest, NextResponse } from 'next/server';
import { backendRequest, BackendAPIError } from '@/lib/server/api-client';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            console.log('[Roadmap/List] No userId provided, returning empty array');
            return NextResponse.json({ roadmaps: [] }, { status: 200 });
        }

        console.log(`[Roadmap/List] Request for userId: ${userId} - Proxying to backend`);

        // Proxy to backend
        const data = await backendRequest(`/v1/agents/roadmap/list?userId=${userId}`, {
            method: 'GET'
        });

        // Backend returns { roadmaps: [...] }
        return NextResponse.json(data, {
            status: 200,
            headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' },
        });

    } catch (error: any) {
        console.error('Error fetching roadmaps:', error);

        if (error instanceof BackendAPIError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status }
            );
        }

        return NextResponse.json(
            { error: 'Failed to fetch roadmaps' },
            { status: 500 }
        );
    }
}
