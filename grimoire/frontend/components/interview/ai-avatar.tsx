"use client"

import { motion } from "framer-motion"
import { Bot } from "lucide-react"

interface AIAvatarProps {
    isActive?: boolean
    isSpeaking?: boolean
}

export function AIAvatar({ isActive = false, isSpeaking = false }: AIAvatarProps) {
    return (
        <motion.div
            className="relative flex items-center justifycenter"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 15 }}
        >
            {/* Outer glow ring */}
            <motion.div
                className="absolute inset-0 rounded-full bg-primary/30 blur-xl"
                animate={{
                    scale: isSpeaking ? [1, 1.2, 1] : 1,
                }}
                transition={{
                    duration: 1.5,
                    repeat: isSpeaking ? Infinity : 0,
                    ease: "easeInOut",
                }}
            />

            {/* Avatar container */}
            <motion.div
                className="relative h-32 w-32 rounded-full bg-primary flex items-center justify-center shadow-2xl"
                animate={{
                    boxShadow: isSpeaking
                        ? [
                            "0 0 20px rgba(var(--primary), 0.5)",
                            "0 0 40px rgba(var(--primary), 0.8)",
                            "0 0 20px rgba(var(--primary), 0.5)",
                        ]
                        : "0 0 20px rgba(var(--primary), 0.3)",
                }}
                transition={{
                    duration: 1.5,
                    repeat: isSpeaking ? Infinity : 0,
                }}
            >
                <Bot className="h-16 w-16 text-primary-foreground" />
            </motion.div>

            {/* Active indicator */}
            {isActive && (
                <motion.div
                    className="absolute bottom-2 right-2 h-4 w-4 rounded-full bg-green-500 border-2 border-background"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                >
                    <motion.div
                        className="h-full w-full rounded-full bg-green-500"
                        animate={{
                            opacity: [1, 0.5, 1],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                        }}
                    />
                </motion.div>
            )}
        </motion.div>
    )
}
