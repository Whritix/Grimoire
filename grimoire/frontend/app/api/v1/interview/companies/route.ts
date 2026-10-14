import { NextRequest, NextResponse } from 'next/server';
import { backendRequest } from '@/lib/server/api-client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        // Proxy to backend
        const data = await backendRequest('/v1/agents/interview/companies', {
            method: 'GET',
            cache: 'no-store'
        });
        
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching companies:', error);
        return NextResponse.json(
            { error: 'Failed to fetch companies' },
            { status: 500 }
        );
    }
}
