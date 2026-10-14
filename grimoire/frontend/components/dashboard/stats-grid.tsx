"use client"

import { motion } from "framer-motion"
import { BookOpen, Clock, Trophy, Target, TrendingUp } from "lucide-react"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 100 }
  },
}

// Map color names to actual classes
const colorClasses: Record<string, { bg: string; text: string }> = {
  primary: { bg: "bg-primary/10", text: "text-primary" },
  accent: { bg: "bg-accent/10", text: "text-accent" },
  "chart-3": { bg: "bg-chart-3/10", text: "text-chart-3" },
  "chart-4": { bg: "bg-chart-4/10", text: "text-chart-4" },
  "chart-5": { bg: "bg-chart-5/10", text: "text-chart-5" },
}

export function StatsGrid({ stats = [] }: { stats?: any[] }) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 lg:grid-cols-4 gap-4"
    >
      {stats.map((stat, index) => {
        const colors = colorClasses[stat.color] || colorClasses.primary
        return (
          <motion.div
            key={stat.label}
            variants={itemVariants}
            whileHover={{ y: -6, scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="relative group cursor-pointer"
          >
            <div className="relative p-6 rounded-2xl bg-card border border-border hover:border-primary/30 shadow-sm hover:shadow-lg transition-all duration-300">
              <div className="relative">
                <div className={`h-12 w-12 rounded-xl ${colors.bg} flex items-center justify-center mb-4`}>
                  <stat.icon className={`h-6 w-6 ${colors.text}`} />
                </div>

                <motion.p
                  className="text-3xl font-bold text-foreground font-display"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                >
                  {stat.value}
                </motion.p>

                <div className="flex items-center justify-between mt-1">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <TrendingUp className="h-4 w-4 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
