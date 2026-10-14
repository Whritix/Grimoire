import { NextRequest, NextResponse } from 'next/server';
import { backendRequest, BackendAPIError } from '@/lib/server/api-client';
import { getTenantFromRequest } from '@/lib/server/auth';
import { logRequest } from '@/lib/server/logger';

export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
    const startTime = Date.now();
    const { userId } = await params;

    try {
        const tenant = await getTenantFromRequest(request);

        console.log(`[Progress] Fetching for user ${userId} via backend proxy`);

        // Proxy to backend
        // The backend agent /v1/agents/progress returns text/JSON
        const backendResponse = await backendRequest(
            `/v1/agents/progress/${userId}`,
            {
                method: 'GET',
            }
        );

        // Try to parse if it looks like LLM response structure (just in case backend changes)
        // This is a best-effort mitigation
        if (backendResponse?.choices?.[0]?.message?.content) {
            try {
                const content = backendResponse.choices[0].message.content;
                // Try to extract JSON from code block if present
                const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
                    return NextResponse.json(parsed, { status: 200 });
                }
            } catch (e) {
                // ignore parse error
            }
        }

        const duration = Date.now() - startTime;
        logRequest(`/api/v1/progress/${userId}`, 'GET', 200, duration, {
            tenantId: tenant.tenantId,
        });

        return NextResponse.json(backendResponse, {
            status: 200,
            headers: { 'Cache-Control': 's-maxage=20, stale-while-revalidate=60' },
        });

    } catch (err: any) {
        const duration = Date.now() - startTime;
        const status = err.status || 500;
        console.error(`Progress fetch failed for user ${userId}:`, err);
        
        if (err instanceof BackendAPIError) {
             return NextResponse.json({ error: err.message }, { status: err.status });
        }

        return NextResponse.json({ error: err.message }, { status });
    }
}
