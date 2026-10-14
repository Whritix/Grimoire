"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ChevronDown, 
  ChevronRight, 
  AlertTriangle, 
  HelpCircle, 
  Lightbulb,
  Target,
  Clock,
  BookOpen
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface TopicPriority {
  topic: string
  why_important?: string
  why_skippable?: string
  required_depth?: string
  key_points?: string[]
}

interface AnalysisResult {
  high_priority: TopicPriority[]
  medium_priority: TopicPriority[]
  low_priority: TopicPriority[]
  common_mistakes: string[]
  questions: string[]
  summary: string
  goal: string
}

interface AnalysisOutputProps {
  result: AnalysisResult | null
  isLoading?: boolean
}

const GOAL_LABELS: Record<string, string> = {
  exam_prep: "Exam Preparation",
  interview_prep: "Interview Preparation",
  quick_revision: "Quick Revision",
  concept_mastery: "Concept Mastery"
}

const DEPTH_COLORS: Record<string, string> = {
  beginner: "bg-green-500/10 text-green-600 border-green-500/20",
  intermediate: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  advanced: "bg-red-500/10 text-red-600 border-red-500/20"
}

function CollapsibleSection({ 
  title, 
  icon: Icon, 
  children, 
  defaultOpen = true,
  badge,
  badgeVariant = "default"
}: { 
  title: string
  icon: React.ElementType
  children: React.ReactNode
  defaultOpen?: boolean
  badge?: string | number
  badgeVariant?: "default" | "secondary" | "destructive" | "outline"
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen)

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-primary" />
          <span className="font-semibold">{title}</span>
          {badge !== undefined && (
            <Badge variant={badgeVariant} className="ml-2">
              {badge}
            </Badge>
          )}
        </div>
        {isOpen ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 space-y-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TopicCard({ topic, priority }: { topic: TopicPriority; priority: "high" | "medium" | "low" }) {
  const priorityStyles = {
    high: "border-l-4 border-l-red-500",
    medium: "border-l-4 border-l-yellow-500",
    low: "border-l-4 border-l-green-500"
  }

  return (
    <Card className={cn("p-4", priorityStyles[priority])}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-foreground mb-1">{topic.topic}</h4>
          {topic.why_important && (
            <p className="text-sm text-muted-foreground">{topic.why_important}</p>
          )}
          {topic.why_skippable && (
            <p className="text-sm text-muted-foreground italic">{topic.why_skippable}</p>
          )}
          {topic.key_points && topic.key_points.length > 0 && (
            <ul className="mt-2 space-y-1">
              {topic.key_points.map((point, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {topic.required_depth && (
          <Badge 
            variant="outline" 
            className={cn("shrink-0 capitalize", DEPTH_COLORS[topic.required_depth] || "")}
          >
            {topic.required_depth}
          </Badge>
        )}
      </div>
    </Card>
  )
}

export function AnalysisOutput({ result, isLoading }: AnalysisOutputProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-primary">
          <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="font-medium">Analyzing your notes...</span>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!result) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Summary Header */}
      <Card className="p-6 bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-primary/10">
            <Target className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-bold">Analysis Complete</h3>
              <Badge variant="secondary">{GOAL_LABELS[result.goal] || result.goal}</Badge>
            </div>
            <p className="text-muted-foreground">{result.summary}</p>
          </div>
        </div>
      </Card>

      {/* High Priority Topics */}
      {result.high_priority.length > 0 && (
        <CollapsibleSection 
          title="High Priority Topics" 
          icon={Target}
          badge={result.high_priority.length}
          badgeVariant="destructive"
        >
          <p className="text-sm text-muted-foreground mb-3">
            Focus on these topics first — they are critical for your {GOAL_LABELS[result.goal]?.toLowerCase() || "goal"}.
          </p>
          {result.high_priority.map((topic, i) => (
            <TopicCard key={i} topic={topic} priority="high" />
          ))}
        </CollapsibleSection>
      )}

      {/* Medium Priority Topics */}
      {result.medium_priority.length > 0 && (
        <CollapsibleSection 
          title="Medium Priority Topics" 
          icon={Clock}
          badge={result.medium_priority.length}
          defaultOpen={false}
        >
          <p className="text-sm text-muted-foreground mb-3">
            Cover these if time permits — they add depth to your understanding.
          </p>
          {result.medium_priority.map((topic, i) => (
            <TopicCard key={i} topic={topic} priority="medium" />
          ))}
        </CollapsibleSection>
      )}

      {/* Low Priority Topics */}
      {result.low_priority.length > 0 && (
        <CollapsibleSection 
          title="Low Priority / Skippable" 
          icon={BookOpen}
          badge={result.low_priority.length}
          badgeVariant="outline"
          defaultOpen={false}
        >
          <p className="text-sm text-muted-foreground mb-3">
            These can be skimmed or skipped without significant impact.
          </p>
          {result.low_priority.map((topic, i) => (
            <TopicCard key={i} topic={topic} priority="low" />
          ))}
        </CollapsibleSection>
      )}

      {/* Common Mistakes */}
      {result.common_mistakes.length > 0 && (
        <CollapsibleSection 
          title="Common Mistakes to Avoid" 
          icon={AlertTriangle}
          badge={result.common_mistakes.length}
          badgeVariant="secondary"
        >
          <ul className="space-y-2">
            {result.common_mistakes.map((mistake, i) => (
              <li key={i} className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
                <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                <span className="text-sm">{mistake}</span>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {/* Goal-Specific Questions */}
      {result.questions.length > 0 && (
        <CollapsibleSection 
          title={
            result.goal === "exam_prep" ? "Likely Exam Questions" :
            result.goal === "interview_prep" ? "Interview Questions" :
            result.goal === "quick_revision" ? "Self-Check Questions" :
            "Deep Understanding Questions"
          }
          icon={HelpCircle}
          badge={result.questions.length}
        >
          <ul className="space-y-2">
            {result.questions.map((question, i) => (
              <li key={i} className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm">{question}</span>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}
    </motion.div>
  )
}
