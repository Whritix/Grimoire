import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.notes || body.notes.length < 50) {
      return NextResponse.json(
        { error: "Notes must be at least 50 characters long" },
        { status: 400 }
      );
    }

    if (!body.user_id) {
      return NextResponse.json(
        { error: "user_id is required" },
        { status: 400 }
      );
    }

    // Default to localhost if env var not set
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

    const response = await fetch(`${backendUrl}/v1/agents/generate-mindmap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer test-key",
      },
      body: JSON.stringify({
        notes: body.notes,
        subject: body.subject || null,
        user_id: body.user_id,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend mindmap generation failed:", response.status, errorText);
      return NextResponse.json(
        { error: `Backend processing failed: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error("Mindmap generation proxy error:", error);
    return NextResponse.json(
      { error: "Failed to generate mindmap" },
      { status: 500 }
    );
  }
}
