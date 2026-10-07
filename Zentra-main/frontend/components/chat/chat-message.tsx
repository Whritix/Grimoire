"use client"

import { motion } from "framer-motion"
import { User, Sparkles } from "lucide-react"
import { ChatMarkdown } from "@/components/ui/chat-markdown"
import { useUser } from "@clerk/nextjs" // Import to get user image if available

interface ChatMessageProps {
  message: {
    role: "user" | "assistant"
    content: string
    image?: string
  }
  simple?: boolean // When true, render only markdown content without wrapper
}

export function ChatMessage({ message, simple }: ChatMessageProps) {
  const isUser = message.role === "user"
  const { user } = useUser()

  // Simple mode: just render the markdown content directly
  if (simple) {
    return <ChatMarkdown content={message.content} className="prose-neutral dark:prose-invert" />
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex w-full gap-4 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {/* Assistant Avatar - Left */}
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mt-1">
           <Sparkles className="h-4 w-4 text-primary" />
        </div>
      )}

      {/* Message Content */}
      <div className={`flex flex-col gap-1 max-w-[85%] lg:max-w-[75%] ${isUser ? "items-end" : "items-start"}`}>
          
          {/* Image Content */}
          {(message as any).image && (
            <div className="mb-2">
              <img 
                src={(message as any).image} 
                alt="Uploaded context" 
                className="max-w-full rounded-2xl border border-border max-h-[300px] object-cover shadow-sm"
              />
            </div>
          )}

          {/* Text Content */}
          <div className={`text-base leading-relaxed px-5 py-3.5 shadow-sm transition-colors ${
              isUser 
                ? "bg-secondary text-secondary-foreground rounded-2xl rounded-tr-sm" 
                : "bg-transparent text-foreground p-0 shadow-none px-0 py-0" 
          }`}>
               {isUser ? (
                   <p className="whitespace-pre-wrap">{message.content}</p>
               ) : (
                   <ChatMarkdown content={message.content} className="prose-neutral dark:prose-invert" />
               )}
          </div>
      </div>
    </motion.div>
  )
}
