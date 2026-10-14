"use client"

import { motion } from "framer-motion"

interface AssessmentProgressProps {
  current: number
  total: number
}

export function AssessmentProgress({ current, total }: AssessmentProgressProps) {
  const progress = (current / total) * 100

  return (
    <div className="mb-8 relative max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-medium text-muted-foreground bg-muted/30 px-3 py-1 rounded-full border border-border/50">
          Question {current} / <span className="text-foreground">{total}</span>
        </span>
        <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
          {Math.round(progress)}%
        </span>
      </div>
      <div className="h-3 rounded-full bg-muted/50 overflow-hidden shadow-inner backdrop-blur-sm border border-black/5 dark:border-white/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ type: "spring", damping: 20, stiffness: 100 }}
          className="h-full rounded-full bg-primary relative"
        >
          <div className="absolute inset-0 bg-white/20 animate-pulse" />
          <div className="absolute top-0 right-0 h-full w-2 bg-white/40 blur-[2px]" />
        </motion.div>
      </div>
      {/* Glow effect under the bar */}
      <div
        className="absolute bottom-0 left-0 h-4 bg-primary/20 blur-xl transition-all duration-500 rounded-full"
        style={{ width: `${progress}%`, opacity: progress > 0 ? 0.6 : 0 }}
      />
    </div>
  )
}
