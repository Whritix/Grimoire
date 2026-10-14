"use client"

import { motion } from "framer-motion"
import { BookOpen, MessageSquare, BarChart3, Trophy, Video, FileText } from "lucide-react"

const features = [
  {
    icon: BookOpen,
    title: "Live Lesson Viewer",
    description: "Watch curated YouTube content with AI-generated notes and resources fetched in real-time.",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: MessageSquare,
    title: "Doubt Assistant",
    description: "Chat with AI that understands your lesson context. Get instant help with streaming responses.",
    color: "bg-accent/10 text-accent",
  },
  {
    icon: Video,
    title: "Interview Simulator",
    description: "Practice with general, company-specific, or role-based interviews with real-time feedback.",
    color: "bg-chart-3/10 text-chart-3",
  },
  {
    icon: BarChart3,
    title: "Progress Dashboard",
    description: "Track your learning journey with beautiful charts and exportable PDF reports.",
    color: "bg-chart-4/10 text-chart-4",
  },
  {
    icon: Trophy,
    title: "Achievements & Badges",
    description: "Earn badges as you complete modules and hit milestones in your learning path.",
    color: "bg-chart-5/10 text-chart-5",
  },
  {
    icon: FileText,
    title: "Performance Reports",
    description: "Generate detailed PDF reports of your progress, strengths, and areas for improvement.",
    color: "bg-primary/10 text-primary",
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      damping: 14,
      stiffness: 120,
    },
  },
}

export function FeaturesSection() {
  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">
            Everything You Need to{" "}
            <span className="text-primary">Succeed</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-pretty">
            A complete learning ecosystem with adaptive assessments, personalized roadmaps, AI-powered assistance, and
            interview preparation tools.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={itemVariants}
              whileHover={{ y: -6, scale: 1.02 }}
              className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
            >
              <div
                className={`h-14 w-14 rounded-xl ${feature.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}
              >
                <feature.icon className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
