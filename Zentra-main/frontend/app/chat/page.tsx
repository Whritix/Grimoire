"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useUser } from "@clerk/nextjs"
import { motion, AnimatePresence } from "framer-motion"
import {
  SendHorizontal,
  Sparkles,
  Image as ImageIcon,
  X,
  Trash2,
  MessageSquare,
  PanelLeftClose,
  PanelLeft,
  Bot,
  User //new
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ConversationHistory } from "@/components/chat/conversation-history"
import { useActivity } from "@/hooks/useActivity"
import { cn } from "@/lib/utils"
// We'll use a local Message bubble component or verify existing
import { ChatMessage } from "@/components/chat/chat-message"
import ReactMarkdown from 'react-markdown' // Ensure this is installed or use ChatMarkdown if available

// --- Type Definitions ---
interface Message {
  role: "user" | "assistant"
  content: string
  id?: string
  image?: string
  isStreaming?: boolean
}

export default function ChatPage() {
  const { user } = useUser()
  const { trackUIAction } = useActivity()

  // State
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)

  // Image State
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Refs for scrolling and focus
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // --- Scroll Logic (Container-based to prevent viewport shift) ---
  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, scrollToBottom])


  useEffect(() => {
    // Focus input on load
    textareaRef.current?.focus()
  }, [])

  // --- Image Handling ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Image too large (Max 5MB)")
        return
      }
      const reader = new FileReader()
      reader.onload = (e) => setSelectedImage(e.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  // --- Streaming Logic ---
  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return

    // 1. Prepare User Message
    const userMsgText = input.trim()
    const userImage = selectedImage

    const newUserMsg: Message = {
      role: "user",
      content: userMsgText,
      image: userImage || undefined,
      id: Date.now().toString()
    }

    // 2. Update UI optimistcally
    setInput("")
    setSelectedImage(null)
    setMessages(prev => [...prev, newUserMsg])
    setIsLoading(true)

    // Reset height
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    try {
      // 3. Initialize Streaming Request
      const currentMessages = [...messages, newUserMsg].map(m => ({
        role: m.role,
        content: m.content
      }))

      // Prepare body
      const body = {
        messages: currentMessages,
        user_id: user?.id,
        images: userImage ? [userImage] : undefined,
        current_lesson: null, // Can be enhanced later
        documents: []
      }

      const response = await fetch("/api/v1/agents/doubt-assistant/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })

      if (!response.ok || !response.body) {
        throw new Error("Failed to start stream")
      }

      // 4. Create Placeholder for AI Response
      const aiMsgId = (Date.now() + 1).toString()
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "", id: aiMsgId, isStreaming: true }
      ])

      // 5. Read Stream
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let aiContent = ""

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        aiContent += chunk

        // Update the last message with new content
        setMessages(prev => {
          const newAll = [...prev]
          const last = newAll[newAll.length - 1]
          if (last.id === aiMsgId) {
            last.content = aiContent
          }
          return newAll
        })
      }

      // 6. Finalize
      setMessages(prev => {
        const newAll = [...prev]
        const last = newAll[newAll.length - 1]
        if (last.id === aiMsgId) {
          last.isStreaming = false
        }
        return newAll
      })

      // 7. Save to DB — fire-and-forget so it never blocks the UI
      const newMessagePair = [
        { role: newUserMsg.role, content: newUserMsg.content, image: newUserMsg.image },
        { role: "assistant" as const, content: aiContent }
      ]

      if (activeConversationId) {
        // Append the new user+AI pair to the existing conversation
        fetch(`/api/v1/agents/conversations/${activeConversationId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: newMessagePair })
        }).catch(err => console.error("Failed to update conversation:", err))
      } else {
        // Create a new conversation; store the returned ID for subsequent saves
        fetch("/api/v1/agents/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: newMessagePair })
        })
          .then(res => res.json())
          .then(data => {
            if (data.payload?.id) {
              setActiveConversationId(data.payload.id)
            }
          })
          .catch(err => console.error("Failed to create conversation:", err))
      }

    } catch (error) {
      console.error("Streaming Error:", error)
      setMessages(prev => [...prev, { role: "assistant", content: "**Error:** Failed to generative response. Please try again.", id: "error" }])
    } finally {
      setIsLoading(false)
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }

  // --- Helpers ---
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Start new chat
  const startNewChat = () => {
    setMessages([])
    setActiveConversationId(null)
    setSelectedImage(null)
    textareaRef.current?.focus()
  }

  // Load conversation (mock for now or existing)
  const handleSelectConversation = async (id: string | null) => {
    if (!id) {
      startNewChat()
      return
    }

    setActiveConversationId(id)
    // Fetch logic would go here, reuse existing logic
    try {
      const res = await fetch(`/api/v1/agents/conversations/${id}`)
      if (res.ok) {
        const data = await res.json()
        const loaded = data.payload?.messages || []
        setMessages(loaded.map((m: any) => ({
          role: m.role,
          content: m.content,
          image: m.image,
          id: m.timestamp
        })))
      }
    } catch (e) { console.error(e) }
  }


  return (
    <div className="absolute inset-0 pt-16 bg-background text-foreground font-sans flex text-sm md:text-base">

      {/* Sidebar - Collapsible */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-r border-border bg-muted/10 hidden md:flex flex-col z-20 shrink-0 h-full"
          >
            <div className="p-4 border-b border-border/50 flex justify-between items-center shrink-0">
              <span className="font-semibold text-sm">Chats</span>
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="h-8 w-8">
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <ConversationHistory
                activeConversationId={activeConversationId}
                onSelectConversation={handleSelectConversation}
                onNewChat={startNewChat}
                isCollapsed={false}
                onToggleCollapse={() => { }}
                embedded={true}
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">

        {/* Chat Area - Force scrollable with explicit styles */}
        <div
          ref={chatContainerRef}
          style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}
          className="scroll-smooth custom-scrollbar relative"
        >
          {/* Sidebar Toggle (when closed) */}
          {!sidebarOpen && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="absolute top-4 left-4 z-10 h-10 w-10 rounded-full shadow-lg bg-background/95 backdrop-blur-sm border-border hover:bg-muted hidden md:flex"
            >
              <PanelLeft className="h-5 w-5" />
            </Button>
          )}

          {messages.length === 0 ? (
            // Empty State
            <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-8 max-w-2xl mx-auto animate-in fade-in duration-500">
              <div className="h-20 w-20 bg-linear-to-tr from-primary/20 to-secondary rounded-3xl flex items-center justify-center shadow-xl mb-4">
                <Bot className="h-10 w-10 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight mb-3">How can I help you today?</h1>
                <p className="text-muted-foreground text-lg">I can help you review your code, practice for interviews, or explain complex topics.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                {[
                  "Analyze my recent progress",
                  "Create a Python study plan",
                  "Quiz me on React Hooks",
                  "Explain the code I uploaded"
                ].map((q, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => { setInput(q); textareaRef.current?.focus() }}
                    className="p-4 rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-primary/30 transition-all text-sm font-medium text-left shadow-sm"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Messages List - Added pt-6 for top margin below header
            <div className="max-w-4xl mx-auto w-full px-4 md:px-6 pt-6 pb-4 space-y-4">
              {messages.map((msg, idx) => (
                <motion.div
                  key={msg.id || idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-4 group",
                    msg.role === "assistant" ? "justify-start" : "justify-end"
                  )}
                >
                  {/* Assistant Avatar */}
                  {msg.role === "assistant" && (
                    <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                  )}

                  {/* Message Content - Simplified styling for assistant */}
                  <div className={cn(
                    "relative rounded-2xl",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm max-w-[80%] p-4 shadow-sm"
                      : "flex-1 min-w-0"
                  )}>
                    {/* Image display */}
                    {msg.image && (
                      <img src={msg.image} alt="User upload" className="max-h-60 rounded-lg mb-3 border border-white/20" />
                    )}

                    {/* Text Content */}
                    <div className={cn(
                      "wrap-break-word text-sm md:text-base leading-relaxed",
                      msg.role === "user" ? "text-primary-foreground" : "prose prose-neutral dark:prose-invert max-w-none"
                    )}>
                      {msg.role === "assistant" ? (
                        <ChatMessage message={msg} simple />
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>

                    {/* Copy / Actions (Visible on hover for assistant) */}
                    {msg.role === "assistant" && !msg.isStreaming && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-6 left-0 flex gap-2">
                        {/* Actions can go here */}
                      </div>
                    )}
                  </div>

                  {/* User Avatar (Optional) */}
                  {msg.role === "user" && (
                    <div className="h-8 w-8 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 mt-1">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </motion.div>
              ))}
              <div ref={messagesEndRef} className="h-10" />
            </div>
          )}
        </div>

        {/* Input Area (Sticky Bottom) */}
        <div className="p-4 pt-2 bg-background border-t border-border w-full z-20">
          <div className="max-w-5xl mx-auto relative bg-secondary/30 rounded-3xl border border-border/50 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all shadow-sm">

            {/* Image Preview inside input */}
            {selectedImage && (
              <div className="p-3 pb-0">
                <div className="relative inline-block">
                  <img src={selectedImage} alt="Preview" className="h-16 w-16 object-cover rounded-xl border border-border" />
                  <button type="button" title="Remove image" aria-label="Remove selected image" onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-0.5 shadow-md">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-end gap-2 p-3">
              {/* Attach Button */}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} aria-label="Attach image" title="Attach image" />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-full"
                title="Attach image"
              >
                <ImageIcon className="h-5 w-5" />
              </Button>

              {/* Textarea */}
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  e.target.style.height = "auto"
                  e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px"
                }}
                onKeyDown={handleKeyDown}
                placeholder="Message GRIMOIRE..."
                className="min-h-[24px] max-h-[200px] border-0 focus-visible:ring-0 resize-none bg-transparent py-2 shadow-none"
                rows={1}
              />

              {/* Send Button */}
              <Button
                onClick={handleSend}
                disabled={isLoading || (!input.trim() && !selectedImage)}
                size="icon"
                className={cn(
                  "h-9 w-9 rounded-full transition-all",
                  (input.trim() || selectedImage) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                <SendHorizontal className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <p className="text-center text-[10px] text-muted-foreground mt-2">
            GRIMOIRE can make mistakes. Check important information.
          </p>
        </div>
      </main>
    </div>
  )
}
