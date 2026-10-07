import { NextRequest, NextResponse } from 'next/server';
import { backendRequest, BackendAPIError } from '@/lib/server/api-client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    const data = await backendRequest(`/v1/agents/notes-intelligence/list/${userId}`, {
      method: 'GET'
    });

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' },
    });
  } catch (error: any) {
    console.error('List notes API proxy error:', error);
    
    if (error instanceof BackendAPIError) {
        return NextResponse.json(
            { error: error.message, notes: [] },
            { status: error.status }
        );
    }

    return NextResponse.json(
      { error: 'Failed to fetch notes', notes: [] },
      { status: 500 }
    );
  }
}
