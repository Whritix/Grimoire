"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Pause, Play, Zap } from "lucide-react"

const updates = [
  "New interview question added: System Design basics",
  "User achieved 'Quick Learner' badge",
  "New lesson: Advanced React Patterns",
  "Interview success rate increased by 15%",
  "1000+ users completed assessments today",
]

export function Marquee() {
  const [isPaused, setIsPaused] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (isPaused) return
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % updates.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [isPaused])

  return (
    <div className="bg-primary py-2">
      <div className="container mx-auto px-4 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden flex-1">
          <Zap className="h-4 w-4 text-primary-foreground shrink-0" />
          <AnimatePresence mode="wait">
            <motion.span
              key={currentIndex}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="text-sm text-primary-foreground font-medium truncate"
            >
              {updates[currentIndex]}
            </motion.span>
          </AnimatePresence>
        </div>

        <button
          onClick={() => setIsPaused(!isPaused)}
          className="p-1 rounded hover:bg-primary-foreground/20 transition-colors ml-2"
          aria-label={isPaused ? "Resume updates" : "Pause updates"}
        >
          {isPaused ? (
            <Play className="h-4 w-4 text-primary-foreground" />
          ) : (
            <Pause className="h-4 w-4 text-primary-foreground" />
          )}
        </button>
      </div>
    </div>
  )
}
