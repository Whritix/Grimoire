"use client"

import { motion, AnimatePresence } from "framer-motion"
import { User, Bot } from "lucide-react"

interface CaptionMessage {
    id: string
    type: "ai" | "user"
    text: string
}

interface CaptionDisplayProps {
    messages: CaptionMessage[]
    currentMessage?: string
}

export function CaptionDisplay({ messages, currentMessage }: CaptionDisplayProps) {
    const recentMessages = messages.slice(-3)

    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
            <div className="container mx-auto px-4 pb-8">
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="max-w-4xl mx-auto space-y-2"
                >
                    <AnimatePresence mode="popLayout">
                        {recentMessages.map((msg) => (
                            <motion.div
                                key={msg.id}
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: -20, opacity: 0 }}
                                className={`flex items-start gap-3 p-4 rounded-2xl backdrop-blur-xl border ${msg.type === "ai"
                                        ? "bg-primary/90 border-primary text-primary-foreground ml-12"
                                        : "bg-background/90 border-border mr-12"
                                    }`}
                            >
                                <div
                                    className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.type === "ai"
                                            ? "bg-primary-foreground/20"
                                            : "bg-primary/20"
                                        }`}
                                >
                                    {msg.type === "ai" ? (
                                        <Bot className="h-4 w-4" />
                                    ) : (
                                        <User className="h-4 w-4" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <span className="text-xs font-semibold opacity-70 uppercase">
                                        {msg.type === "ai" ? "AI:" : "You:"}
                                    </span>
                                    <p className="text-sm font-medium mt-1">{msg.text}</p>
                                </div>
                            </motion.div>
                        ))}

                        {currentMessage && (
                            <motion.div
                                key="current"
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="flex items-start gap-3 p-4 rounded-2xl backdrop-blur-xl bg-background/90 border border-border mr-12"
                            >
                                <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 bg-primary/20">
                                    <User className="h-4 w-4" />
                                </div>
                                <div className="flex-1">
                                    <span className="text-xs font-semibold opacity-70 uppercase">
                                        You:
                                    </span>
                                    <p className="text-sm font-medium mt-1">{currentMessage}</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        </div>
    )
}
