"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Send, CheckCircle, Loader2 } from "lucide-react"

interface InterviewPanelProps {
  question: string | null
  feedback: string | null
  onSubmitAnswer: (answer: string) => void
}

export function InterviewPanel({ question, feedback, onSubmitAnswer }: InterviewPanelProps) {
  const [answer, setAnswer] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!answer.trim()) return
    setIsSubmitting(true)
    await onSubmitAnswer(answer)
    setAnswer("")
    setIsSubmitting(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-6 rounded-2xl bg-card border border-border"
    >
      {question && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
            <p className="text-lg font-medium text-foreground">{question}</p>
          </div>

          <div>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer here..."
              rows={6}
              className="w-full p-4 rounded-xl bg-muted border border-border focus:border-primary focus:ring-1 focus:ring-primary resize-none transition-colors text-foreground"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!answer.trim() || isSubmitting}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Submit Answer
              </>
            )}
          </Button>
        </div>
      )}

      {feedback && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
            <CheckCircle className="h-6 w-6" />
            <h3 className="text-lg font-semibold">Interview Complete!</h3>
          </div>

          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
            <h4 className="font-medium text-foreground mb-2">Feedback</h4>
            <p className="text-muted-foreground">{feedback}</p>
          </div>
        </div>
      )}
    </motion.div>
  )
}
