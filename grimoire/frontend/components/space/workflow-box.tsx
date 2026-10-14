"use client"

import { motion } from "framer-motion"
import { Sparkles, Video, MessageSquare, Award } from "lucide-react"

export function WorkflowBox() {
    const steps = [
        {
            icon: Video,
            number: 1,
            title: "Paste URL",
            description: "Add any YouTube video or playlist link",
        },
        {
            icon: Sparkles,
            number: 2,
            title: "AI Analysis",
            description: "Our AI understands the content",
        },
        {
            icon: MessageSquare,
            number: 3,
            title: "Chat & Learn",
            description: "Ask questions and get instant answers",
        },
        {
            icon: Award,
            number: 4,
            title: "Test Knowledge",
            description: "Generate quizzes to verify understanding",
        },
    ]

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 rounded-2xl bg-primary/5 border border-primary/20"
        >
            <h2 className="text-xl font-bold font-display mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                How It Works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {steps.map((step, idx) => (
                    <motion.div
                        key={step.number}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="relative"
                    >
                        <div className="flex flex-col items-center text-center p-4 rounded-xl bg-background/50 hover:bg-background/80 transition-colors">
                            <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center mb-3">
                                <step.icon className="h-6 w-6 text-primary-foreground" />
                            </div>
                            <div className="absolute top-2 left-2 h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                                <span className="text-xs font-bold text-primary">{step.number}</span>
                            </div>
                            <h3 className="font-semibold mb-1">{step.title}</h3>
                            <p className="text-xs text-muted-foreground">{step.description}</p>
                        </div>
                        {idx < steps.length - 1 && (
                            <div className="hidden md:block absolute top-10 -right-2 w-4 h-0.5 bg-primary/30" />
                        )}
                    </motion.div>
                ))}
            </div>
        </motion.div>
    )
}
