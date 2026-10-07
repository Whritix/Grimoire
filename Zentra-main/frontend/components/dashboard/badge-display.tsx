"use client"

import { motion } from "framer-motion"
import { Award, Zap, Target, BookOpen, Star, Flame, Trophy, Lock, TrendingUp } from "lucide-react"
import { Progress } from "@/components/ui/progress"

interface BadgeDefinition {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string }>
  bgClass: string
  textClass: string
  description: string
  criteria: string
  checkEarned: (stats: UserStats) => boolean
  getProgress: (stats: UserStats) => { current: number; target: number; percent: number }
}

interface UserStats {
  lessons: number
  quizzes: number
  roadmaps: number
  avgScore: number
  streak?: number
  modulesCompleted?: number
  interviews?: number
}

// Badge definitions with real unlock criteria
const badgeDefinitions: BadgeDefinition[] = [
  {
    id: "1",
    name: "First Steps",
    icon: Star,
    bgClass: "bg-primary",
    textClass: "text-primary",
    description: "Started your learning journey",
    criteria: "Complete your first lesson",
    checkEarned: (stats) => stats.lessons >= 1,
    getProgress: (stats) => ({ current: Math.min(stats.lessons, 1), target: 1, percent: stats.lessons >= 1 ? 100 : 0 })
  },
  {
    id: "2",
    name: "Quick Learner",
    icon: Zap,
    bgClass: "bg-chart-4",
    textClass: "text-chart-4",
    description: "Completed 5 lessons",
    criteria: "Complete 5 lessons",
    checkEarned: (stats) => stats.lessons >= 5,
    getProgress: (stats) => ({ current: Math.min(stats.lessons, 5), target: 5, percent: Math.min((stats.lessons / 5) * 100, 100) })
  },
  {
    id: "3",
    name: "Quiz Master",
    icon: Target,
    bgClass: "bg-chart-5",
    textClass: "text-chart-5",
    description: "Completed 3 quizzes",
    criteria: "Complete 3 quizzes",
    checkEarned: (stats) => stats.quizzes >= 3,
    getProgress: (stats) => ({ current: Math.min(stats.quizzes, 3), target: 3, percent: Math.min((stats.quizzes / 3) * 100, 100) })
  },
  {
    id: "4",
    name: "Module Master",
    icon: BookOpen,
    bgClass: "bg-accent",
    textClass: "text-accent",
    description: "Completed 10 lessons",
    criteria: "Complete 10 lessons",
    checkEarned: (stats) => stats.lessons >= 10,
    getProgress: (stats) => ({ current: Math.min(stats.lessons, 10), target: 10, percent: Math.min((stats.lessons / 10) * 100, 100) })
  },
  {
    id: "5",
    name: "Goal Setter",
    icon: TrendingUp,
    bgClass: "bg-chart-3",
    textClass: "text-chart-3",
    description: "Created a learning roadmap",
    criteria: "Create 1 roadmap",
    checkEarned: (stats) => stats.roadmaps >= 1,
    getProgress: (stats) => ({ current: Math.min(stats.roadmaps, 1), target: 1, percent: stats.roadmaps >= 1 ? 100 : 0 })
  },
  {
    id: "6",
    name: "Champion",
    icon: Trophy,
    bgClass: "bg-chart-4",
    textClass: "text-chart-4",
    description: "Mastery achieved - 20 lessons complete",
    criteria: "Complete 20 lessons",
    checkEarned: (stats) => stats.lessons >= 20,
    getProgress: (stats) => ({ current: Math.min(stats.lessons, 20), target: 20, percent: Math.min((stats.lessons / 20) * 100, 100) })
  },
  {
    id: "7",
    name: "Interview Pro",
    icon: Award,
    bgClass: "bg-accent",
    textClass: "text-accent",
    description: "Completed interview practice",
    criteria: "Complete 1 interview",
    checkEarned: (stats) => (stats.interviews || 0) >= 1,
    getProgress: (stats) => ({ current: Math.min(stats.interviews || 0, 1), target: 1, percent: (stats.interviews || 0) >= 1 ? 100 : 0 })
  },
  {
    id: "8",
    name: "High Scorer",
    icon: Flame,
    bgClass: "bg-chart-4",
    textClass: "text-chart-4",
    description: "Score 80%+ on a quiz",
    criteria: "Score 80% or higher",
    checkEarned: (stats) => (stats.avgScore || 0) >= 80,
    getProgress: (stats) => ({ current: Math.min(stats.avgScore || 0, 80), target: 80, percent: Math.min(((stats.avgScore || 0) / 80) * 100, 100) })
  },
  {
    id: "9",
    name: "Dedicated",
    icon: Flame,
    bgClass: "bg-chart-5",
    textClass: "text-chart-5",
    description: "5 day learning streak",
    criteria: "Learn 5 days in a row",
    checkEarned: (stats) => (stats.streak || 0) >= 5,
    getProgress: (stats) => ({ current: Math.min(stats.streak || 0, 5), target: 5, percent: Math.min(((stats.streak || 0) / 5) * 100, 100) })
  },
]

interface BadgeDisplayProps {
  earnedCount?: number  // Legacy prop for backwards compatibility
  stats?: {
    lessons?: number
    quizzes?: number
    avg_score?: number
    difficulty_level?: string
  }
  roadmapCount?: number
}

export function BadgeDisplay({ earnedCount = 0, stats, roadmapCount = 0 }: BadgeDisplayProps) {
  // Build user stats from props
  const userStats: UserStats = {
    lessons: stats?.lessons || 0,
    quizzes: stats?.quizzes || 0,
    avgScore: stats?.avg_score || 0,
    roadmaps: roadmapCount,
    modulesCompleted: 0,
    streak: 0
  }

  // Compute which badges are earned
  const computedBadges = badgeDefinitions.map((badge) => ({
    ...badge,
    earned: badge.checkEarned(userStats),
    progress: badge.getProgress(userStats)
  }))

  const totalEarned = computedBadges.filter(b => b.earned).length

  // Find the next badge to unlock
  const nextBadge = computedBadges.find(b => !b.earned)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="relative h-full"
    >
      <div className="p-6 rounded-2xl bg-card border border-border shadow-sm h-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-accent/10">
              <Award className="h-4 w-4 text-accent" />
            </div>
            <h3 className="text-lg font-semibold text-foreground font-display">Achievements</h3>
          </div>
          <span className="text-sm text-muted-foreground px-2 py-1 rounded-full bg-muted">
            {totalEarned}/{badgeDefinitions.length}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {computedBadges.map((badge, index) => (
            <motion.div
              key={badge.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + index * 0.08, type: "spring", stiffness: 100 }}
              whileHover={badge.earned ? {
                scale: 1.1,
                rotate: [0, -5, 5, 0],
                transition: { duration: 0.3 }
              } : { scale: 1.02 }}
              className="relative group/badge"
              title={badge.earned ? `${badge.description} ✓` : `${badge.criteria} (${badge.progress.current}/${badge.progress.target})`}
            >
              <div
                className={`relative aspect-square rounded-xl flex flex-col items-center justify-center p-2 transition-all duration-300 ${badge.earned
                  ? `${badge.bgClass} cursor-pointer shadow-md`
                  : "bg-muted/30 border-2 border-dashed border-muted-foreground/20"
                  }`}
              >
                {badge.earned ? (
                  <>
                    <badge.icon className="h-6 w-6 text-white drop-shadow-sm" />
                    <span className="text-xs mt-1.5 text-center font-medium text-white/90">
                      {badge.name}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="relative">
                      <badge.icon className="h-6 w-6 text-muted-foreground/40" />
                      <Lock className="h-3 w-3 absolute -bottom-0.5 -right-0.5 text-muted-foreground/60" />
                    </div>
                    <span className="text-xs mt-1.5 text-center font-medium text-muted-foreground/50">
                      {badge.name}
                    </span>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Next badge unlock hint with progress */}
        {nextBadge && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <nextBadge.icon className="h-4 w-4 text-primary" />
              <p className="text-xs font-medium text-foreground">
                Next: <span className="text-primary">{nextBadge.name}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={nextBadge.progress.percent} className="h-1.5 flex-1" />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {nextBadge.progress.current}/{nextBadge.progress.target}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {nextBadge.criteria}
            </p>
          </div>
        )}

        {/* All badges earned celebration */}
        {totalEarned === badgeDefinitions.length && (
          <div className="mt-4 pt-4 border-t border-border/50 text-center">
            <p className="text-sm font-medium text-primary">
              Congratulations! All badges unlocked!
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
