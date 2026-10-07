import { NextRequest, NextResponse } from 'next/server';
import { backendRequest } from '@/lib/server/api-client';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const result = await backendRequest('/v1/user/activity', {
            method: 'POST',
            body: body
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error proxying activity:', error);
        return NextResponse.json({ success: false, error: 'Failed to log activity' }, { status: 500 });
    }
}
