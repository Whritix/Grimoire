"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Building2, User, Briefcase, Play } from "lucide-react"
import type { InterviewMode } from "@/app/interview/page"

interface InterviewControlsProps {
  mode: InterviewMode
  onModeChange: (mode: InterviewMode) => void
  onStart: () => void
  isActive: boolean
}

const modes = [
  { id: "general" as const, label: "General", icon: User },
  { id: "company" as const, label: "Company-Specific", icon: Building2 },
  { id: "role" as const, label: "Role-Based", icon: Briefcase },
]

export function InterviewControls({ mode, onModeChange, onStart, isActive }: InterviewControlsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-2xl bg-card border border-border mb-6"
    >
      <h3 className="font-semibold text-foreground mb-4">Select Interview Mode</h3>

      <div className="flex flex-wrap gap-3 mb-6">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => onModeChange(m.id)}
            disabled={isActive}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${
              mode === m.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-foreground border-border hover:border-primary/50"
            } ${isActive ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <m.icon className="h-4 w-4" />
            <span className="font-medium">{m.label}</span>
          </button>
        ))}
      </div>

      <Button
        onClick={onStart}
        disabled={isActive}
        size="lg"
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
      >
        <Play className="h-4 w-4" />
        {isActive ? "Interview in Progress..." : "Start Interview"}
      </Button>
    </motion.div>
  )
}
