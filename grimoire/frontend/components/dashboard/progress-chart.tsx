"use client"

import { motion } from "framer-motion"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { TrendingUp } from "lucide-react"

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="px-4 py-3 bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-xl">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-lg font-bold text-primary">{payload[0].value}% complete</p>
      </div>
    )
  }
  return null
}

interface ProgressChartProps {
  data?: { day: string; progress: number }[]
  title?: string
  description?: string
  unit?: string
}

export function ProgressChart({
  data = [],
  title = "Weekly Progress",
  description = "Your learning activity over the last 7 days",
  unit = "%"
}: ProgressChartProps) {
  // Use default empty state if no data
  const chartData = data.length > 0 ? data : [
    { day: "Mon", progress: 0 },
    { day: "Tue", progress: 0 },
    { day: "Wed", progress: 0 },
    { day: "Thu", progress: 0 },
    { day: "Fri", progress: 0 },
    { day: "Sat", progress: 0 },
    { day: "Sun", progress: 0 },
  ]
  const latestProgress = chartData[chartData.length - 1]?.progress || 0
  const previousProgress = chartData.length > 1 ? chartData[chartData.length - 2].progress : 0
  const change = latestProgress - previousProgress

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="relative h-full"
    >
      <div className="p-6 rounded-2xl bg-card border border-border shadow-sm h-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground font-display">Weekly Progress</h3>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
            <TrendingUp className="h-3.5 w-3.5 text-green-500" />
            <span className="text-sm font-medium text-green-500">+{change}%</span>
          </div>
        </div>

        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="progressFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
              <XAxis
                dataKey="day"
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="progress"
                stroke="var(--primary)"
                strokeWidth={3}
                fill="url(#progressFill)"
                dot={{ fill: "var(--primary)", strokeWidth: 2, r: 4, stroke: "var(--card)" }}
                activeDot={{
                  r: 8,
                  fill: "var(--primary)",
                  stroke: "var(--card)",
                  strokeWidth: 3,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  )
}
