"use client"

import * as React from "react"
import { useUser } from "@clerk/nextjs"
import { motion } from "framer-motion"
import { 
  Brain, 
  Sparkles, 
  GraduationCap, 
  Briefcase, 
  Zap, 
  BookOpen,
  ArrowRight,
  GitBranch,
  Save,
  Loader2,
  Mic2,
  Layout,
  FileText,
  Headphones,
  Map,
  ListTodo
} from "lucide-react"
import { useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { NotesInput } from "@/components/notes/notes-input"
import { AnalysisOutput } from "@/components/notes/analysis-output"
import { MindmapVisualization } from "@/components/notes/mindmap-visualization"
import { PodcastPlayer } from "@/components/notes/podcast-player"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type Goal = "exam_prep" | "interview_prep" | "quick_revision" | "concept_mastery"

interface AnalysisResult {
  high_priority: any[]
  medium_priority: any[]
  low_priority: any[]
  common_mistakes: string[]
  questions: string[]
  summary: string
  goal: string
  suggested_title?: string
}

interface MindmapResult {
  centerTopic: string
  nodes: { id: string; type: string; data: { label: string } }[]
  edges: { id: string; source: string; target: string }[]
}

const GOALS: { value: Goal; label: string; icon: React.ElementType; description: string }[] = [
  { 
    value: "exam_prep", 
    label: "Exam Preparation", 
    icon: GraduationCap,
    description: "Optimize for marks definitions"
  },
  { 
    value: "interview_prep", 
    label: "Interview Prep", 
    icon: Briefcase,
    description: "Real-world applications"
  },
  { 
    value: "quick_revision", 
    label: "Quick Revision", 
    icon: Zap,
    description: "Bullet points & formulas"
  },
  { 
    value: "concept_mastery", 
    label: "Concept Mastery", 
    icon: BookOpen,
    description: "Deep mental models"
  },
]

function resolvePodcastUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) return rawUrl

  const backendBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "")
  const normalizedPath = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`
  return `${backendBase}${normalizedPath}`
}


function NotesIntelligenceContent() {
  const { user } = useUser()
  
  // Form State
  const [notes, setNotes] = React.useState("")
  const [goal, setGoal] = React.useState<Goal>("exam_prep")
  const [subject, setSubject] = React.useState("")
  
  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = React.useState(false)
  const [result, setResult] = React.useState<AnalysisResult | null>(null)
  
  // Note Saving State
  const searchParams = useSearchParams()
  const [isSaving, setIsSaving] = React.useState(false)

  // Podcast State
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null)
  const [persistedPodcastUrl, setPersistedPodcastUrl] = React.useState<string | null>(null)
  const [isGeneratingAudio, setIsGeneratingAudio] = React.useState(false)

  // View State
  const [activeView, setActiveView] = React.useState<"analysis" | "mindmap" | "podcast">("analysis")

  // Load saved note if ID present
  React.useEffect(() => {
    const noteId = searchParams?.get('id')
    if (noteId && user) {
      const fetchSavedNote = async () => {
        try {
          setIsAnalyzing(true)
          const response = await fetch(`/api/v1/agents/notes-intelligence/${noteId}`)
          if (response.ok) {
            const data = await response.json()
            setNotes(data.full_notes || data.notes_preview || "")
            setSubject(data.subject || "")
            setGoal(data.goal as Goal)
            setResult(data.analysis_result)
            setMindmapResult(data.mindmap_result)

            const restoredAudioUrl = resolvePodcastUrl(data.podcast_audio_url)
            setPersistedPodcastUrl(data.podcast_audio_url || null)
            setAudioUrl(restoredAudioUrl)

            const restoredSegments = Array.isArray(data.podcast_segments)
              ? data.podcast_segments.filter((s: any) => s?.speaker && s?.text)
              : []
            setSegmentData(restoredSegments)
            setAudioSegments([])
            setStreamingProgress(null)
          }
        } catch (e) {
          console.error("Failed to load note", e)
        } finally {
          setIsAnalyzing(false)
        }
      }
      fetchSavedNote()
    }
  }, [searchParams, user])

  const handleSaveResults = async () => {
    if (!result || !user) return
    
    setIsSaving(true)
    try {
      const response = await fetch("/api/v1/agents/notes-intelligence/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          subject,
          goal,
          notes,
          analysis_result: result,
          mindmap_result: mindmapResult,
          podcast_audio_url: persistedPodcastUrl,
          podcast_segments: segmentData,
        })
      })
      
      if (response.ok) {
        await response.json()
        alert("Results saved successfully!")
      } else {
        const errorData = await response.text()
        console.error("Save failed:", response.status, errorData)
        try {
            const jsonError = JSON.parse(errorData)
            throw new Error(jsonError.detail || jsonError.error || "Failed to save results")
        } catch (e) {
            throw new Error(`Failed to save: ${response.status} ${response.statusText}`)
        }
      }
    } catch (e: any) {
      console.error("Save error:", e)
      alert(`Error saving results: ${e.message}`)
    } finally {
      setIsSaving(false)
    }
  }
  
  // Mindmap State
  const [isGeneratingMindmap, setIsGeneratingMindmap] = React.useState(false)
  const [mindmapResult, setMindmapResult] = React.useState<MindmapResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const canAnalyze = notes.length >= 50 && !isAnalyzing && !isGeneratingMindmap

  const handleAnalyze = async () => {
    if (!canAnalyze) return
    
    setIsAnalyzing(true)
    setError(null)
    setResult(null)
    setActiveView("analysis")

    try {
      const response = await fetch("/api/v1/agents/notes-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes,
          goal,
          subject: subject || undefined,
          user_id: user?.id || "anonymous"
        })
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || "Analysis failed")
      }

      const data = await response.json()
      const payload = data.agent_output?.payload || data.payload || data
      setResult(payload)

      if (payload.suggested_title && !subject) {
        setSubject(payload.suggested_title)
      }
    } catch (err: any) {
      console.error("Analysis error:", err)
      setError(err.message || "Failed to analyze notes. Please try again.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleGenerateMindmap = async () => {
    if (!canAnalyze) return
    setIsGeneratingMindmap(true)
    setError(null)
    setMindmapResult(null)
    setActiveView("mindmap")

    try {
      const response = await fetch("/api/v1/agents/generate-mindmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes,
          subject: subject || undefined,
          user_id: user?.id || "anonymous"
        })
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || "Mindmap generation failed")
      }

      const data = await response.json()
      const payload = data.agent_output?.payload || data.payload || data
      setMindmapResult(payload)
    } catch (err: any) {
      console.error("Mindmap generation error:", err)
      setError(err.message || "Failed to generate mindmap. Please try again.")
    } finally {
      setIsGeneratingMindmap(false)
    }
  }

  // Streaming Audio State
  const [audioSegments, setAudioSegments] = React.useState<string[]>([])
  const [segmentData, setSegmentData] = React.useState<{speaker: string, text: string}[]>([])
  const [streamingProgress, setStreamingProgress] = React.useState<{current: number, total: number} | null>(null)

  const handleGenerateAudio = async () => {
     if (!notes || notes.length < 50) return
     
     setIsGeneratingAudio(true)
     setActiveView("podcast")
     setAudioUrl(null)
    setPersistedPodcastUrl(null)
     setAudioSegments([])
     setSegmentData([])
     setStreamingProgress(null)
     
     try {
       const response = await fetch("/api/v1/agents/podcast/stream", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           content: notes,
           source_id: "preview"
         })
       })
       
       if (!response.ok) {
         const errorData = await response.json().catch(() => ({ error: response.statusText }))
         throw new Error(errorData.error || errorData.details || response.statusText)
       }

       const reader = response.body?.getReader()
       if (!reader) throw new Error("No response body")

       const decoder = new TextDecoder()
       let buffer = ""
       const segments: string[] = []
       const segmentsMetadata: {speaker: string, text: string}[] = []

       while (true) {
         const { done, value } = await reader.read()
         if (done) break

         buffer += decoder.decode(value, { stream: true })
         const lines = buffer.split("\n\n")
         buffer = lines.pop() || ""

         for (const line of lines) {
           if (line.startsWith("data: ")) {
             const jsonStr = line.slice(6)
             try {
               const event = JSON.parse(jsonStr)
               
               if (event.type === "script_ready") {
                 setStreamingProgress({ current: 0, total: event.total_segments })
               } else if (event.type === "segment") {
                 // Decode base64 audio and create blob URL
                 const audioBytes = Uint8Array.from(atob(event.audio), c => c.charCodeAt(0))
                 const blob = new Blob([audioBytes], { type: "audio/mpeg" })
                 const blobUrl = URL.createObjectURL(blob)
                 segments.push(blobUrl)
                 segmentsMetadata.push({ speaker: event.speaker, text: event.text })
                 setAudioSegments([...segments])
                 setSegmentData([...segmentsMetadata])
                 setStreamingProgress(prev => prev ? { ...prev, current: event.index + 1 } : null)
                 
                 // Set first segment as playable immediately
                 if (segments.length === 1) {
                   setAudioUrl(blobUrl)
                 }
               } else if (event.type === "saved") {
                 const resolvedAudio = resolvePodcastUrl(event.audio_url)
                 setPersistedPodcastUrl(event.audio_url || null)
                 if (resolvedAudio) {
                   setAudioUrl(resolvedAudio)
                 }
               } else if (event.type === "complete") {
                 console.log(`Audio generation complete: ${event.total_segments} segments`)
               } else if (event.type === "error") {
                 throw new Error(event.message)
               }
             } catch (parseError) {
               console.warn("Failed to parse SSE event:", parseError)
             }
           }
         }
       }
     } catch (e) {
       console.error("Audio generation failed", e)
       alert(`Failed to generate audio: ${e instanceof Error ? e.message : String(e)}`)
     } finally {
       setIsGeneratingAudio(false)
     }
  }



  return (
    <div className="min-h-screen bg-background">
      <main className="container-fluid px-4 py-6 max-w-[1600px] mx-auto">
        
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="p-2.5 bg-primary/10 rounded-xl">
                    <Brain className="h-6 w-6 text-primary" />
                </div>
                <div>
                   <h1 className="text-2xl font-bold font-display tracking-tight">Studio</h1>
                   <p className="text-sm text-muted-foreground">AI-Powered Research & Creation</p>
                </div>
            </div>
            
            <div className="flex items-center gap-2">
               <div className="flex items-center bg-muted/50 p-1 rounded-lg border border-border/50">
                  <Button 
                    variant={activeView === "analysis" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setActiveView("analysis")}
                    className={cn(
                      "gap-2 px-3", 
                      activeView === "analysis" && "bg-background text-foreground shadow-sm"
                    )}
                  >
                    <Sparkles className="h-4 w-4" />
                    <span className="hidden sm:inline">Analysis</span>
                  </Button>
                  
                  <Button 
                    variant={activeView === "mindmap" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setActiveView("mindmap")}
                    className={cn(
                      "gap-2 px-3", 
                      activeView === "mindmap" && "bg-background text-foreground shadow-sm"
                    )}
                  >
                    <GitBranch className="h-4 w-4" />
                    <span className="hidden sm:inline">Roadmap</span>
                  </Button>

                  <Button 
                    variant={activeView === "podcast" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setActiveView("podcast")}
                    className={cn(
                      "gap-2 px-3", 
                      activeView === "podcast" && "bg-background text-foreground shadow-sm"
                    )}
                  >
                    <Headphones className="h-4 w-4" />
                    <span className="hidden sm:inline">Podcast</span>
                  </Button>
               </div>

               {result && (
                <Button onClick={handleSaveResults} disabled={isSaving} variant="outline" size="sm" className="gap-2 ml-2">
                   <Save className="h-4 w-4" />
                   Save
                </Button>
               )}
            </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)]">
            
            {/* Left Column: Source Material (4 columns) */}
            <div className="lg:col-span-4 flex flex-col gap-4 h-full overflow-hidden">
                <Card className="flex-1 flex flex-col overflow-hidden border-border/50 shadow-sm">
                    <div className="p-4 border-b border-border/50 bg-muted/20 flex items-center justify-between">
                         <Label className="font-medium flex items-center gap-2">
                             <FileText className="h-4 w-4 text-primary" />
                             Source Material
                         </Label>
                         <span className="text-xs text-muted-foreground">{notes.length} chars</span>
                    </div>
                    
                    <div className="flex-1 p-0 overflow-hidden relative group">
                        <NotesInput 
                           value={notes} 
                           onChange={setNotes} 
                           disabled={isAnalyzing}
                           className="h-full w-full border-0 focus-visible:ring-0 rounded-none p-4 resize-none bg-transparent"
                           placeholder="Paste your notes, article text, or video transcript here..."
                        />
                    </div>
                    
                    <div className="p-4 border-t border-border/50 bg-muted/20 space-y-4">
                         <div className="space-y-2">
                           <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Analysis Goal</Label>
                           <Select value={goal} onValueChange={(v) => setGoal(v as Goal)}>
                              <SelectTrigger>
                                 <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                 {GOALS.map(g => (
                                   <SelectItem key={g.value} value={g.value}>
                                      <div className="flex items-center gap-2">
                                         <g.icon className="h-4 w-4" />
                                         <span>{g.label}</span>
                                      </div>
                                   </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
                         </div>
                         
                         <div className="flex gap-2">
                             <Button 
                               onClick={handleAnalyze} 
                               disabled={!canAnalyze}
                               className="flex-1 gap-2"
                             >
                                {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                Analyze
                             </Button>
                             <Button 
                               onClick={handleGenerateMindmap} 
                               disabled={!canAnalyze}
                               variant="outline"
                               className="flex-1 gap-2 border-primary/50 hover:bg-primary/5"
                             >
                                {isGeneratingMindmap ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitBranch className="h-4 w-4" />}
                                Mind Map
                             </Button>
                         </div>
                         
                         <Button
                           onClick={handleGenerateAudio}
                           disabled={!canAnalyze || isGeneratingAudio}
                           variant="secondary" 
                           className="w-full gap-2 bg-linear-to-r from-indigo-500/10 to-purple-500/10 hover:from-indigo-500/20 hover:to-purple-500/20 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300"
                         >
                            {isGeneratingAudio ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic2 className="h-4 w-4" />}
                            Generate Audio Overview
                         </Button>
                    </div>
                </Card>
            </div>

            {/* Right Column: Intelligence & Output (8 columns) */}
            <div className="lg:col-span-8 flex flex-col gap-6 h-full overflow-y-auto pr-1">
                
                {activeView === "podcast" && (
                   <PodcastPlayer 
                      audioUrl={audioUrl} 
                      audioSegments={audioSegments}
                      segmentData={segmentData}
                      streamingProgress={streamingProgress}
                      isLoading={isGeneratingAudio} 
                      onGenerate={handleGenerateAudio}
                      title={subject || "Untitled Notes"}
                   />
                )}

                {activeView === "analysis" && (
                   <Card className="flex-1 flex flex-col overflow-hidden border-border/50 shadow-sm min-h-[500px]">
                      <div className="flex-1 overflow-y-auto p-6 bg-muted/5">
                        <AnalysisOutput result={result} isLoading={isAnalyzing} />
                      </div>
                   </Card>
                )}

                {activeView === "mindmap" && (
                   <Card className="flex-1 flex flex-col overflow-hidden border-border/50 shadow-sm min-h-[500px]">
                      <div className="flex-1 overflow-hidden bg-muted/5">
                        <MindmapVisualization 
                          nodes={mindmapResult?.nodes || []} 
                          edges={mindmapResult?.edges || []} 
                          centerTopic={mindmapResult?.centerTopic || ""}
                          isLoading={isGeneratingMindmap}
                        />
                      </div>
                   </Card>
                )}
            </div>
        </div>
      </main>
    </div>
  )
}

export default function NotesIntelligencePage() {
  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <NotesIntelligenceContent />
    </React.Suspense>
  )
}
