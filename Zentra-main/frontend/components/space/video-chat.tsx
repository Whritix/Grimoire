"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChatMarkdown } from "@/components/ui/chat-markdown"
import { Send, Bot, User, Sparkles } from "lucide-react"
import type { VideoChatMessage } from "@/lib/types"

interface VideoChatProps {
    messages: VideoChatMessage[]
    onSendMessage: (message: string) => void
    videoTitle: string
}

export function VideoChat({ messages, onSendMessage, videoTitle }: VideoChatProps) {
    const [input, setInput] = useState("")
    const [isTyping, setIsTyping] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
        }
    }, [messages, isTyping])

    const handleSend = () => {
        if (!input.trim()) return
        onSendMessage(input)
        setInput("")
        setIsTyping(true)
        setTimeout(() => setIsTyping(false), 2000)
    }

    const suggestions = [
        "Summarize this video",
        "Explain the key concepts",
        "What are the main takeaways?",
        "Create a practice quiz",
    ]

    return (
        <div className="h-[600px] flex flex-col rounded-2xl border border-border bg-card overflow-hidden shadow-lg">
            {/* Header */}
            <div className="shrink-0 p-4 border-b border-border bg-primary/5">
                <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <Bot className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm">AI Learning Assistant</h3>
                        <p className="text-xs text-muted-foreground truncate">
                            Helping you understand: {videoTitle}
                        </p>
                    </div>
                    <Sparkles className="h-4 w-4 text-primary animate-pulse shrink-0" />
                </div>
            </div>

            {/* Chat Messages - Scrollable area */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4"
                style={{ overflowY: 'auto' }}
            >
                <AnimatePresence mode="popLayout">
                    {messages.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center text-muted-foreground py-8"
                        >
                            <Bot className="h-12 w-12 mx-auto mb-3 text-primary/50" />
                            <p className="text-sm mb-4">Ask me anything about this video!</p>
                            <div className="space-y-2">
                                {suggestions.map((suggestion, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setInput(suggestion)}
                                        className="block w-full text-xs px-3 py-2 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors text-left"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    ) : (
                        messages.map((msg, idx) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                            >
                                {msg.role === "assistant" && (
                                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                                        <Bot className="h-4 w-4 text-primary-foreground" />
                                    </div>
                                )}
                                <div
                                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === "user"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted"
                                        }`}
                                >
                                    {msg.role === "assistant" ? (
                                        <ChatMarkdown content={msg.content} />
                                    ) : (
                                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                    )}
                                    {msg.relevantTimestamps && msg.relevantTimestamps.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-border/30">
                                            <p className="text-xs opacity-70 mb-1">Relevant timestamps:</p>
                                            <div className="flex flex-wrap gap-1">
                                                {msg.relevantTimestamps.map((ts, i) => (
                                                    <button
                                                        key={i}
                                                        className="text-xs px-2 py-1 rounded bg-background/20 hover:bg-background/40"
                                                    >
                                                        {Math.floor(ts / 60)}:{String(ts % 60).padStart(2, "0")}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {msg.role === "user" && (
                                    <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                                        <User className="h-4 w-4 text-accent-foreground" />
                                    </div>
                                )}
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>

                {isTyping && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex gap-3"
                    >
                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                            <Bot className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <div className="bg-muted rounded-2xl px-4 py-2">
                            <div className="flex gap-1">
                                <div className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" />
                                <div className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '0.1s' }} />
                                <div className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '0.2s' }} />
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Scroll anchor */}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 p-4 border-t border-border bg-background/50">
                <div className="flex gap-2">
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                        placeholder="Ask about the video..."
                        className="flex-1"
                    />
                    <Button
                        onClick={handleSend}
                        disabled={!input.trim()}
                        size="icon"
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
