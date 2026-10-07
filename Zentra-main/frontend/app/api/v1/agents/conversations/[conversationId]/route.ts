import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/firebase";
import { auth } from "@clerk/nextjs/server";

// Get a specific conversation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await params;

    if (!db) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 500 }
      );
    }

    const doc = await db.collection("conversations").doc(conversationId).get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const data = doc.data();

    // Verify ownership
    if (data?.user_id !== userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      payload: data,
    });
  } catch (error: any) {
    console.error("Error getting conversation:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get conversation" },
      { status: 500 }
    );
  }
}

// Update a conversation (add messages)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await params;
    const body = await request.json();
    const { messages } = body;

    if (!db) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 500 }
      );
    }

    const docRef = db.collection("conversations").doc(conversationId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const data = doc.data();

    // Verify ownership
    if (data?.user_id !== userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const now = new Date().toISOString();
    const existingMessages = data?.messages || [];

    // Add new messages with timestamps
    const newMessages = (messages || []).map((m: any) => ({
      ...m,
      timestamp: m.timestamp || now,
    }));

    const updatedMessages = [...existingMessages, ...newMessages];

    await docRef.update({
      messages: updatedMessages,
      updated_at: now,
    });

    return NextResponse.json({
      success: true,
      payload: {
        id: conversationId,
        message_count: updatedMessages.length,
        updated_at: now,
      },
    });
  } catch (error: any) {
    console.error("Error updating conversation:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update conversation" },
      { status: 500 }
    );
  }
}

// Delete a conversation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await params;

    if (!db) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 500 }
      );
    }

    const docRef = db.collection("conversations").doc(conversationId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const data = doc.data();

    // Verify ownership
    if (data?.user_id !== userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await docRef.delete();

    return NextResponse.json({
      success: true,
      payload: { deleted: true, id: conversationId },
    });
  } catch (error: any) {
    console.error("Error deleting conversation:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete conversation" },
      { status: 500 }
    );
  }
}
