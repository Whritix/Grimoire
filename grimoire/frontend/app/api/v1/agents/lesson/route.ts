
import { NextRequest, NextResponse } from 'next/server';
import { backendRequest } from '@/lib/server/api-client';

// Types from lib/server/types.ts
interface RetrieverResponse {
    documents: Array<{
        id: string;
        title: string;
        url: string;
        snippet: string;
        source_type: string;
    }>;
}

interface ComposerResponse {
    title: string;
    items: Array<{
        type: 'text' | 'code' | 'video' | 'quiz';
        content: string;
        title?: string;
        language?: string;
    }>;
    quiz_seed?: any[];
}

export async function POST(request: NextRequest) {
    try {
        const { topic, context } = await request.json();

        if (!topic) {
            return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
        }

        const searchQuery = context ? `${topic} in ${context} tutorial` : `${topic} tutorial`;

        // 1. Retrieve Resources
        // console.log(`[LessonAgent] Retrieving resources for: ${searchQuery}`);
        let documents: RetrieverResponse['documents'] = [];
        try {
            const retrieverRes = await backendRequest<RetrieverResponse>('/v1/agents/retriever', {
                method: 'POST',
                body: {
                    query: searchQuery,
                    max_results: 5,
                    model: 'retriever-v1'
                },
                timeout: 30000
            });
            // Handle unwrapping of agent response
            const payload = (retrieverRes as any).agent_output?.payload || (retrieverRes as any).payload || retrieverRes;
            documents = payload.documents || [];
            // console.log(`[LessonAgent] Retrieved ${documents.length} documents`);
        } catch (error: any) {
            console.error('[LessonAgent] Retriever failed:', error.message || error);
            // Fallback documents if retriever fails
            documents = [
                {
                    id: 'fallback_1',
                    title: `${topic} Overview`,
                    url: '',
                    snippet: `This is a generated lesson about ${topic}.`,
                    source_type: 'web'
                }
            ];
        }

        // 2. Compose Lesson
        // console.log(`[LessonAgent] Composing lesson with ${documents.length} documents`);
        const composerRes = await backendRequest<ComposerResponse>('/v1/agents/composer', {
            method: 'POST',
            body: {
                topic: topic,
                documents: documents.map(d => ({
                    id: d.id,
                    title: d.title,
                    text: d.snippet, // Use snippet as text for composition
                    url: d.url,
                    source_type: d.source_type
                })),
                difficulty: 'beginner', // Could be dynamic
                model: 'composer-v1'
            },
            timeout: 120000 // 2 minutes for composition
        });

        return NextResponse.json(composerRes, { status: 200 });

    } catch (error) {
        console.error('[LessonAgent] Error generating lesson:', error);
        return NextResponse.json({ error: 'Failed to generate lesson content' }, { status: 500 });
    }
}
