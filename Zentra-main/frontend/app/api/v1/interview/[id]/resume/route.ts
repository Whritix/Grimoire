import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/interview/stateMachine';
import { backendRequest } from '@/lib/server/api-client';

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;
    const session = sessionManager.get(id);

    if (!session) {
        return NextResponse.json({
            error: { message: 'Interview session not found', type: 'not_found_error' }
        }, { status: 404 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json({
                error: { message: 'No file uploaded', type: 'validation_error' }
            }, { status: 400 });
        }

        // Forward to backend Python service for parsing
        // We need to reconstruct FormData or just send the file
        // The backendRequest helper might expect JSON by default, let's check.
        // If backendRequest is simple fetch wrapper, we can use it.
        // Assuming backendRequest supports FormData if body is FormData.
        
        // However, api-client might set Content-Type to application/json automatically. 
        // Let's create a direct fetch here to be safe or check api-client later.
        // For now, I'll use a direct fetch to the backend service URL.
        
        // We'll use the same base URL logic as backendRequest roughly.
        const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
        
        const backendFormData = new FormData();
        backendFormData.append('file', file);

        const res = await fetch(`${backendUrl}/v1/agents/interview/parse-resume`, {
            method: 'POST',
            body: backendFormData,
            headers: {
                 // Do NOT set Content-Type for FormData, browser/fetch sets it with boundary
            }
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Backend parsing failed: ${err}`);
        }

        const data = await res.json();
        const resumeText = data.text;

        session.setResumeText(resumeText);
         
        return NextResponse.json({
            success: true,
            text_length: resumeText.length
        });

    } catch (error) {
        console.error('Resume upload error:', error);
        return NextResponse.json({
            error: {
                message: 'Failed to process resume',
                type: 'server_error',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        }, { status: 500 });
    }
}
