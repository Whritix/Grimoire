"use client"

import { useRef, useEffect } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import Lenis from "@studio-freight/lenis"
import { ModuleCard } from "./module-card"
import type { RoadmapModule } from "@/lib/types"

gsap.registerPlugin(ScrollTrigger)

interface RoadmapStepperProps {
  modules: RoadmapModule[]
}

export function RoadmapStepper({ modules }: RoadmapStepperProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const moduleRefs = useRef<(HTMLDivElement | null)[]>([])
  const progressLineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Initialize Lenis for smooth scrolling
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
    })

    // Connect Lenis to GSAP ScrollTrigger
    lenis.on("scroll", ScrollTrigger.update)

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000)
    })

    gsap.ticker.lagSmoothing(0)

    // Animate the progress line based on scroll progress
    if (progressLineRef.current && containerRef.current) {
      gsap.fromTo(
        progressLineRef.current,
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: "none",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 60%",
            end: "bottom 40%",
            scrub: 0.5,
          },
        }
      )
    }

    // Animate each module card as it enters the viewport
    moduleRefs.current.forEach((moduleEl, index) => {
      if (!moduleEl) return

      const stepIndicator = moduleEl.querySelector(".step-indicator")
      const cardContent = moduleEl.querySelector(".card-content")

      // Set initial state
      gsap.set(moduleEl, { opacity: 0, y: 60 })
      if (stepIndicator) {
        gsap.set(stepIndicator, { scale: 0, opacity: 0 })
      }

      // Create scroll-triggered animation
      gsap.to(moduleEl, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: moduleEl,
          start: "top 85%",
          end: "top 50%",
          toggleActions: "play none none reverse",
        },
      })

      // Animate step indicator with slight delay
      if (stepIndicator) {
        gsap.to(stepIndicator, {
          scale: 1,
          opacity: 1,
          duration: 0.5,
          ease: "back.out(1.7)",
          scrollTrigger: {
            trigger: moduleEl,
            start: "top 80%",
            toggleActions: "play none none reverse",
          },
        })
      }

      // Add hover glow effect on step indicator
      if (stepIndicator) {
        stepIndicator.addEventListener("mouseenter", () => {
          gsap.to(stepIndicator, {
            boxShadow: "0 0 20px rgba(var(--primary), 0.4)",
            scale: 1.1,
            duration: 0.3,
          })
        })
        stepIndicator.addEventListener("mouseleave", () => {
          gsap.to(stepIndicator, {
            boxShadow: "0 0 0px rgba(var(--primary), 0)",
            scale: 1,
            duration: 0.3,
          })
        })
      }
    })

    // Cleanup
    return () => {
      lenis.destroy()
      ScrollTrigger.getAll().forEach((t) => t.kill())
    }
  }, [modules])

  return (
    <div ref={containerRef} className="relative pl-4 md:pl-0">
      {/* Background line (static) */}
      <div className="absolute left-9 md:left-6 top-6 bottom-6 w-0.5 bg-muted/30" />
      
      {/* Progress line (animates on scroll) */}
      <div
        ref={progressLineRef}
        className="absolute left-9 md:left-6 top-6 bottom-6 w-0.5 bg-gradient-to-b from-primary via-primary to-primary/50 origin-top"
        style={{ transformOrigin: "top" }}
      />

      <div className="space-y-12 md:space-y-16">
        {modules.map((module, index) => (
          <div
            key={module.moduleId || `module-${index}`}
            ref={(el) => { moduleRefs.current[index] = el }}
            className="relative"
          >
            {/* Step indicator */}
            <div className="step-indicator absolute left-6 md:left-0 w-14 h-14 -translate-x-1/2 rounded-full bg-background border-4 border-card shadow-2xl flex items-center justify-center z-10 cursor-pointer transition-all duration-300">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground font-bold text-sm shadow-lg">
                {index + 1}
              </div>
            </div>

            {/* Module card */}
            <div className="card-content ml-16 md:ml-16">
              <ModuleCard module={module} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
