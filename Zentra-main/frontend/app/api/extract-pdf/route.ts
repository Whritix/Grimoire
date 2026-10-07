import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Default to localhost if env var not set
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
    
    const backendFormData = new FormData();
    backendFormData.append("file", file);

    const response = await fetch(`${backendUrl}/v1/agents/extract-pdf`, {
      method: "POST",
      body: backendFormData,
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Backend PDF extraction failed:", response.status, errorText);
        return NextResponse.json(
            { error: `Backend processing failed: ${response.status}` }, 
            { status: response.status }
        );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error("PDF extraction proxy error:", error);
    return NextResponse.json(
      { error: "Failed to process PDF" },
      { status: 500 }
    );
  }
}
