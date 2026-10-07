import { NextRequest, NextResponse } from 'next/server';
import { backendRequest, BackendAPIError } from '@/lib/server/api-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const data = await backendRequest('/v1/agents/notes-intelligence/save', {
      method: 'POST',
      body: body
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Save API proxy error:', error);
    
    if (error instanceof BackendAPIError) {
        return NextResponse.json(
            { error: error.message, detail: error.message },
            { status: error.status }
        );
    }

    return NextResponse.json(
      { error: 'Failed to save analysis' },
      { status: 500 }
    );
  }
}
