import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/firebase";
import { auth } from "@clerk/nextjs/server";

// Create a new conversation
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, messages } = body;

    if (!db) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 500 }
      );
    }

    const now = new Date().toISOString();
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Generate title from first user message if not provided
    let finalTitle = title;
    if (!finalTitle && messages?.length > 0) {
      const firstUserMessage = messages.find((m: any) => m.role === "user");
      if (firstUserMessage) {
        finalTitle = firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? "..." : "");
      }
    }
    finalTitle = finalTitle || "New Chat";

    // Add timestamps to messages and strip large images
    const messagesWithTimestamps = (messages || []).map((m: any) => {
        // Create a shallow copy to modify
        const msg = { ...m, timestamp: m.timestamp || now };
        
        // Remove large base64 images from storage to avoid Firestore 1MB limit and invalid entity errors
        if (msg.images && Array.isArray(msg.images)) {
             // Replace base64 strings with a placeholder
             msg.images = msg.images.map(() => "[Image Storage Not Implemented]");
             // Or just remove them if you prefer: delete msg.images;
        }
        // Also check singular 'image' property if used elsewhere
        if (msg.image && typeof msg.image === 'string' && msg.image.startsWith('data:')) {
             msg.image = "[Image Storage Not Implemented]";
        }
        
        return msg;
    });

    const conversation = {
      id: conversationId,
      user_id: userId,
      title: finalTitle,
      messages: messagesWithTimestamps,
      created_at: now,
      updated_at: now,
    };

    await db.collection("conversations").doc(conversationId).set(conversation);

    return NextResponse.json({
      success: true,
      payload: conversation,
    });
  } catch (error: any) {
    console.error("Error creating conversation:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create conversation" },
      { status: 500 }
    );
  }
}

// List conversations for current user
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!db) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20");

    const snapshot = await db
      .collection("conversations")
      .where("user_id", "==", userId)
      .orderBy("updated_at", "desc")
      .limit(limit)
      .get();

    const conversations = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: data.id,
        title: data.title,
        created_at: data.created_at,
        updated_at: data.updated_at,
        message_count: data.messages?.length || 0,
      };
    });

    return NextResponse.json({
      success: true,
      payload: {
        conversations,
        total: conversations.length,
      },
    });
  } catch (error: any) {
    console.error("Error listing conversations:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list conversations" },
      { status: 500 }
    );
  }
}
