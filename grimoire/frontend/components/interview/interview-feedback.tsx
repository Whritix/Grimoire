"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Award, TrendingUp, AlertCircle, CheckCircle2, RotateCcw } from "lucide-react"
import type { InterviewFeedback as IFeedback } from "@/lib/types"

interface InterviewFeedbackProps {
    feedback: IFeedback
    onRestart: () => void
}

export function InterviewFeedback({ feedback, onRestart }: InterviewFeedbackProps) {
    const getFeedbackColor = (score: number) => {
        if (score >= 80) return "text-green-500"
        if (score >= 60) return "text-yellow-500"
        return "text-orange-500"
    }

    const categories = [
        { key: "communication", label: "Communication", icon: "💬" },
        { key: "technical", label: "Technical Skills", icon: "💻" },
        { key: "confidence", label: "Confidence", icon: "🎯" },
        { key: "problemSolving", label: "Problem Solving", icon: "🧩" },
    ] as const

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-4xl mx-auto"
        >
            {/* Overall Score */}
            <div className="p-8 rounded-2xl bg-card border border-border mb-6 text-center">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.2 }}
                    className="inline-flex h-24 w-24 rounded-full bg-primary items-center justify-center mb-4"
                >
                    <span className="text-3xl font-bold text-primary-foreground">
                        {feedback.overallScore}
                    </span>
                </motion.div>
                <h2 className="text-2xl font-bold mb-2">Interview Complete!</h2>
                <p className="text-muted-foreground">
                    Here's your detailed performance analysis
                </p>
            </div>

            {/* Category Scores */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {categories.map((category, idx) => {
                    const feedbackData = feedback.feedback[category.key]
                    if (!feedbackData) return null

                    return (
                        <motion.div
                            key={category.key}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 + idx * 0.1 }}
                            className="p-6 rounded-xl bg-card border border-border"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl">{category.icon}</span>
                                    <span className="font-semibold">{category.label}</span>
                                </div>
                                <span className={`text-lg font-bold ${getFeedbackColor(feedbackData.score)}`}>
                                    {feedbackData.score}%
                                </span>
                            </div>
                            <Progress value={feedbackData.score} className="mb-3" />
                            <p className="text-sm text-muted-foreground">{feedbackData.comments}</p>
                        </motion.div>
                    )
                })}
            </div>

            {/* Strengths & Improvements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="p-6 rounded-xl bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center gap-2 mb-4">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <h3 className="font-semibold text-green-600 dark:text-green-400">Strengths</h3>
                    </div>
                    <ul className="space-y-2">
                        {feedback.strengths.map((strength, idx) => (
                            <li key={idx} className="text-sm flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">✓</span>
                                <span>{strength}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="p-6 rounded-xl bg-orange-500/10 border border-orange-500/20">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="h-5 w-5 text-orange-500" />
                        <h3 className="font-semibold text-orange-600 dark:text-orange-400">Areas to Improve</h3>
                    </div>
                    <ul className="space-y-2">
                        {feedback.improvements.map((improvement, idx) => (
                            <li key={idx} className="text-sm flex items-start gap-2">
                                <span className="text-orange-500 mt-0.5">→</span>
                                <span>{improvement}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
                <Button variant="outline" onClick={onRestart} className="flex-1">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Practice Another Interview
                </Button>
                <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                    <Award className="mr-2 h-4 w-4" />
                    Download Report
                </Button>
            </div>
        </motion.div>
    )
}
