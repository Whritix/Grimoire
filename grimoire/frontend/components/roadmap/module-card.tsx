"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Clock, BookOpen, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { RoadmapModule } from "@/lib/types"

interface ModuleCardProps {
  module: RoadmapModule
}

export function ModuleCard({ module }: ModuleCardProps) {
  // Use 'lessons' from strict schema, fallback to 'resources' for legacy data
  const lessons = module.lessons || (module as any).resources || []

  // Calculate total time strictly using numbers
  const totalTime = lessons.reduce((acc: number, lesson: any) => {
    // Prefer 'estMin' (from new schema) -> 'duration' -> default 15
    const duration = parseInt(String(lesson.estMin || lesson.duration || 15), 10)
    return acc + (isNaN(duration) ? 15 : duration)
  }, 0)

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 relative overflow-hidden"
    >
      <div className="relative z-10">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="flex-1">
            <h3 className="text-xl font-bold font-display text-foreground mb-2 group-hover:text-primary transition-colors">{module.title}</h3>
            <p className="text-muted-foreground text-sm mb-4 leading-relaxed">{module.outcome || module.description || "Master this module to advance your skills."}</p>

            <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground mb-5 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-primary/70" />
                {lessons.length} lessons
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-accent/70" />
                ~{totalTime} min
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {lessons.slice(0, 3).map((lesson: any) => (
                <span key={lesson.id || lesson.title} className="px-3 py-1 text-xs rounded-lg bg-background border border-border/50 text-muted-foreground group-hover:border-primary/20 transition-colors">
                  {lesson.title}
                </span>
              ))}
              {lessons.length > 3 && (
                <span className="px-3 py-1 text-xs rounded-lg bg-primary/10 text-primary border border-primary/20">
                  +{lessons.length - 3} more
                </span>
              )}
            </div>
          </div>

          <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shrink-0 rounded-xl group/btn">
            <Link href={`/lesson/${lessons[0]?.id || "1"}?topic=${encodeURIComponent(module.title)}&context=${encodeURIComponent(module.title)}`}>
              Start Module
              <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
