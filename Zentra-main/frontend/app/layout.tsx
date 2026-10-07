import type React from "react"
import type { Metadata, Viewport } from "next"
import { Open_Sans, Playfair_Display, Geist_Mono } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { ThemeProvider } from "@/components/theme-provider"
import { ActivityTracker } from "@/components/activity-tracker"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Toaster } from "@/components/ui/sonner"
import "@/styles/globals.css"

const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-open-sans" })
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-serif" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: "GRIMOIRE - AI Learning Platform",
  description: "AI-powered adaptive learning with personalized roadmaps, live lessons, and interview prep",
  generator: 'v0.app',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e3935c" },
    { media: "(prefers-color-scheme: dark)", color: "#250d06" },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body suppressHydrationWarning className={`${openSans.variable} ${playfair.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground`}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <ActivityTracker />
            <Toaster position="top-right" richColors />
            <div className="flex flex-col min-h-screen" suppressHydrationWarning>
              <Header />
              <main className="flex-1" suppressHydrationWarning>
                {children}
              </main>
              <Footer />
            </div>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
