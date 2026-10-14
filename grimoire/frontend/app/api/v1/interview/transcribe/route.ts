import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as Blob | null;

        if (!file || file.size === 0) {
            return NextResponse.json({ text: '' }, { status: 200 });
        }

        const groqApiKey = process.env.GROQ_API_KEY;

        // Try direct Groq Whisper API first (fastest)
        if (groqApiKey) {
            try {
                const groqForm = new FormData();
                groqForm.append('file', file, 'recording.webm');
                groqForm.append('model', 'whisper-large-v3');
                groqForm.append('response_format', 'json');

                const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${groqApiKey}`,
                    },
                    body: groqForm,
                });

                if (groqRes.ok) {
                    const data = await groqRes.json();
                    const text = (data.text || '').trim();
                    return NextResponse.json({ text });
                } else {
                    const errorText = await groqRes.text().catch(() => '');
                    console.warn('Direct Groq Whisper API failed, falling back to backend:', groqRes.status, errorText);
                }
            } catch (groqErr) {
                console.warn('Direct Groq Whisper error, trying backend:', groqErr);
            }
        }

        // Fallback to FastAPI backend endpoint
        const backendUrl = (process.env.TEACHING_ASSISTANT_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
        const backendForm = new FormData();
        backendForm.append('file', file, 'recording.webm');

        const backendRes = await fetch(`${backendUrl}/v1/agents/interview/transcribe`, {
            method: 'POST',
            body: backendForm,
        });

        if (!backendRes.ok) {
            const errData = await backendRes.text().catch(() => '');
            return NextResponse.json({ error: `Transcription failed: ${errData}`, text: '' }, { status: backendRes.status });
        }

        const backendData = await backendRes.json();
        return NextResponse.json({ text: backendData.text || '' });

    } catch (error: any) {
        console.error('Error in transcribe route:', error);
        return NextResponse.json({ error: error.message || 'Internal server error', text: '' }, { status: 500 });
    }
}
