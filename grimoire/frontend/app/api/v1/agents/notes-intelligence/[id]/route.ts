import { NextRequest, NextResponse } from 'next/server';
import { backendRequest, BackendAPIError } from '@/lib/server/api-client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const data = await backendRequest(`/v1/agents/notes-intelligence/${id}`, {
      method: 'GET'
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Get note API proxy error:', error);
    
    if (error instanceof BackendAPIError) {
        return NextResponse.json(
            { error: error.message },
            { status: error.status }
        );
    }

    return NextResponse.json(
      { error: 'Failed to fetch note' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const data = await backendRequest(`/v1/agents/notes-intelligence/${id}`, {
      method: 'DELETE'
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Delete note API proxy error:', error);
    
    if (error instanceof BackendAPIError) {
        return NextResponse.json(
            { error: error.message },
            { status: error.status }
        );
    }

    return NextResponse.json(
      { error: 'Failed to delete note' },
      { status: 500 }
    );
  }
}
