import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const formData = await req.formData();
    
    // Forward to backend
    // Assuming backend is at localhost:8000 or defined in env
    // We'll use process.env.NEXT_PUBLIC_API_URL or default
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    const response = await fetch(`${backendUrl}/v1/agents/interview/${id}/analysis`, {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type here, let fetch set it with boundary for FormData
        // But we might need auth headers if backend requires them (AuthenticatedUser)
        // Ideally frontend passes them. 
        // For now, we assume simple proxy.
      },
    });

    if (!response.ok) {
       console.error("Backend error:", response.status, await response.text());
       return NextResponse.json({ error: "Backend analysis failed" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error("Analysis proxy error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
