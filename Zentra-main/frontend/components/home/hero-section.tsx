"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

function BotanicalBranchLeft({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 260"
      fill="none"
      stroke="#c88a8b"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M10 240 C 25 180, 50 120, 85 40" />
      <path d="M30 195 C 10 185, 4 165, 20 150 C 32 165, 34 185, 30 195 Z" />
      <path d="M30 195 L 14 162" strokeWidth="1" opacity="0.7" />
      <path d="M48 140 C 30 130, 24 110, 40 95 C 52 110, 52 130, 48 140 Z" />
      <path d="M48 140 L 34 107" strokeWidth="1" opacity="0.7" />
      <path d="M38 175 C 58 165, 78 175, 78 195 C 60 200, 45 190, 38 175 Z" />
      <path d="M38 175 L 68 188" strokeWidth="1" opacity="0.7" />
      <path d="M58 120 C 78 110, 98 120, 98 140 C 80 145, 65 135, 58 120 Z" />
      <path d="M58 120 L 88 133" strokeWidth="1" opacity="0.7" />
      <path d="M85 40 C 85 20, 95 10, 98 5 C 102 18, 100 32, 85 40 Z" />
    </svg>
  );
}

function BotanicalBranchRight({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 260"
      fill="none"
      stroke="#c88a8b"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M150 20 C 130 90, 105 160, 70 240" />
      <path d="M130 65 C 150 75, 156 95, 140 110 C 128 95, 126 75, 130 65 Z" />
      <path d="M130 65 L 146 98" strokeWidth="1" opacity="0.7" />
      <path d="M112 120 C 130 130, 136 150, 120 165 C 108 150, 108 130, 112 120 Z" />
      <path d="M112 120 L 126 153" strokeWidth="1" opacity="0.7" />
      <path d="M122 85 C 102 95, 82 85, 82 65 C 100 60, 115 70, 122 85 Z" />
      <path d="M122 85 L 92 72" strokeWidth="1" opacity="0.7" />
      <path d="M102 140 C 82 150, 62 140, 62 120 C 80 115, 95 125, 102 140 Z" />
      <path d="M102 140 L 72 127" strokeWidth="1" opacity="0.7" />
      <path d="M70 240 C 70 260, 60 270, 57 275 C 53 262, 55 248, 70 240 Z" />
    </svg>
  );
}

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-12 pb-20 md:pt-16 md:pb-28 bg-[#f6ede2]">
      {/* Background organic contour shapes */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none select-none">
        {/* Soft warm tan landscape hills */}
        <svg
          className="absolute bottom-0 left-0 w-full h-[320px] text-[#f2ddd0]/70"
          viewBox="0 0 1440 320"
          fill="currentColor"
          preserveAspectRatio="none"
        >
          <path d="M0,160 C320,80 520,240 840,180 C1160,120 1320,220 1440,160 L1440,320 L0,320 Z" />
        </svg>
        <svg
          className="absolute bottom-0 left-0 w-full h-[220px] text-[#edd4c5]/60"
          viewBox="0 0 1440 220"
          fill="currentColor"
          preserveAspectRatio="none"
        >
          <path d="M0,100 C360,180 680,60 1020,120 C1280,160 1380,80 1440,100 L1440,220 L0,220 Z" />
        </svg>

        {/* Sweeping contour line */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 1440 700"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M-50,420 C220,360 420,540 760,480 C1100,420 1260,560 1490,480"
            stroke="#e5cdbe"
            strokeWidth="1.5"
            strokeDasharray="4 2"
            opacity="0.6"
          />
        </svg>

        {/* Top right gentle hill tint */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#ebd6c8]/40 blur-3xl" />
      </div>

      {/* Botanical branch on left */}
      <BotanicalBranchLeft className="absolute left-2 md:left-8 top-1/2 -translate-y-1/2 w-28 sm:w-40 md:w-56 lg:w-64 opacity-80 pointer-events-none select-none" />

      {/* Botanical branch on right */}
      <BotanicalBranchRight className="absolute right-2 md:right-8 top-1/2 -translate-y-1/2 w-28 sm:w-40 md:w-56 lg:w-64 opacity-80 pointer-events-none select-none" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-4xl mx-auto"
        >
          {/* Top Pill Badge */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#edd3cb] border border-[#e4c2b8] mb-6 shadow-sm"
          >
            <span className="text-[#8a4440] text-xs">✦</span>
            <span className="text-xs md:text-sm font-medium text-[#8a4440] tracking-wide">
              AI-Powered Adaptive Learning
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-serif font-bold tracking-tight mb-5 text-balance leading-[1.12]"
          >
            <span className="text-[#250d06] block">Master Your Skills with</span>
            <span className="text-[#bd7877] block mt-1">Personalized Learning</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-sm sm:text-base md:text-lg text-[#5e453e] mb-8 max-w-2xl mx-auto leading-relaxed"
          >
            Take a 15-question adaptive assessment, get a personalized roadmap,
            <br className="hidden sm:inline" /> learn with AI-enhanced content, and ace your interviews.
          </motion.p>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex flex-col sm:flex-row gap-3.5 justify-center items-center"
          >
            <Button
              asChild
              size="lg"
              className="bg-[#e3935c] text-[#250d06] hover:bg-[#d6854e] font-medium px-7 py-3 rounded-lg shadow-sm hover:shadow transition-all group border-0 text-sm md:text-base h-11"
            >
              <Link href="/assessment" className="flex items-center gap-2">
                <span>Start Assessment</span>
                <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border border-[#cbb8aa] bg-transparent text-[#3a2520] hover:bg-[#ebd9ce]/50 font-medium px-7 py-3 rounded-lg transition-all text-sm md:text-base h-11 shadow-none"
            >
              <Link href="/dashboard">View Dashboard</Link>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
