"use client"

import { HeroSection } from "@/components/home/hero-section"
import { FeaturesSection } from "@/components/home/features-section"
import { AllFeaturesSection } from "@/components/home/all-features-section"

export default function HomePage() {
    return (
        <div className="min-h-screen bg-background">
            <HeroSection />
            <AllFeaturesSection />
        </div>
    )
}
