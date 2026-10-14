"use client"

import { motion } from "framer-motion"

interface LessonPlayerProps {
  videoId: string
}

export function LessonPlayer({ videoId }: LessonPlayerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl overflow-hidden bg-card border border-border aspect-video"
    >
      <iframe
        src={`https://www.youtube.com/embed/${videoId}`}
        title="Lesson video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full"
      />
    </motion.div>
  )
}
