"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { MessageSquare, Send, Bot, User, Loader2 } from "lucide-react"
import { ChatMarkdown } from "@/components/ui/chat-markdown"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useUser } from "@clerk/nextjs"

interface Message {
  role: "user" | "assistant"
  content: string
}

export function DoubtAssistant() {
  const { user } = useUser()
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I'm your Doubt Assistant. Ask me anything about your current lesson or general programming concepts." }
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput("")
    setMessages(prev => [...prev, { role: "user", content: userMessage }])
    setIsLoading(true)

    try {
      // Construct context from current URL (simple context gathering)
      const currentUrl = typeof window !== 'undefined' ? window.location.href : ""
      
      const userId = user?.id
      if (!userId) {
        setMessages(prev => [...prev, { role: "assistant", content: "Please log in to use the Doubt Assistant." }])
        setIsLoading(false)
        return
      }

      const response = await fetch("http://localhost:8000/v1/agents/doubt-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer dev_token" // Assuming dev environment
        },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: userMessage }],
          user_id: userId,
          current_lesson: {
             // In a real app, we'd pass the actual lesson content here.
             // For now, passing the URL as context hint.
             title: "Current Page",
             content: `User is viewing: ${currentUrl}`
          },
          documents: [] // Can be populated if we have RAG documents context
        })
      })

      if (!response.ok) {
        throw new Error("Failed to fetch response")
      }

      const data = await response.json()
      
      // The backend returns a payload wrapped in our standard response format
      // data.payload.answer is the markdown content
      // Backend returns OpenAI-compatible format: { agent_output: { payload: { answer: "..." } } }
      const answer = data.agent_output?.payload?.answer || data.payload?.answer || "Sorry, I couldn't process that request."

      setMessages(prev => [...prev, { role: "assistant", content: answer }])
    } catch (error) {
      console.error("Doubt Assistant Error:", error)
      setMessages(prev => [...prev, { role: "assistant", content: "I encountered an error. Please try again." }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <MessageSquare className="h-4 w-4" />
          <span className="hidden md:inline">Chat Bot</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Doubt Assistant
          </SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="flex-1 p-4">
          <div className="flex flex-col gap-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${
                  message.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                    message.role === "user" 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {message.role === "user" ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                </div>
                <div
                  className={`rounded-lg px-3 py-2 max-w-[80%] ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <ChatMarkdown content={message.content} />
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Bot className="h-5 w-5" />
                </div>
                 <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                 </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-background">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}
