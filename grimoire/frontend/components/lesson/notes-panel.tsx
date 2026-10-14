"use client"

import { motion } from "framer-motion"
import { Sparkles } from "lucide-react"
import { ChatMarkdown } from "@/components/ui/chat-markdown"

interface NotesPanelProps {
  notes: string
}

export function NotesPanel({ notes }: NotesPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 rounded-2xl bg-card border border-border"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-linear-to-br from-primary/20 to-accent/20">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <h3 className="font-semibold text-foreground">AI-Generated Notes</h3>
      </div>

      <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
        <ChatMarkdown content={notes} />
      </div>
    </motion.div>
  )
}

