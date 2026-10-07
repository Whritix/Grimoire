"use client"

import { useState, useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import { motion, AnimatePresence } from "framer-motion"
import { RoadmapStepper } from "@/components/roadmap/roadmap-stepper"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { mockRoadmap } from "@/lib/mocks/roadmap"
import type { RoadmapModule } from "@/lib/types"
import { Loader2, Compass, Clock, Target, CheckCircle2, ArrowRight, AlertCircle, Sparkles } from "lucide-react"

type RoadmapStage = "input" | "prerequisites" | "summary" | "loading" | "display" | "display_guided"

interface PrerequisiteQuestion {
  id: string
  text: string
  options: { id: string; text: string }[]
  topics_if_no?: string[]
  blocks_next_if?: string[] // IDs of answers that should stop the flow (e.g., "no")
}

export default function RoadmapPage() {
  const { user } = useUser()
  const [stage, setStage] = useState<RoadmapStage>("input")
  const [technology, setTechnology] = useState("")
  const [level, setLevel] = useState("beginner")
  const [timeCommitment, setTimeCommitment] = useState("10")
  const [roadmap, setRoadmap] = useState<RoadmapModule[] | null>(null)
  const [assessmentData, setAssessmentData] = useState<any>(null)
  
  // Prerequisite State
  const [prereqQuestions, setPrereqQuestions] = useState<PrerequisiteQuestion[]>([])
  const [userAnswers, setUserAnswers] = useState<Record<string, { answerId: string; answerText: string }>>({})
  const [analyzingPrereqs, setAnalyzingPrereqs] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [detectedGaps, setDetectedGaps] = useState<string[]>([])

  useEffect(() => {
    const savedResult = localStorage.getItem("assessmentResult")
    const savedTopic = localStorage.getItem("assessmentTopic")

    if (savedResult && savedTopic) {
      setAssessmentData(JSON.parse(savedResult))
      setTechnology(savedTopic)
      // Clear localStorage so we don't auto-trigger on next visit
      localStorage.removeItem("assessmentResult")
      localStorage.removeItem("assessmentTopic")
      // Still go through prerequisites flow even with assessment data
      handleGetPrerequisitesForTopic(savedTopic)
    }
  }, [])

  // Helper function to get prerequisites for a specific topic (used by useEffect)
  const handleGetPrerequisitesForTopic = async (topic: string) => {
      if (!topic.trim()) {
        return
      }
      
      setAnalyzingPrereqs(true)
      try {
        const response = await fetch("/api/v1/agents/planner/prerequisites", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test-key",
          },
          body: JSON.stringify({ topic, level }),
        })
        
        const data = await response.json()
        
        // Handle different response structures
        let questions: PrerequisiteQuestion[] = []
        if (data.agent_output?.payload?.questions) {
            questions = data.agent_output.payload.questions
        } else if (data.payload?.questions) {
            questions = data.payload.questions
        } else if (data.questions) {
             questions = data.questions
        }
        
        if (questions && questions.length > 0) {
          setPrereqQuestions(questions)
          setStage("prerequisites")
          setCurrentQuestionIndex(0)
          setUserAnswers({})
          setDetectedGaps([])
        } else {
          // No questions needed, proceed directly
          handleGenerateRoadmap(topic)
        }
      } catch (error) {
        console.error("Failed to get prerequisites:", error)
        // Fallback to direct generation
        handleGenerateRoadmap(topic)
      } finally {
        setAnalyzingPrereqs(false)
      }
  }

  const handleGetPrerequisites = async () => {
      if (!technology.trim()) {
        alert("Please enter a technology or field")
        return
      }
      await handleGetPrerequisitesForTopic(technology)
  }

  const handleAnswer = (questionId: string, answerId: string, answerText: string) => {
      // Record answer
      const answerRecord = { answerId, answerText }
      const newAnswers = { ...userAnswers, [questionId]: answerRecord }
      setUserAnswers(newAnswers)

      // Check current question logic
      const currentQ = prereqQuestions[currentQuestionIndex]
      
      // Gap Detection Logic
      let newGaps = [...detectedGaps]
      // If answer is "no" or "basic" and there are topics_if_no
      const isNegative = answerId === 'no' || answerId === 'basic' || answerText.toLowerCase().includes('no') || answerText.toLowerCase().includes('new')
      
      if (isNegative && currentQ.topics_if_no) {
          // Add unique gaps
          currentQ.topics_if_no.forEach(gap => {
              if (!newGaps.includes(gap)) newGaps.push(gap)
          })
      }
      setDetectedGaps(newGaps)

      // Branching Logic: Check if we should stop
      const shouldBlock = currentQ.blocks_next_if?.includes(answerId)
      
      if (shouldBlock) {
          // Stop here and go to summary immediately
          console.log("Blocking further questions due to answer:", answerId)
          // Optionally, we could clear subsequent answers if any
          setStage("summary")
      } else if (currentQuestionIndex < prereqQuestions.length - 1) {
          // Go to next question
          setTimeout(() => setCurrentQuestionIndex(prev => prev + 1), 250) // Small delay for UX
      } else {
          // Finished all questions
          setStage("summary")
      }
  }

  const handleGenerateRoadmap = async (tech?: string) => {
    const targetTech = tech || technology

    if (!targetTech.trim()) {
      alert("Please enter a technology or field")
      return
    }

    setStage("loading")

    // Format prerequisite updates if any
    const prerequisiteUpdates = Object.entries(userAnswers).map(([qid, ans]) => {
      const q = prereqQuestions.find(q => q.id === qid)
      return {
        question_id: qid,
        question_text: q?.text,
        answer: ans.answerId,
        answer_text: ans.answerText,
        topics_if_no: q?.topics_if_no
      }
    })

    try {
      const response = await fetch("/api/v1/agents/planner", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-key",
        },
        body: JSON.stringify({
          user_goal: `Learn ${targetTech} from ${level} level`,
          availability_hours_per_week: parseInt(timeCommitment),
          plan_type: "curriculum",
          // time_horizon_weeks: 12, // REMOVED: Let AI decide based on topic complexity
          prerequisite_updates: prerequisiteUpdates.length > 0 ? prerequisiteUpdates : undefined,
          model: "planner-v1",
          temperature: 0.0,
          max_tokens: 32000,
          messages: [
            {
              role: "user",
              content: `Create a comprehensive learning roadmap for ${targetTech} at ${level} level, with ${timeCommitment} hours per week available. Generate as many modules as the topic genuinely requires for complete coverage (20+ for complex topics). Do NOT arbitrarily limit the length.`
            }
          ],
        }),
      })
      
      console.log("Sending payload:", {
          user_goal: `Learn ${targetTech} from ${level} level`,
          prerequisite_updates: prerequisiteUpdates
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate roadmap')
      }

      const data = await response.json()

      console.log('API Response:', data)

      // Parse roadmap from backend response
      let parsedRoadmap: RoadmapModule[] | null = null

      // Handle OpenAI-compatible agent response structure
      if (data.agent_output?.type === "guided_learning_path" || data.type === "guided_learning_path") {
          const payload = data.agent_output?.payload || data.payload
          setRoadmap(null)
          setAssessmentData(payload) // Reusing assessmentData state for now to store guided path data
          setStage("display_guided") 
          return
      }

      if (data.agent_output?.payload?.modules && Array.isArray(data.agent_output.payload.modules)) {
        parsedRoadmap = data.agent_output.payload.modules
      }
      // Handle direct payload (if wrapper was stripped or different version)
      else if (data.payload?.modules && Array.isArray(data.payload.modules)) {
        parsedRoadmap = data.payload.modules
      }
      // Handle legacy/alternate field names
      else if (data.roadmap && Array.isArray(data.roadmap)) {
        parsedRoadmap = data.roadmap
      } else if (data.payload?.roadmap && Array.isArray(data.payload.roadmap)) {
        parsedRoadmap = data.payload.roadmap
      } else if (data.agent_output?.payload?.roadmap && Array.isArray(data.agent_output.payload.roadmap)) {
        parsedRoadmap = data.agent_output.payload.roadmap
      }

      if (parsedRoadmap && parsedRoadmap.length > 0) {
        setRoadmap(parsedRoadmap)
      } else {
        // Try to provide helpful error message
        let errorMessage = 'Received unexpected data format from AI.'
        
        // Check for caveat/error response from backend
        if (data.agent_output?.caveat && data.agent_output?.caveat_reason) {
          errorMessage = data.agent_output.caveat_reason
        } else if (data.error) {
          errorMessage = data.error
        } else if (data.agent_output?.payload?.raw_response) {
          // Backend sent raw response, schema validation likely failed
          errorMessage = 'AI response could not be parsed into modules. Please try again.'
        }
        
        console.error('Unexpected response format:', data)
        alert(`${errorMessage} Please try again.`)
        setStage("input")
        return
      }

      setStage("display")
    } catch (error) {
      console.error("Error generating roadmap:", error)
      alert(`Failed to generate roadmap: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setStage("input")
    }
  }

  const [isSaving, setIsSaving] = useState(false)

  const handleReset = () => {
    setStage("input")
    setTechnology("")
    setLevel("beginner")
    setTimeCommitment("10")
    setRoadmap(null)
    setAssessmentData(null)
    setPrereqQuestions([])
    setUserAnswers({})
    setDetectedGaps([])
    setCurrentQuestionIndex(0)
    localStorage.removeItem("assessmentResult")
    localStorage.removeItem("assessmentTopic")
  }

  const handleSave = async () => {
    if (!roadmap) return

    setIsSaving(true)
    try {
      const response = await fetch("/api/v1/roadmap/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roadmap,
          technology,
          level,
          userId: user?.id || null
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save roadmap")
      }

      window.location.href = "/dashboard"
    } catch (error) {
      console.error("Error saving roadmap:", error)
      alert("Failed to save roadmap. Please try again.")
      setIsSaving(false)
    }
  }

  const currentQ = prereqQuestions[currentQuestionIndex]

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] -left-10 w-160 h-160 bg-primary/5 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-pulse-slow" />
        <div className="absolute top-[20%] -right-20 w-140 h-140 bg-accent/5 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-pulse-slow animation-delay-2000" />
        <div className="absolute bottom-[-10%] left-1/3 w-180 h-180 bg-chart-4/5 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse-slow animation-delay-4000" />
      </div>

      <AnimatePresence mode="wait">
        {stage === "input" && (
          <main className="h-screen flex items-center justify-center px-4 relative">
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="max-w-2xl w-full"
            >
              <div className="text-center mb-6">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="inline-block mb-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-medium text-sm"
                >
                  AI Course Generator
                </motion.div>
                <h1 className="text-3xl md:text-4xl font-bold font-display mb-3 tracking-tight">
                  <span className="text-primary">
                    Design Your Path
                  </span>
                </h1>
                <p className="text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
                  Get a personalized learning roadmap tailored to your goals.
                </p>
              </div>

              <Card className="p-6 md:p-8 space-y-6 bg-card border border-border shadow-2xl relative overflow-hidden rounded-3xl">

                <div className="space-y-3 relative">
                  <label className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                      <Compass className="h-4 w-4" />
                    </div>
                    Technology / Field
                  </label>
                  <div className="relative">
                    <Input
                      placeholder="e.g., React, AI Engineer, DevOps, Full Stack..."
                      value={technology}
                      onChange={(e) => setTechnology(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleGetPrerequisites()}
                      className="text-lg py-6 px-5 rounded-xl border-border/50 bg-background/50 focus:bg-background transition-all shadow-sm focus:ring-2 focus:ring-primary/20"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:block">
                      <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded border border-border/50">Press Enter</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground pl-1">
                    Enter any technology, framework, or field you want to master
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                  <div className="space-y-3">
                    <label className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
                      <div className="p-1.5 rounded-lg bg-accent/10 text-accent">
                        <Target className="h-4 w-4" />
                      </div>
                      Current Level
                    </label>
                    <Select value={level} onValueChange={setLevel}>
                      <SelectTrigger className="h-12 rounded-xl border-border/50 bg-background/50 focus:bg-background transition-all">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Complete Beginner</SelectItem>
                        <SelectItem value="intermediate">Some Experience</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
                      <div className="p-1.5 rounded-lg bg-chart-4/10 text-chart-4">
                        <Clock className="h-4 w-4" />
                      </div>
                      Weekly Commitment
                    </label>
                    <Select value={timeCommitment} onValueChange={setTimeCommitment}>
                      <SelectTrigger className="h-12 rounded-xl border-border/50 bg-background/50 focus:bg-background transition-all">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 hours/week</SelectItem>
                        <SelectItem value="10">10 hours/week</SelectItem>
                        <SelectItem value="20">20 hours/week</SelectItem>
                        <SelectItem value="40">Full-time (40h/week)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  className="w-full h-14 text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 shadow-lg rounded-xl"
                  size="lg"
                  onClick={() => handleGetPrerequisites()}
                  disabled={!technology.trim() || analyzingPrereqs}
                >
                  {analyzingPrereqs ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Checking Prerequisites...
                    </>
                  ) : (
                    "Generate Roadmap"
                  )}
                </Button>

                <div className="pt-6 border-t border-border/50 relative">
                  <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wider">Popular Paths</h3>
                  <div className="flex flex-wrap gap-2">
                    {["React", "Node.js", "Python", "AI Engineer", "DevOps", "Full Stack", "Mobile Dev"].map((t) => (
                      <Button
                        key={t}
                        variant="outline"
                        size="sm"
                        onClick={() => setTechnology(t)}
                        className="rounded-full border-border/50 bg-background/30 hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all"
                      >
                        {t}
                      </Button>
                    ))}
                  </div>
                </div>
              </Card>
            </motion.div>
          </main>
        )}

        {stage === "prerequisites" && currentQ && (
        <main className="min-h-screen py-20 flex items-center justify-center px-4 relative">
          <motion.div
            key="prereq-wizard"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="max-w-xl w-full"
          >
            <div className="text-center mb-8">
              <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-1 rounded mb-2 inline-block">
                Question {currentQuestionIndex + 1} of {prereqQuestions.length}
              </span>
              <h2 className="text-2xl font-bold font-display mt-2 mb-2">Diagnostic Check</h2>
              <div className="w-full bg-border h-1.5 rounded-full overflow-hidden mt-4">
                  <motion.div 
                    className="h-full bg-primary"
                    initial={{ width: `${(currentQuestionIndex / prereqQuestions.length) * 100}%` }}
                    animate={{ width: `${((currentQuestionIndex + 1) / prereqQuestions.length) * 100}%` }}
                  />
              </div>
            </div>

            <Card className="p-8 space-y-8 bg-card border border-border shadow-2xl rounded-3xl">
               <div className="space-y-6">
                 <h3 className="text-xl font-medium leading-relaxed">
                   {currentQ.text}
                 </h3>
                 
                 <div className="space-y-3">
                    {currentQ.options.map((opt) => (
                        <button
                            key={opt.id}
                            onClick={() => handleAnswer(currentQ.id, opt.id, opt.text)}
                            className="w-full p-4 rounded-xl border text-left transition-all hover:bg-primary/5 hover:border-primary/50 group flex items-center justify-between bg-background"
                        >
                            <span className="font-medium group-hover:text-primary">{opt.text}</span>
                            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                        </button>
                    ))}
                 </div>
               </div>

               <div className="flex justify-between items-center pt-4 border-t border-border/50">
                 <Button variant="ghost" onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))} disabled={currentQuestionIndex === 0}>
                     Back
                 </Button>
                 <span className="text-xs text-muted-foreground">
                    Your answers customize the roadmap
                 </span>
               </div>
            </Card>
          </motion.div>
        </main>
        )}

        {stage === "summary" && (
            <main className="min-h-screen py-20 flex items-center justify-center px-4 relative">
                <motion.div
                    key="summary"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-2xl w-full"
                >
                     <Card className="p-8 bg-card border border-border shadow-2xl rounded-3xl">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Sparkles className="w-8 h-8 text-primary" />
                            </div>
                            <h2 className="text-2xl font-bold font-display">Optimization Complete</h2>
                            <p className="text-muted-foreground mt-2">
                                We've analyzed your background and customized the path.
                            </p>
                        </div>

                        <div className="space-y-6 mb-8">
                             {detectedGaps.length > 0 ? (
                                 <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                                     <h3 className="font-semibold text-amber-500 flex items-center gap-2 mb-2">
                                         <AlertCircle className="w-4 h-4" />
                                         Detected Knowledge Gaps
                                     </h3>
                                     <p className="text-sm text-foreground/80 mb-3">
                                         We've added these foundational modules to your roadmap:
                                     </p>
                                     <div className="flex flex-wrap gap-2">
                                         {detectedGaps.map(gap => (
                                             <span key={gap} className="px-3 py-1 bg-background border border-border/50 rounded-lg text-sm font-medium">
                                                 {gap}
                                             </span>
                                         ))}
                                     </div>
                                 </div>
                             ) : (
                                 <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                                      <h3 className="font-semibold text-green-500 flex items-center justify-center gap-2">
                                         <CheckCircle2 className="w-4 h-4" />
                                         You're All Set!
                                     </h3>
                                     <p className="text-sm text-foreground/80 mt-1">
                                         Your prerequisite knowledge looks solid. We'll take you straight to the core topics.
                                     </p>
                                 </div>
                             )}
                        </div>

                        <Button 
                            className="w-full h-14 text-lg font-bold rounded-xl" 
                            onClick={() => handleGenerateRoadmap()}
                        >
                            Generate Optimized Roadmap
                        </Button>
                     </Card>
                </motion.div>
            </main>
        )}

        {stage === "loading" && (
          <main className="h-screen flex items-center justify-center px-4 relative">
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl text-center">
              <div className="relative w-24 h-24 mx-auto mb-8">
                <div className="absolute inset-0 rounded-full border-4 border-muted opacity-20" />
                <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                <div className="absolute inset-4 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                  <Compass className="h-8 w-8 text-primary" />
                </div>
              </div>
            <h2 className="text-3xl font-bold mb-4 font-display">Crafting Your Roadmap</h2>
            <p className="text-muted-foreground max-w-md mx-auto text-lg">
              Our AI is analyzing {technology} requirements, structuring modules, and curating resources specifically for you...
            </p>
          </motion.div>
        </main>
      )}

      {stage === "display" && roadmap && (
        <main className="container mx-auto px-4 py-8 relative">
          <motion.div
            key="display"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl mx-auto"
          >
              <div className="text-center mb-12">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                  className="inline-flex items-center justify-center p-3 mb-6 rounded-2xl bg-primary/10 border border-primary/20 shadow-lg"
                >
                  <Compass className="h-8 w-8 text-primary" />
                </motion.div>

                <h1 className="text-4xl md:text-5xl font-bold font-display mb-4">
                  <span className="text-primary">
                    {technology}
                  </span>{" "}
                  Roadmap
                </h1>
                <p className="text-xl text-muted-foreground max-w-xl mx-auto mb-8">
                  A comprehensive step-by-step guide from {level} to mastery
                </p>

                <div className="inline-flex flex-wrap gap-4 justify-center bg-card/50 backdrop-blur-sm border border-border/50 p-2 rounded-2xl shadow-sm">
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background/50 border border-border/50 text-sm font-medium">
                    📅 {timeCommitment} hrs/week
                  </span>
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background/50 border border-border/50 text-sm font-medium">
                    📚 {roadmap.length} modules
                  </span>
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background/50 border border-border/50 text-sm font-medium">
                    ⏱️ {roadmap.reduce((acc, m) => acc + (m.estimated_hours || m.estimatedHours || 0), 0)} total hours
                  </span>
                </div>
              </div>

              <div className="bg-card/30 backdrop-blur-md rounded-3xl p-6 md:p-10 border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-primary/50" />
                <RoadmapStepper modules={roadmap} />
              </div>

              <div className="mt-10 flex gap-4 justify-center">
                <Button variant="outline" size="lg" onClick={handleReset} className="h-12 px-6 rounded-xl border-border/50 hover:bg-muted/50">
                  Generate Another
                </Button>
                <Button onClick={handleSave} size="lg" disabled={isSaving} className="h-12 px-8 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg transition-all">
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save & Start Learning"
                  )}
              </Button>
            </div>
          </motion.div>
        </main>
      )}
      
      {stage === "display_guided" && (
          <main className="container mx-auto px-4 py-8 relative">
            <motion.div
              key="display_guided"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto"
            >
                <div className="text-center mb-10">
                  <h1 className="text-4xl font-bold font-display mb-4">Your Guided Learning Path</h1>
                   {assessmentData?.explanation && (
                     <p className="text-lg text-muted-foreground bg-primary/5 p-4 rounded-xl border border-primary/10 max-w-2xl mx-auto">
                        {assessmentData.explanation}
                     </p>
                   )}
                </div>

                <div className="space-y-6">
                    {assessmentData?.roadmaps?.map((map: any, idx: number) => {
                        const isLocked = map.status === "locked"
                        const isCompleted = map.status === "completed"
                        
                        return (
                        <Card key={idx} className={`p-6 border-l-4 shadow-lg transition-all ${isLocked ? 'border-l-muted bg-muted/20 opacity-70' : 'border-l-primary hover:shadow-xl'}`}>
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
                                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${isLocked ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'}`}>
                                            {idx + 1}
                                        </span>
                                        {map.title}
                                        {isLocked && <span className="text-xs bg-muted px-2 py-0.5 rounded ml-2">Locked</span>}
                                        {!isLocked && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded ml-2 font-medium">Active</span>}
                                    </h3>
                                    <p className="text-muted-foreground ml-10">
                                        {map.description}
                                    </p>
                                </div>
                                <Button 
                                    onClick={() => window.location.href = `/dashboard?roadmapId=${map.id}`}
                                    className="ml-10 md:ml-0"
                                    variant={isLocked ? "outline" : "default"}
                                    disabled={isLocked}
                                >
                                    {isLocked ? "Complete Previous" : "View Roadmap"}
                                </Button>
                            </div>
                        </Card>
                    )})}
                </div>

                <div className="mt-12 text-center">
                     <Button variant="outline" onClick={handleReset} className="h-12 px-6 rounded-xl">
                        Start Over
                     </Button>
                     <p className="mt-4 text-sm text-muted-foreground">All these roadmaps have been saved to your dashboard.</p>
                </div>
            </motion.div>
          </main>
      )}

      </AnimatePresence>
    </div>
  )
}
