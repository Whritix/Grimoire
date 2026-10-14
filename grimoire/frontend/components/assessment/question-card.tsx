"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ChatMarkdown } from "@/components/ui/chat-markdown"
import type { Question } from "@/lib/types"
import { Loader2, ArrowRight } from "lucide-react"

interface QuestionCardProps {
  question: Question
  onAnswer: (choice: string) => void
  onSkip: () => void
  isSubmitting: boolean
}

export function QuestionCard({ question, onAnswer, onSkip, isSubmitting }: QuestionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -20 }}
      transition={{ type: "spring", damping: 25, stiffness: 120 }}
      className="relative group max-w-2xl mx-auto"
    >
      {/* Decorative background glow */}
      <div className="absolute -inset-1 bg-primary/10 rounded-3xl blur-2xl opacity-50 group-hover:opacity-75 transition-opacity duration-500 -z-10" />

      <div className="p-8 md:p-10 rounded-3xl bg-card/80 backdrop-blur-xl border border-white/10 shadow-2xl relative overflow-hidden">
        {/* Subtle texture overlay */}
        <div className="absolute inset-0 bg-grid-white/5 pointer-events-none" />

        <div className="relative z-10">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 shadow-sm uppercase tracking-wider">
                {question.category}
              </span>
              <span className="text-xs text-muted-foreground/60 font-mono">ID: {question.id.slice(0, 6)}</span>
            </div>

            <div className="text-xl md:text-2xl font-bold text-foreground font-display leading-tight">
              <ChatMarkdown content={question.text} className="prose-lg" />
            </div>
          </div>

          <div className="space-y-4">
            {(!question.type || question.type === 'mcq') && (
              <>
                <div className="space-y-4">
                  {question.choices?.map((option, index) => (
                    <motion.div
                      key={`${question.id}-option-${index}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + (index * 0.1) }}
                    >
                      <button
                        onClick={() => onAnswer(option)}
                        disabled={isSubmitting}
                        className="w-full text-left group/btn relative overflow-hidden rounded-xl bg-background/50 hover:bg-background/80 border border-border/50 hover:border-primary/50 transition-all duration-300 p-1"
                      >
                        <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />

                        <div className="relative flex items-center p-4">
                          <div className="shrink-0 w-10 h-10 rounded-lg bg-muted/80 group-hover/btn:bg-primary group-hover/btn:text-white flex items-center justify-center text-sm font-bold transition-all duration-300 shadow-sm border border-border/50 group-hover/btn:border-primary/50 mr-4">
                            {String.fromCharCode(65 + index)}
                          </div>
                          <div className="flex-1 text-foreground/90 font-medium group-hover/btn:text-foreground text-base">
                            <ChatMarkdown content={option} className="prose-sm [&_p]:mb-0" />
                          </div>
                          <ArrowRight className="ml-auto w-5 h-5 opacity-0 -translate-x-4 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all duration-300 text-primary" />
                        </div>
                      </button>
                    </motion.div>
                  ))}
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    variant="ghost"
                    onClick={onSkip}
                    disabled={isSubmitting}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Skip Question
                  </Button>
                </div>
              </>
            )}

            {/* Support for text input for open-ended questions */}
            {(question.type === 'short' || question.type === 'code') && (
              <div className="space-y-6">
                <div className="relative">
                  <textarea
                    className="flex min-h-[160px] w-full rounded-xl border border-white/10 bg-black/5 dark:bg-white/5 px-4 py-4 text-base shadow-inner placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50 resize-y transition-all"
                    placeholder={question.type === 'code' ? "// Write your code here..." : "Type your detailed answer here..."}
                    style={{ fontFamily: question.type === 'code' ? 'monospace' : 'inherit' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.ctrlKey) {
                        const val = (e.target as HTMLTextAreaElement).value;
                        if (val.trim()) onAnswer(val);
                      }
                    }}
                    id={`answer-${question.id}`}
                  />
                  <div className="absolute bottom-3 right-3 text-xs text-muted-foreground bg-background/50 px-2 py-1 rounded backdrop-blur-sm">
                    Ctrl + Enter to submit
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    className="flex-1 h-12 text-lg font-medium border-border/50 hover:bg-muted/50 transition-all"
                    onClick={onSkip}
                    disabled={isSubmitting}
                  >
                    Skip
                  </Button>
                  <Button
                    className="flex-2 h-12 text-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg transition-all"
                    onClick={() => {
                      const el = document.getElementById(`answer-${question.id}`) as HTMLTextAreaElement;
                      if (el && el.value.trim()) onAnswer(el.value);
                    }}
                    disabled={isSubmitting}
                  >
                    Submit Answer
                  </Button>
                </div>
              </div>
            )}
          </div>

          {isSubmitting && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-8 flex items-center justify-center gap-3 text-muted-foreground p-4 bg-muted/20 rounded-xl"
            >
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="font-medium">Analyzing your responses...</span>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
