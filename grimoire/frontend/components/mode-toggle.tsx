"use client"

import * as React from "react"
import { Sun, Moon } from "lucide-react"
import { useTheme } from "next-themes"

export function ModeToggle() {
    const { theme, setTheme, resolvedTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return (
            <div className="w-12 h-6 rounded-full bg-[#3a180f] border border-[#4d2317] opacity-60" />
        )
    }

    const isDark = (resolvedTheme || theme) === "dark"

    return (
        <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="relative flex items-center w-12 h-6 rounded-full bg-[#36160e] border border-[#522519] p-0.5 cursor-pointer transition-colors focus:outline-none"
            aria-label="Toggle theme"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
            <Sun className="h-3 w-3 ml-1 text-[#e3935c]" />
            <Moon className="h-3 w-3 ml-auto mr-1 text-[#edd3cb]/60" />
            <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-[#edd3cb] shadow-sm transition-transform duration-200 ${
                    isDark ? "translate-x-6" : "translate-x-0"
                }`}
            />
        </button>
    )
}
