"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { motion } from "framer-motion"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input" 
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Trophy, Clock, Target, Award, Sparkles, CheckCircle2, Share2, Copy } from "lucide-react"

interface PortfolioData {
    user_id: string
    profile: {
        name: string
        avatar: string
        bio: string
        joined_at: string
    }
    stats: {
        lessons_completed: number
        quizzes_completed: number
        average_score: number
        learning_hours: number
        streak: number
    }
    badges: Array<{
        badge_id: string
        metadata: {
            name: string
            description: string
            criteria: string
        }
        evidence: any[]
        issued_at: string
    }>
    skill_summary: string
    generated_at: string
}

export default function PublicPortfolioPage() {
    const params = useParams()
    const userId = params.userId as string
    const { user } = useUser()
    const [data, setData] = useState<PortfolioData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        const fetchPortfolio = async () => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/v1/agents/portfolio/public/${userId}?_t=${Date.now()}`, {
                    cache: 'no-store',
                    headers: {
                        'Pragma': 'no-cache',
                        'Cache-Control': 'no-cache'
                    }
                })
                if (!response.ok) {
                     console.error("Portfolio fetch failed:", response.status, response.statusText)
                     throw new Error("Portfolio not found")
                }
                const json = await response.json()
                
                // Validate essential data structure
                if (!json.profile || !json.stats) {
                    console.warn("Portfolio data incomplete:", json)
                }
                
                setData(json)
            } catch (err) {
                console.error("Error loading portfolio:", err)
                setError("Failed to load portfolio")
            } finally {
                setLoading(false)
            }
        }
        if (userId) fetchPortfolio()
    }, [userId])

    // Sync Clerk name to backend if needed
    useEffect(() => {
        if (user && data && user.id === userId) {
            const clerkName = user.fullName || user.firstName || "Learner"
            // If backend name is generic "Learner ..." or doesn't match Clerk (and Clerk has a real name)
            const isGeneric = data.profile.name.startsWith("Learner user_") || data.profile.name.startsWith("Learner " + userId.substring(0, 6));
            
            if (isGeneric || (data.profile.name !== clerkName && clerkName !== "Learner")) {
                // Update local state for immediate feedback
                setData(prev => prev ? ({
                    ...prev,
                    profile: { ...prev.profile, name: clerkName, avatar: user.imageUrl || prev.profile.avatar }
                }) : null)

                // Sync to backend
                fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/v1/user/profile`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        user_id: userId,
                        updates: {
                            name: clerkName,
                            avatar: user.imageUrl
                        }
                    })
                }).catch(err => console.error("Failed to sync profile:", err))
            }
        }
    }, [user, data, userId])

    const copyLink = () => {
        navigator.clipboard.writeText(window.location.href)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    if (loading) {
        return (
            <div className="min-h-screen grid place-items-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    <p className="text-muted-foreground animate-pulse">Verifying Credentials...</p>
                </div>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="min-h-screen grid place-items-center bg-background">
                <Card className="p-8 text-center max-w-md">
                    <div className="text-red-500 mb-4 mx-auto w-12 h-12 flex items-center justify-center rounded-full bg-red-100">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Portfolio Not Found</h1>
                    <p className="text-muted-foreground">The user certificate you are looking for does not exist or is private.</p>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background text-foreground py-12 px-4 relative overflow-hidden selection:bg-primary/30">
             
            {/* Background Decorations */}
            <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-size-[24px_24px]"></div>
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[100px] opacity-40 animate-pulse-slow" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px] opacity-40 animate-pulse-slow delay-1000" />
            </div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="max-w-4xl mx-auto relative z-10 space-y-8"
            >
                {/* Header Card */}
                <Card className="p-8 md:p-10 overflow-hidden relative border-white/10 shadow-2xl bg-card/40 backdrop-blur-xl">
                    <div className="absolute top-0 right-0 p-8 opacity-5 dark:opacity-[0.02]">
                        <Award className="w-64 h-64 rotate-12" />
                    </div>
                    
                    <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8 text-center md:text-left">
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="relative group"
                        >
                            <div className="absolute -inset-0.5 bg-linear-to-br from-primary to-purple-600 rounded-full opacity-75 group-hover:opacity-100 blur transition duration-1000 group-hover:duration-200"></div>
                            <Avatar className="h-32 w-32 border-4 border-background relative">
                                <AvatarImage src={data.profile.avatar} />
                                <AvatarFallback className="text-4xl bg-background text-primary font-bold">
                                    {data.profile.name.charAt(0)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="absolute bottom-1 right-1 bg-green-500 rounded-full p-1.5 border-4 border-background" title="Online Status">
                                <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                            </div>
                        </motion.div>
                        
                        <div className="flex-1 space-y-3">
                            <div>
                                <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2 bg-linear-to-r from-primary via-purple-500 to-blue-600 bg-clip-text text-transparent inline-block pb-1">
                                    {data.profile.name}
                                </h1>
                                <p className="text-lg md:text-xl text-muted-foreground max-w-xl font-light leading-relaxed">
                                    {data.profile.bio}
                                </p>
                            </div>
                            
                            <div className="flex flex-wrap gap-3 justify-center md:justify-start pt-2">
                                <Badge variant="secondary" className="px-3 py-1.5 backdrop-blur-md bg-secondary/50 border border-white/10">
                                    Member since {new Date(data.profile.joined_at).getFullYear()}
                                </Badge>
                                <Badge variant="outline" className="px-3 py-1.5 border-green-500/30 text-green-600 dark:text-green-400 bg-green-500/5">
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                    Verified Learner
                                </Badge>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 min-w-[150px]">
                            <Button onClick={copyLink} variant="default" className="w-full gap-2 shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95">
                                {copied ? <CheckCircle2 className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                                {copied ? "Copied!" : "Share Profile"}
                            </Button>
                        </div>
                    </div>
                </Card>

                {/* AI Skill Assessment */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <div className="relative p-px rounded-2xl bg-linear-to-r from-primary/30 via-purple-500/30 to-blue-600/30">
                        <Card className="bg-card/95 backdrop-blur-sm rounded-[15px] p-6 md:p-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-bl-full blur-2xl -mr-8 -mt-8" />
                            
                            <div className="flex flex-col md:flex-row gap-6 relative z-10">
                                <div className="shrink-0 flex md:flex-col items-center gap-2 text-primary md:border-r border-border/50 md:pr-6 md:w-32">
                                    <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                                        <Sparkles className="w-8 h-8" />
                                    </div>
                                    <span className="text-xs font-bold uppercase tracking-wider text-center hidden md:block opacity-70">AI Skill Analysis</span>
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-xl font-semibold mb-3 flex items-center gap-2 md:hidden">
                                        AI Skill Assessment
                                    </h2>
                                    <div className="relative">
                                        <span className="absolute -top-2 -left-3 text-4xl text-primary/20 font-serif">"</span>
                                        <p className="text-lg md:text-xl leading-relaxed text-foreground/90 font-medium italic relative z-10 pl-2">
                                            {data.skill_summary}
                                        </p>
                                        <span className="absolute -bottom-4 right-0 text-4xl text-primary/20 font-serif">"</span>
                                    </div>
                                    <div className="mt-6 flex items-center justify-between border-t border-border/50 pt-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Live Assessment</span>
                                        </div>
                                        <span className="text-xs text-muted-foreground font-mono">
                                            Generated {new Date(data.generated_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                </motion.div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Stats */}
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                        className="space-y-6"
                    >
                        <Card className="p-0 overflow-hidden border-white/5 bg-card/50 backdrop-blur-sm h-full flex flex-col">
                            <div className="p-6 border-b border-border/50 bg-muted/20">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <Target className="w-5 h-5 text-primary" />
                                    Performance Analytics
                                </h3>
                            </div>
                            <div className="p-6 space-y-8 flex-1">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Course Progress</span>
                                        <span className="font-bold">{data.stats.lessons_completed} Modules</span>
                                    </div>
                                    <Progress value={Math.min(100, data.stats.lessons_completed * 2)} className="h-2 bg-muted/50" />
                                </div>
                                
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Quiz Proficiency</span>
                                        <span className="font-bold text-primary">{data.stats.average_score}%</span>
                                    </div>
                                    <Progress value={data.stats.average_score} className="h-2 bg-muted/50" />
                                </div>

                                <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-sm font-medium text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                            Active Streak
                                        </span>
                                        <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">{data.stats.streak}</span>
                                    </div>
                                    <div className="flex gap-1 h-3">
                                        {[...Array(7)].map((_, i) => (
                                            <div 
                                                key={i} 
                                                className={`flex-1 rounded-sm transition-all duration-500 ${
                                                    i < (data.stats.streak % 7 || (data.stats.streak > 0 ? 7 : 0)) 
                                                    ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]' 
                                                    : 'bg-muted/50'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground text-center mt-2 uppercase tracking-wide">Last 7 Days Activity</p>
                                </div>
                            </div>
                        </Card>
                    </motion.div>

                    {/* Right Column: Badges */}
                    <div className="lg:col-span-2 space-y-6">
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5 }}
                            className="h-full"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold flex items-center gap-3">
                                    <Trophy className="w-6 h-6 text-yellow-500" />
                                    Verified Credentials
                                </h3>
                                <Badge variant="outline" className="text-xs font-normal">
                                    {data.badges.length} Earned
                                </Badge>
                            </div>
                            
                            {data.badges.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {data.badges.map((badge, idx) => (
                                        <motion.div
                                            key={badge.badge_id}
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: 0.6 + idx * 0.1 }}
                                        >
                                            <Card className="group p-5 h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-primary/30 border-white/5 bg-card/60 backdrop-blur-sm relative overflow-hidden">
                                                <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                                
                                                <div className="flex justify-between items-start mb-4 relative z-10">
                                                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-yellow-500/10 to-orange-500/10 text-yellow-600 dark:text-yellow-400 group-hover:scale-110 transition-transform duration-300 shadow-sm border border-yellow-500/10">
                                                        <Award className="w-6 h-6" />
                                                    </div>
                                                    <span className="text-[10px] font-mono text-muted-foreground bg-muted/30 px-2 py-1 rounded">
                                                        {new Date(badge.issued_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                
                                                <div className="relative z-10">
                                                    <h4 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors">{badge.metadata.name}</h4>
                                                    <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{badge.metadata.description}</p>
                                                    
                                                    {badge.metadata.criteria && (
                                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80 mt-2 pt-2 border-t border-border/50">
                                                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                                                            <span>Verified: {badge.metadata.criteria}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </Card>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <Card className="p-12 text-center text-muted-foreground bg-muted/10 border-dashed border-2">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/20 flex items-center justify-center">
                                        <Trophy className="w-8 h-8 opacity-40" />
                                    </div>
                                    <h4 className="font-semibold mb-1">No Badges Yet</h4>
                                    <p className="max-w-xs mx-auto text-sm opacity-70">Complete lessons and assessments to earn verified credentials to showcase here.</p>
                                </Card>
                            )}
                        </motion.div>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center pt-16 pb-8">
                    <div className="inline-flex flex-col items-center gap-3 opacity-60 hover:opacity-100 transition-opacity">
                        <div className="w-10 h-10 rounded-xl bg-linear-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary/20">
                            N
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                            <span className="text-sm font-semibold tracking-wide">VERIFIED CREDENTIAL</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Issued by GRIMOIRE Learning Platform</span>
                            <span className="text-[10px] text-muted-foreground font-mono mt-1">ID: {userId}</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
