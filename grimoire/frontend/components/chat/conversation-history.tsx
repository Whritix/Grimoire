"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, Trash2, ChevronLeft, ChevronRight, MoreHorizontal, PenSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useActivity } from "@/hooks/useActivity";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

interface ConversationHistoryProps {
  onSelectConversation: (conversationId: string | null) => void;
  onNewChat: () => void;
  activeConversationId: string | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  embedded?: boolean; // When true, renders only content without wrapper
}

export function ConversationHistory({
  onSelectConversation,
  onNewChat,
  activeConversationId,
  isCollapsed,
  onToggleCollapse,
  embedded = false,
}: ConversationHistoryProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { trackUIAction } = useActivity();

  const fetchConversations = async () => {
    try {
      const response = await fetch("/api/v1/agents/conversations?limit=50");
      if (response.ok) {
        const data = await response.json();
        setConversations(data.payload?.conversations || []);
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (activeConversationId) {
      fetchConversations();
    }
  }, [activeConversationId]);

  const handleDelete = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    if (!window.confirm("Delete this conversation?")) return;
    
    try {
      const response = await fetch(`/api/v1/agents/conversations/${conversationId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== conversationId));
        if (activeConversationId === conversationId) {
          onNewChat();
        }
        trackUIAction("delete_conversation_button", "click", { conversationId });
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  // Group conversations by date
  const groupedConversations = conversations.reduce((groups, conversation) => {
    const date = new Date(conversation.updated_at);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    let groupName = "Older";
    if (diffDays === 0) groupName = "Today";
    else if (diffDays === 1) groupName = "Yesterday";
    else if (diffDays <= 7) groupName = "Previous 7 Days";
    else if (diffDays <= 30) groupName = "Previous 30 Days";

    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(conversation);
    return groups;
  }, {} as Record<string, Conversation[]>);

  const groupOrder = ["Today", "Yesterday", "Previous 7 Days", "Previous 30 Days", "Older"];

  // Embedded mode: render just the conversation list content
  const conversationListContent = (
    <div className="pb-4 pt-2 space-y-4 px-2">
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : conversations.length === 0 ? (
         <div className="text-center text-muted-foreground text-sm py-8 px-4">
           <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
             <MessageSquare className="h-6 w-6 opacity-50" />
           </div>
           <p>No chat history yet.</p>
           <p className="text-xs mt-1 opacity-70">Start a new conversation to begin learning.</p>
         </div>
      ) : (
         <>
         {groupOrder.map((group) => {
             const groupChats = groupedConversations[group];
             if (!groupChats || groupChats.length === 0) return null;

             return (
                 <div key={group} className="space-y-1">
                     <h3 className="text-xs font-medium text-muted-foreground/70 px-2 py-2 uppercase tracking-wider">{group}</h3>
                     <div className="space-y-0.5">
                         {groupChats.map((conversation) => (
                             <div
                                 key={conversation.id}
                                 className={cn(
                                     "group relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all cursor-pointer overflow-hidden",
                                     activeConversationId === conversation.id 
                                        ? "bg-primary/10 text-primary font-medium" 
                                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                 )}
                                 onClick={() => onSelectConversation(conversation.id)}
                             >
                                 <MessageSquare className={cn("h-4 w-4 shrink-0", activeConversationId === conversation.id ? "text-primary" : "opacity-50")} />
                                 <div className="flex-1 truncate text-xs">
                                     {conversation.title || "New Chat"}
                                 </div>

                                 {/* Hover Actions */}
                                 {activeConversationId === conversation.id && (
                                     <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center bg-gradient-to-l from-background to-transparent pl-2">
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted text-muted-foreground hover:text-foreground">
                                                    <MoreHorizontal className="h-3 w-3" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-32">
                                                <DropdownMenuItem 
                                                    onClick={(e) => handleDelete(e, conversation.id)}
                                                    className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                                                >
                                                    <Trash2 className="mr-2 h-3 w-3" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                     </div>
                                 )}
                             </div>
                         ))}
                     </div>
                 </div>
             )
         })}
         </>
      )}
    </div>
  );

  // When embedded, return just the content without wrapper
  if (embedded) {
    return conversationListContent;
  }

  // Full standalone mode with wrapper
  return (
    <motion.div 
      initial={false}
      animate={{ width: isCollapsed ? 60 : 260 }}
      className={cn(
        "relative flex flex-col h-full border-r border-border bg-muted/10 shrink-0 transition-all duration-300 ease-in-out",
        isCollapsed ? "w-[60px]" : "w-[260px]"
      )}
    >
      {/* Header Actions */}
      <div className="flex items-center p-3 gap-2">
         {isCollapsed ? (
             <Button
                variant="ghost"
                size="icon"
                onClick={onNewChat}
                className="h-9 w-9 mx-auto rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
                title="New Chat"
             >
               <PenSquare className="h-5 w-5" />
             </Button>
         ) : (
             <Button
                variant="outline"
                className="flex-1 justify-start gap-2 h-9 px-3 border-dashed hover:border-primary/50 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
                onClick={onNewChat}
             >
                <Plus className="h-4 w-4" />
                <span className="font-medium">New chat</span>
             </Button>
         )}

         {!isCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
            >
               <ChevronLeft className="h-4 w-4" />
            </Button>
         )}
      </div>
      
      {isCollapsed && (
        <div className="px-3 pb-3 flex justify-center border-b border-border/50">
             <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
            >
               <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
      )}

      {/* Conversation List */}
      <ScrollArea className="flex-1 min-h-0">
        {conversationListContent}
      </ScrollArea>
      
      {/* Footer */}
      <div className="p-3 border-t border-border mt-auto bg-muted/5">
      </div>
    </motion.div>
  );
}
