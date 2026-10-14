"use client"

import * as React from "react"
import { useUser } from "@clerk/nextjs" // Import useUser
import { motion } from "framer-motion"
import { ProgressChart } from "@/components/dashboard/progress-chart"
import { StatsGrid } from "@/components/dashboard/stats-grid"
import { CourseContentModal } from "@/components/dashboard/course-content-modal"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Download, Trophy, Award, BookOpen, Clock, Target, Rocket, Pencil, Flame, Brain, ArrowRight, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog"

export default function DashboardPage() {
  const handleExportPDF = () => {
    alert("PDF export triggered! (Mock implementation)")
  }

  const { user } = useUser() // Get user from Clerk

  // Get user profile from Clerk
  const userName = user?.fullName || user?.firstName || "User"
  const userEmail = user?.primaryEmailAddress?.emailAddress || ""
  const userAvatar = user?.imageUrl || ""

  // Editable Goal State
  const [currentGoal, setCurrentGoal] = React.useState<string>("")
  const [isEditingGoal, setIsEditingGoal] = React.useState(false)
  const [tempGoal, setTempGoal] = React.useState("")

  // Load goal from localStorage on mount
  React.useEffect(() => {
    const savedGoal = localStorage.getItem('userGoal')
    if (savedGoal) {
      setCurrentGoal(savedGoal)
    }
  }, [])

  const handleSaveGoal = () => {
    if (tempGoal.trim()) {
      setCurrentGoal(tempGoal.trim())
      localStorage.setItem('userGoal', tempGoal.trim())
    }
    setIsEditingGoal(false)
  }

  const handleOpenGoalEdit = () => {
    setTempGoal(currentGoal)
    setIsEditingGoal(true)
  }

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")

  const [savedRoadmaps, setSavedRoadmaps] = React.useState<any[]>([])
  const [assessmentHistory, setAssessmentHistory] = React.useState<any[]>([])
  // Primary loading: roadmaps + progress. Secondary: assessments, notes, profile load in background.
  const [loading, setLoading] = React.useState(true)
  const [profileData, setProfileData] = React.useState<any>(null)
  const [savedNotes, setSavedNotes] = React.useState<any[]>([])

  // Progress State
  const [userProgress, setUserProgress] = React.useState<any>({ history: [], stats: {} })
  const [roadmapProgress, setRoadmapProgress] = React.useState<Record<string, number>>({})
  const [completedTopics, setCompletedTopics] = React.useState<Set<string>>(new Set())


  // Modal State
  const [selectedRoadmap, setSelectedRoadmap] = React.useState<any>(null)
  const [isModalOpen, setIsModalOpen] = React.useState(false)

  // Fetch Roadmaps and Progress
  const fetchUserProgress = React.useCallback(async (silent = false) => {
    if (!user) { setLoading(false); return }

    const userId = user.id
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
    const portfolioUrl = `${apiUrl}/v1/agents/portfolio/public/${userId}`
    const CACHE_KEY = `dashboard_v1_${userId}`
    const CACHE_TTL = 5 * 60 * 1000 // 5 min

    // ── sessionStorage cache: instant restore on back-navigation ──
    try {
      const raw = sessionStorage.getItem(CACHE_KEY)
      if (raw) {
        const { payload, ts } = JSON.parse(raw)
        if (Date.now() - ts < CACHE_TTL) {
          setSavedRoadmaps(payload.roadmaps ?? [])
          setUserProgress(payload.progress ?? { history: [], stats: {} })
          setRoadmapProgress(payload.roadmapProgress ?? {})
          setCompletedTopics(new Set(payload.completedTopics ?? []))
          if (payload.assessments) setAssessmentHistory(payload.assessments)
          if (payload.profile !== undefined) setProfileData(payload.profile)
          if (payload.notes) setSavedNotes(payload.notes)
          setLoading(false)
          return
        }
      }
    } catch (_) { /* sessionStorage unavailable */ }

    if (!silent) setLoading(true)

    // Kick off ALL 5 fetches immediately so they download in parallel.
    // Primary (roadmaps + progress) unblocks the UI.
    // Secondary (assessments, profile, notes) fills in background.
    const roadmapPromise = fetch(`/api/v1/roadmap/list?userId=${userId}`, {
      headers: { 'Authorization': 'Bearer test-key' }
    })
    const progressPromise = fetch(`/api/v1/progress/${userId}`, {
      headers: { 'Authorization': 'Bearer test-key' }
    })
    const assessmentPromise = fetch(`/api/v1/agents/assessment/history/${userId}`, {
      headers: { 'Authorization': 'Bearer test-key' }
    })
    const profilePromise = fetch(portfolioUrl)
    const notesPromise = fetch(`/api/v1/agents/notes-intelligence/list/${userId}`)

    try {
      // ── Primary: await roadmaps + progress, parse JSON in parallel ──
      const [roadmapRes, progressRes] = await Promise.all([roadmapPromise, progressPromise])
      const [roadmapData, progressData] = await Promise.all([roadmapRes.json(), progressRes.json()])

      if (roadmapRes.ok && roadmapData.roadmaps && Array.isArray(roadmapData.roadmaps)) {
        setSavedRoadmaps(roadmapData.roadmaps)

        const progressPayload = progressData.agent_output?.payload
          || progressData.payload
          || (progressData.history ? progressData : { history: [], stats: {} })
        setUserProgress(progressPayload)

        const normalizeString = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
        const completedSet = new Set<string>()

        if (progressPayload.history) {
          progressPayload.history.forEach((item: any) => {
            if (item.item_type === 'lesson') {
              if (item.title) {
                completedSet.add(normalizeString(item.title))
                completedSet.add(item.title)
                completedSet.add(item.title.toLowerCase())
                completedSet.add(item.title.toLowerCase().replace(/\s+/g, '-'))
              }
              if (item.item_id) completedSet.add(item.item_id)
            }
          })
        }

        setCompletedTopics(prev => {
          const mergedSet = new Set([...completedSet, ...prev])
          const progressMap: Record<string, number> = {}
          roadmapData.roadmaps.forEach((map: any) => {
            let total = 0, done = 0
            map.modules?.forEach((mod: any) => {
              mod.topics?.forEach((topic: string) => {
                total++
                const n = normalizeString(topic)
                const sl = topic.toLowerCase().replace(/\s+/g, '-')
                if (mergedSet.has(n) || mergedSet.has(topic) ||
                  mergedSet.has(topic.toLowerCase()) || mergedSet.has(sl)) done++
              })
            })
            progressMap[map.id] = total > 0 ? Math.round((done / total) * 100) : 0
          })
          setRoadmapProgress(progressMap)

          // Save primary data to sessionStorage cache
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({
              payload: {
                roadmaps: roadmapData.roadmaps,
                progress: progressPayload,
                roadmapProgress: progressMap,
                completedTopics: [...completedSet],
              },
              ts: Date.now(),
            }))
          } catch (_) {}

          return mergedSet
        })
      }
    } catch (err) {
      console.error("Failed to fetch primary dashboard data", err)
    } finally {
      if (!silent) setLoading(false)
    }

    // ── Secondary: assessments, profile, notes load in background ──
    Promise.all([assessmentPromise, profilePromise, notesPromise])
      .then(([aRes, pRes, nRes]) => Promise.all([
        aRes.ok ? aRes.json() : Promise.resolve(null),
        pRes.ok ? pRes.json() : Promise.resolve(null),
        nRes.ok ? nRes.json() : Promise.resolve(null),
      ]))
      .then(([assessmentData, profileDataRes, notesData]) => {
        if (assessmentData) setAssessmentHistory(assessmentData.history || [])
        if (profileDataRes) setProfileData(profileDataRes)
        if (notesData) setSavedNotes(notesData.notes || [])
        // Merge secondary data into the sessionStorage cache
        try {
          const raw = sessionStorage.getItem(CACHE_KEY)
          if (raw) {
            const cached = JSON.parse(raw)
            cached.payload.assessments = assessmentData?.history || []
            cached.payload.profile = profileDataRes ?? null
            cached.payload.notes = notesData?.notes || []
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(cached))
          }
        } catch (_) {}
      })
      .catch(err => console.error("Failed to fetch secondary dashboard data", err))
  }, [user])

  // Calculate weekly activity
  const weeklyActivity = React.useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      return d
    })

    return last7Days.map(date => {
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
      const dateString = date.toISOString().split('T')[0]

      const count = userProgress.history?.filter((item: any) =>
        item.completed_at?.startsWith(dateString)
      ).length || 0

      return {
        day: dayName,
        progress: count
      }
    })
  }, [userProgress])

  React.useEffect(() => {
    if (user) {
      fetchUserProgress()
    } else {
      setLoading(false)
    }
  }, [user, fetchUserProgress])

  const handleOpenCourse = (roadmap: any) => {
    setSelectedRoadmap(roadmap)
    setIsModalOpen(true)
  }

  const handleStartLearning = (topic: string, context: string) => {
    window.location.href = `/lesson/l1?topic=${encodeURIComponent(topic)}&context=${encodeURIComponent(context)}`
  }

  const handleDeleteRoadmap = async (roadmapId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("Are you sure you want to delete this roadmap? This action cannot be undone.")) return

    try {
      const response = await fetch(`/api/v1/roadmap/delete?roadmapId=${roadmapId}&userId=${user!.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setSavedRoadmaps(prev => prev.filter(map => map.id !== roadmapId))
        const { [roadmapId]: deleted, ...rest } = roadmapProgress
        setRoadmapProgress(rest)
      } else {
        alert("Failed to delete roadmap")
      }
    } catch (error) {
      console.error("Error deleting roadmap:", error)
      alert("Error deleting roadmap")
    }
  }

  const handleDeleteNote = async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("Are you sure you want to delete this note? This action cannot be undone.")) return

    try {
      const response = await fetch(`/api/v1/agents/notes-intelligence/${noteId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setSavedNotes(prev => prev.filter(note => note.id !== noteId))
      } else {
        alert("Failed to delete note")
      }
    } catch (error) {
      console.error("Error deleting note:", error)
      alert("Error deleting note")
    }
  }

  // Calculate stats for grid
  const totalPlannedHours = savedRoadmaps.reduce((acc, map) => {
    const mapHours = map.modules?.reduce((mAcc: number, m: any) => mAcc + (m.estimated_hours || m.estimatedHours || 0), 0) || 0
    return acc + mapHours
  }, 0)

  // Calculate total completion average
  const totalCompletionXYZ = Object.values(roadmapProgress).reduce((a, b) => a + b, 0)
  const averageCompletion = savedRoadmaps.length > 0 ? Math.round(totalCompletionXYZ / savedRoadmaps.length) : 0

  return (
    <div className="min-h-screen bg-background">

      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-7xl mx-auto space-y-8"
        >
          {/* Profile Header - Clean Card Design */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <Card className="p-8">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                {/* Avatar */}
                <div className="relative">
                  <Avatar className="h-28 w-28 ring-4 ring-primary/20 shadow-lg">
                    <AvatarImage src={userAvatar} className="object-cover" />
                    <AvatarFallback className="text-3xl font-bold bg-primary text-primary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {/* Online indicator */}
                  <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 rounded-full border-4 border-card shadow-lg" />
                </div>

                <div className="flex-1 text-center md:text-left">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <motion.p
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-sm text-muted-foreground mb-1"
                      >
                        Welcome back
                      </motion.p>
                      <h1 className="text-4xl font-bold font-display mb-2 text-foreground">
                        {userName}
                      </h1>
                      <p className="text-muted-foreground mb-4 flex items-center gap-2 justify-center md:justify-start">
                        <span className="inline-block w-2 h-2 bg-primary rounded-full" />
                        {userEmail}
                      </p>
                      <div className="flex items-center gap-3 flex-wrap justify-center md:justify-start">
                        {currentGoal ? (
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleOpenGoalEdit}
                            className="cursor-pointer"
                          >
                            <Badge className="bg-primary text-primary-foreground shadow-sm px-4 py-1.5 text-sm">
                              <Trophy className="h-4 w-4 mr-2" />
                              Goal: {currentGoal}
                              <Pencil className="h-3 w-3 ml-2 opacity-70" />
                            </Badge>
                          </motion.div>
                        ) : (
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleOpenGoalEdit}
                              className="border-primary/30 text-primary hover:bg-primary/10"
                            >
                              <Target className="h-4 w-4 mr-2" />
                              Set Your Goal
                            </Button>
                          </motion.div>
                        )}
                        {user && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => window.open(`/u/${user.id}`, '_blank')}
                          >
                            <Award className="w-4 h-4" />
                            View Certificate
                          </Button>
                        )}
                      </div>
                    </div>
                    {/* Quick Stats Mini Cards */}
                    <div className="flex gap-3 mt-4 md:mt-0">
                      <div className="px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-center">
                        <p className="text-2xl font-bold text-primary">{savedRoadmaps.length}</p>
                        <p className="text-xs text-muted-foreground">Paths</p>
                      </div>
                      <div className="px-4 py-2 rounded-xl bg-accent/10 border border-accent/20 text-center">
                        <p className="text-2xl font-bold text-accent">{averageCompletion}%</p>
                        <p className="text-xs text-muted-foreground">Progress</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

            {/* Active Learning Paths Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold font-display flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Rocket className="h-5 w-5 text-primary" />
                </div>
                Active Learning Paths
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary hover:text-primary/80"
                onClick={() => window.location.href = "/roadmap"}
              >
                + Add New
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <p className="text-muted-foreground">Loading your learning paths...</p>
                </div>
              </div>
            ) : savedRoadmaps.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {savedRoadmaps.map((map, index) => {
                  const progress = roadmapProgress[map.id] || 0
                  return (
                    <motion.div
                      key={map.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                      whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    >
                      <Card
                        className="relative overflow-hidden p-6 cursor-pointer flex flex-col justify-between bg-card border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300 group"
                        onClick={() => handleOpenCourse(map)}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="font-bold text-xl mb-1 group-hover:text-primary transition-colors">{map.technology}</h3>
                              <p className="text-sm text-muted-foreground capitalize flex items-center gap-2">
                                <span className={`inline-block w-2 h-2 rounded-full ${map.level === 'beginner' ? 'bg-green-500' : map.level === 'intermediate' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                                {map.level} Level
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={map.status === 'active' ? 'default' : 'secondary'}
                                className={map.status === 'active' ? 'bg-green-500/10 text-green-600 border-green-500/20' : ''}
                              >
                                {map.status || 'Active'}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mr-2"
                                onClick={(e: React.MouseEvent) => handleDeleteRoadmap(map.id, e)}
                                title="Delete Roadmap"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-3 mb-6">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-semibold text-primary">{progress}%</span>
                            </div>
                            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 1, delay: 0.2 + index * 0.1, ease: "easeOut" }}
                                className="h-full bg-primary rounded-full"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                          <span className="flex items-center gap-1.5">
                            <BookOpen className="h-4 w-4" />
                            {map.modules?.length || 0} Modules
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4" />
                            {Math.round(totalPlannedHours / savedRoadmaps.length)} Hours
                          </span>
                        </div>

                        <Button
                          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm group-hover:shadow-md transition-all"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            handleOpenCourse(map)
                            // Recalculate progress for the selected roadmap
                            if (selectedRoadmap && user) {
                              // Refresh all data to ensure consistency with backend
                              fetchUserProgress()
                            }
                          }}
                        >
                          <Rocket className="h-4 w-4 mr-2" />
                          Continue Learning
                        </Button>
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Card className="p-12 text-center border-dashed border-2 border-muted-foreground/20">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Rocket className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Start Your Learning Journey</h3>
                  <p className="text-muted-foreground mb-6">Create your first personalized learning roadmap</p>
                  <Button
                    className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                    onClick={() => window.location.href = "/roadmap"}
                  >
                    <Rocket className="h-4 w-4 mr-2" />
                    Create Roadmap
                  </Button>
                </Card>
              </motion.div>
            )}
          </motion.div>

          {/* Saved Intelligence Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold font-display flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/10">
                  <Brain className="h-5 w-5 text-purple-600" />
                </div>
                Saved Intelligence
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                onClick={() => window.location.href = "/notes"}
              >
                + Analyze New
              </Button>
            </div>

            {savedNotes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {savedNotes.map((note, index) => (
                  <motion.div
                    key={note.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * index }}
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  >
                    <Card
                      className="p-6 cursor-pointer hover:shadow-md transition-all group border-purple-100 hover:border-purple-300 relative overflow-hidden"
                      onClick={() => window.location.href = `/notes?id=${note.id}`}
                    >
                      <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Brain className="w-16 h-16 text-purple-600" />
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 z-20 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => handleDeleteNote(note.id, e)}
                        title="Delete Note"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      
                      <div className="relative z-10">
                        <div className="flex justify-between items-start mb-3">
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                {note.goal.replace('_', ' ')}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                                {new Date(note.created_at).toLocaleDateString()}
                            </span>
                        </div>
                        
                        <h3 className="font-bold text-lg mb-2 line-clamp-1 group-hover:text-purple-700 transition-colors">
                            {note.subject}
                        </h3>
                        
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4 h-10">
                            {note.summary_preview || "No summary available."}
                        </p>
                        
                        <div className="flex items-center text-sm font-medium text-purple-600 group-hover:translate-x-1 transition-transform">
                            View Analysis <ArrowRight className="w-4 h-4 ml-1" />
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
                <div className="p-8 border-2 border-dashed border-muted rounded-xl text-center">
                    <p className="text-muted-foreground">No saved analysis yet.</p>
                </div>
            )}
          </motion.div>

          {/* Recent Assessments */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold font-display flex items-center gap-3">
                <div className="p-2 rounded-xl bg-accent/10">
                  <Award className="h-5 w-5 text-accent" />
                </div>
                Recent Assessments
              </h2>
              <div className="flex gap-2">
                {assessmentHistory.length > 3 && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        View All
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>All Quiz History</DialogTitle>
                        <DialogDescription>
                          A complete history of your quiz attempts and scores.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 mt-4">
                        {assessmentHistory.map((assessment, i) => (
                          <Card key={i} className="p-4 flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold">{assessment.topic}</h3>
                                <p className="text-sm text-muted-foreground">
                                    {new Date(assessment.created_at || assessment.timestamp).toLocaleDateString()} at {new Date(assessment.created_at || assessment.timestamp).toLocaleTimeString()}
                                </p>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-sm font-bold ${assessment.score >= 70 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                {assessment.score}%
                            </div>
                          </Card>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary hover:text-primary/80"
                    onClick={() => window.location.href = "/assessment"}
                >
                    Take Quiz →
                </Button>
              </div>
            </div>

            {assessmentHistory.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assessmentHistory.slice(0, 3).map((assessment, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * i }}
                    whileHover={{ scale: 1.02 }}
                  >
                    <Card className="p-5 flex items-center justify-between hover:shadow-md transition-all group">
                      <div className="flex-1 min-w-0 mr-4">
                        <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors" title={assessment.topic}>
                          {assessment.topic}
                        </h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(assessment.created_at || assessment.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                      <div className={`flex items-center justify-center w-14 h-14 rounded-xl ${assessment.score >= 70 ? 'bg-green-500/10' : 'bg-orange-500/10'}`}>
                        <span className={`text-xl font-bold ${assessment.score >= 70 ? 'text-green-500' : 'text-orange-500'}`}>
                          {assessment.score}%
                        </span>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center border-dashed border-2 border-muted-foreground/20">
                <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Award className="h-7 w-7 text-accent" />
                </div>
                <p className="text-muted-foreground mb-4">Test your knowledge with a quiz</p>
                <Button
                  variant="outline"
                  className="border-primary/30 hover:bg-primary/10"
                  onClick={() => window.location.href = "/assessment"}
                >
                  Take a Quiz
                </Button>
              </Card>
            )}
          </motion.div>

          {/* Progress Chart - Full Width */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <ProgressChart
              data={weeklyActivity}
              title="Learning Activity"
              description="Lessons completed over the last 7 days"
              unit=""
            />
          </motion.div>

          {/* Achievement Badges Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold font-display flex items-center gap-3">
                <div className="p-2 rounded-xl bg-yellow-500/10">
                  <Award className="h-5 w-5 text-yellow-500" />
                </div>
                Achievement Badges
              </h2>
            </div>
            {profileData?.badges && profileData.badges.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {profileData.badges.map((badge: any, idx: number) => (
                  <motion.div
                    key={badge.badge_id || idx}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6 + idx * 0.05 }}
                    className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-all text-center group cursor-default"
                  >
                    <div className="text-4xl mb-2 group-hover:scale-110 transition-transform duration-300">
                      {badge.metadata?.icon || "🏅"}
                    </div>
                    <h3 className="font-semibold mb-1">{badge.metadata?.name}</h3>
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{badge.metadata?.description}</p>
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wider opacity-70">
                      {badge.metadata?.criteria ? "Verified" : "Earned"}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center text-muted-foreground bg-muted/20 border-dashed">
                <Award className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No badges earned yet. Complete lessons to earn your first badge!</p>
              </Card>
            )}
          </motion.div>
        </motion.div>
      </main>

      {/* Course Content Modal */}
      <CourseContentModal
        roadmap={selectedRoadmap}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onStartLearning={handleStartLearning}
        completedTopics={completedTopics}
        onTopicComplete={(topic) => {
          // STRICT ALPHANUMERIC ONLY - same as fetchUserProgress to ensure consistent matching
          const normalizeString = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
          const normalized = normalizeString(topic)
          // Also create slug format to match what's stored in backend (item_id format)
          const slug = topic.toLowerCase().replace(/\s+/g, '-')

          // Add topic to completed set optimistically with ALL possible matching formats
          setCompletedTopics(prev => new Set([...prev, topic, topic.toLowerCase(), normalized, slug]))

          // Optimistically recalculate progress for the selected roadmap
          if (selectedRoadmap) {
            const newCompletedSet = new Set([...completedTopics, topic, topic.toLowerCase(), normalized, slug])
            let totalTopics = 0
            let completedCount = 0

            selectedRoadmap.modules?.forEach((mod: any) => {
              mod.topics?.forEach((t: string) => {
                totalTopics++
                const tNorm = normalizeString(t)
                const tSlug = t.toLowerCase().replace(/\s+/g, '-')
                // Check all possible matching formats
                const isMatch = newCompletedSet.has(t) ||
                  newCompletedSet.has(t.toLowerCase()) ||
                  newCompletedSet.has(tNorm) ||
                  newCompletedSet.has(tSlug)

                if (isMatch) {
                  completedCount++
                }
              })
            })

            setRoadmapProgress(prev => ({
              ...prev,
              [selectedRoadmap.id]: totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0
            }))
          }

          // Refresh all data from backend (non-blocking)
          if (user) {
            // Small delay to allow backend to index/write if needed
            setTimeout(() => fetchUserProgress(true), 500)
          }
        }}

      />

      {/* Goal Editing Dialog */}
      <Dialog open={isEditingGoal} onOpenChange={setIsEditingGoal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              {currentGoal ? 'Edit Your Goal' : 'Set Your Learning Goal'}
            </DialogTitle>
            <DialogDescription>
              What do you want to become? This helps us personalize your learning journey.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="e.g., Full Stack Developer, Data Scientist, ML Engineer..."
              value={tempGoal}
              onChange={(e) => setTempGoal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveGoal()}
              className="w-full"
              autoFocus
            />
            <div className="flex flex-wrap gap-2">
              <p className="text-xs text-muted-foreground w-full mb-1">Popular choices:</p>
              {['Full Stack Developer', 'Frontend Developer', 'Backend Developer', 'Data Scientist', 'ML Engineer', 'DevOps Engineer', 'Mobile Developer', 'Cloud Architect'].map((goal) => (
                <Button
                  key={goal}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setTempGoal(goal)}
                >
                  {goal}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSaveGoal} disabled={!tempGoal.trim()}>
              <Trophy className="h-4 w-4 mr-2" />
              Save Goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
