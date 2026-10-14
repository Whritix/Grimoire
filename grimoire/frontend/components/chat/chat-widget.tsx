"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Send, Sparkles, Loader2, Paperclip, Image as ImageIcon, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChatMessage } from "./chat-message"
import { useActivity } from "@/hooks/useActivity"

interface ChatWidgetProps {
  open: boolean
  onClose: () => void
  lessonId?: string
  lessonTitle?: string
  lessonContent?: string
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  image?: string // Base64 data URI
}

export function ChatWidget({ open, onClose, lessonId, lessonTitle, lessonContent }: ChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { trackUIAction } = useActivity()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (open) {
      trackUIAction("chat_widget", "open", { lessonId })
    }
  }, [open, lessonId, trackUIAction])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert("Image too large. Please select an image under 5MB.")
        return
      }
      
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setSelectedImage(result)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setSelectedImage(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const submitMessage = async (content: string) => {
    if (!content.trim() || isStreaming) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: content.trim(),
      image: selectedImage || undefined
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setSelectedImage(null) // Clear after sending
    setIsStreaming(true)
    trackUIAction("chat_widget_message", "send", { lessonId, hasImage: !!selectedImage })

    try {
      // Send full data URI (Groq and other providers handle this better)
      const images = userMessage.image 
        ? [userMessage.image] 
        : undefined

      console.log('Sending chat request:', {
          messageCount: messages.length + 1,
          hasImage: !!images,
          imageCount: images?.length,
          firstImageLen: images?.[0]?.length,
          firstImageStart: images?.[0]?.substring(0, 50)
      })

      const response = await fetch("/api/v1/agents/doubt-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-key",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({ role: m.role, content: m.content })),
          images: images,
          current_lesson: lessonId ? {
            id: lessonId,
            title: lessonTitle || "Unknown Lesson",
            content: lessonContent || ""
          } : null,
          use_general_knowledge: true,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to get response")
      }

      const data = await response.json()

      // Handle standard agent response format
      // agent_output.payload.answer OR payload.answer OR reply
      const payload = data.agent_output?.payload || data.payload || data
      const reply = payload.answer || payload.reply

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: reply || "Sorry, I couldn't generate a response.",
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error("Chat error:", error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, something went wrong. Please try again later.",
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsStreaming(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submitMessage(input)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          />

          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed bottom-4 right-4 left-4 md:left-auto md:w-[420px] h-[600px] max-h-[80vh] bg-card border border-border rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-primary/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary">
                  <Sparkles className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Doubt Assistant</h3>
                  <p className="text-xs text-muted-foreground">AI-powered help</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
                  <Sparkles className="h-8 w-8 mx-auto mb-3 text-primary/50" />
                  <p className="text-sm mb-4">Ask anything about the lesson!</p>
                  <Button
                    variant="default"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full"
                    onClick={() => submitMessage("Summarise this video")}
                  >
                    Summarise this video
                  </Button>
                </div>
              )}
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {isStreaming && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl p-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Image Preview Area */}
            {selectedImage && (
              <div className="px-4 pb-2">
                <div className="relative inline-block">
                  <img 
                    src={selectedImage} 
                    alt="Preview" 
                    className="h-20 w-20 object-cover rounded-lg border border-border"
                  />
                  <button
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow-sm hover:bg-destructive/90"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-border">
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept="image/*"
                onChange={handleFileSelect}
              />
              <div className="flex gap-2">
                 <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreaming}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question..."
                  disabled={isStreaming}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  disabled={!input.trim() || isStreaming}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
