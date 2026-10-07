"use client"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X, LayoutDashboard, Map as MapIcon, GraduationCap, MessageSquare, Sparkles, Brain, User } from "lucide-react"
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs"
import { GrimoireLogo } from "@/components/ui/zentra-logo"
import dynamic from "next/dynamic"

const ModeToggle = dynamic(() => import("@/components/mode-toggle").then((mod) => mod.ModeToggle), {
  ssr: false,
})

const navLinks = [
  { href: "/space", label: "Space", icon: LayoutDashboard },
  { href: "/assessment", label: "Assessment", icon: GraduationCap },
  { href: "/roadmap", label: "Roadmap", icon: MapIcon },
  { href: "/interview", label: "Interview", icon: MessageSquare },
  { href: "/notes", label: "Notes", icon: Brain },
  { href: "/dashboard", label: "Dashboard", icon: Sparkles },
]

export function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full bg-[#250d06] border-b border-[#3d180f] shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-8">
        {/* Brand Logo & Name */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <GrimoireLogo className="h-6 w-6 text-[#f6ede2] transition-transform duration-300 group-hover:scale-105" />
          <span className="text-lg md:text-xl font-serif font-bold tracking-[0.14em] text-[#f6ede2]">
            GRIMOIRE
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden lg:flex items-center gap-6">
          {navLinks.map((link) => {
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative py-1 text-sm transition-colors ${
                  isActive 
                    ? "text-[#ffffff] font-medium" 
                    : "text-[#d5c3b8] hover:text-[#ffffff] font-normal"
                }`}
              >
                <span>{link.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="header-active-line"
                    className="absolute -bottom-2 left-0 right-0 h-[2px] bg-[#e3935c] rounded-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Right side controls */}
        <div className="hidden md:flex items-center gap-4">
          <ModeToggle />

          <Link
            href="/chat"
            className="flex items-center gap-1.5 text-sm text-[#f6ede2] hover:text-white transition-colors px-1"
          >
            <User className="h-4 w-4 text-[#f6ede2]/90" />
            <span>Ask AI</span>
          </Link>

          <SignedIn>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8 border border-[#e3935c]",
                },
              }}
            />
          </SignedIn>

          <SignedOut>
            <Link
              href="/sign-in"
              className="flex items-center justify-center h-8 w-8 rounded-full bg-[#e3935c] text-[#250d06] font-semibold text-xs shadow-sm hover:opacity-90 transition-opacity"
              title="Sign In / Account"
            >
              M
            </Link>
          </SignedOut>
        </div>

        {/* Mobile Hamburger */}
        <div className="flex items-center gap-3 md:hidden">
          <ModeToggle />
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1.5 text-[#f6ede2] hover:text-white hover:bg-[#3d180f] rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-[#3d180f] bg-[#250d06] px-4 py-4"
          >
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                      isActive 
                        ? "text-[#e3935c] bg-[#3a180f]" 
                        : "text-[#d5c3b8] hover:text-[#f6ede2] hover:bg-[#32130b]"
                    }`}
                  >
                    <span>{link.label}</span>
                    {isActive && <div className="h-1.5 w-1.5 rounded-full bg-[#e3935c]" />}
                  </Link>
                )
              })}
              <div className="flex items-center justify-between pt-3 border-t border-[#3d180f] mt-2">
                <Link
                  href="/chat"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 text-sm text-[#f6ede2]"
                >
                  <User className="h-4 w-4" />
                  <span>Ask AI</span>
                </Link>
                <SignedOut>
                  <Link
                    href="/sign-in"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-center h-8 w-8 rounded-full bg-[#e3935c] text-[#250d06] font-semibold text-xs"
                  >
                    M
                  </Link>
                </SignedOut>
                <SignedIn>
                  <UserButton />
                </SignedIn>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
