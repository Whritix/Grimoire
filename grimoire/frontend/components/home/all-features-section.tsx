"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import {
    Target,
    BookOpen,
    Users,
    FileText,
    Video,
    GraduationCap,
    MessageSquare,
    Trophy,
    Sparkles,
    TrendingUp,
} from "lucide-react"

const heroCards = [
    {
        icon: Target,
        title: "Practice & Assess",
        href: "/assessment",
    },
    {
        icon: BookOpen,
        title: "Personalized Roadmap",
        href: "/roadmap",
    },
    {
        icon: Users,
        title: "Interview Preparation",
        href: "/interview",
    },
    {
        icon: FileText,
        title: "Notes & Resources",
        href: "/notes",
    },
]

const additionalFeatures = [
    {
        icon: Video,
        title: "Space - AI Video Learning",
        description: "Learn from YouTube videos with an AI companion that understands the content and helps you master concepts faster.",
        href: "/space",
        badge: "Popular"
    },
    {
        icon: MessageSquare,
        title: "24/7 Doubt Assistant",
        description: "Stuck on a concept? Ask our AI assistant anytime. Get instant, contextual answers with code examples.",
        href: "/chat",
        badge: null
    },
    {
        icon: Trophy,
        title: "Achievement Badges",
        description: "Earn verified badges as you progress. Track your milestones and share credentials.",
        href: "/dashboard",
        badge: null
    },
    {
        icon: TrendingUp,
        title: "Progress Analytics",
        description: "Visualize your learning journey with detailed metrics, completion rates, and skill development graphs.",
        href: "/dashboard",
        badge: null
    },
]

export function AllFeaturesSection() {
    return (
        <section className="pt-6 pb-20 bg-gradient-to-b from-[#f6ede2] via-[#faf3ec] to-[#f6ede2]">
            <div className="container mx-auto px-4 max-w-6xl">
                {/* Floating New Badge on Left */}
                <div className="flex items-center justify-between mb-3">
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#edd3cb] border border-[#e4c2b8] shadow-xs"
                    >
                        <span className="text-[#8a4440] text-xs">✦</span>
                        <span className="text-xs font-medium text-[#8a4440] tracking-wide">
                            New
                        </span>
                    </motion.div>
                </div>

                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-8"
                >
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold mb-3 tracking-tight">
                        <span className="text-[#250d06]">Everything You Need to </span>
                        <span className="text-[#bd7877]">Excel</span>
                    </h2>
                    <p className="text-sm sm:text-base text-[#66504a] max-w-xl mx-auto">
                        Our AI-powered platform provides comprehensive tools to accelerate your learning.
                    </p>
                </motion.div>

                {/* 4 Hero Cards matching the screenshot */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
                    {heroCards.map((card, idx) => (
                        <motion.div
                            key={card.title}
                            initial={{ opacity: 0, y: 15 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.06 }}
                        >
                            <Link href={card.href} className="block group">
                                <div className="h-full p-4 rounded-xl bg-[#fcf8f3] hover:bg-[#ffffff] border border-[#efe1d4] shadow-xs hover:shadow-md hover:border-[#e3935c]/50 transition-all cursor-pointer flex items-center gap-3.5">
                                    <div className="h-11 w-11 shrink-0 rounded-full bg-[#edc2bc] flex items-center justify-center text-[#8c4642] group-hover:scale-105 transition-transform shadow-xs">
                                        <card.icon className="h-5 w-5" strokeWidth={1.8} />
                                    </div>
                                    <h3 className="font-medium text-sm md:text-[15px] text-[#250d06] group-hover:text-[#bd7877] transition-colors leading-snug">
                                        {card.title}
                                    </h3>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>

                {/* Extended Learning Modules */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 pt-6 border-t border-[#efe1d4]">
                    {additionalFeatures.map((feature, idx) => (
                        <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, y: 15 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.05 }}
                        >
                            <Link href={feature.href} className="block h-full group">
                                <div className="h-full p-5 rounded-xl bg-[#fcf8f3] border border-[#efe1d4] hover:border-[#e3935c]/40 hover:shadow-md transition-all flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="h-9 w-9 rounded-lg bg-[#edd3cb] flex items-center justify-center text-[#8c4642]">
                                                <feature.icon className="h-4 w-4" />
                                            </div>
                                            {feature.badge && (
                                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#edd3cb] text-[#8a4440] font-medium">
                                                    {feature.badge}
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="font-medium text-sm text-[#250d06] mb-1.5 group-hover:text-[#bd7877] transition-colors">
                                            {feature.title}
                                        </h4>
                                        <p className="text-xs text-[#66504a] leading-relaxed">
                                            {feature.description}
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
