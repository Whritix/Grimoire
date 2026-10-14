"use client"

import { useState, useEffect, use } from "react"
import { useUser } from "@clerk/nextjs"
import { motion } from "framer-motion"
import { LessonPlayer } from "@/components/lesson/lesson-player"
import { NotesPanel } from "@/components/lesson/notes-panel"
import { ResourceList } from "@/components/lesson/resource-list"
import { ChatWidget } from "@/components/chat/chat-widget"
import { mockLessonContent } from "@/lib/mocks/lessons"
import { ChatMarkdown } from "@/components/ui/chat-markdown"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"

export default function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = use(params)
  const { user } = useUser()
  const [loading, setLoading] = useState(true)
  const [lesson, setLesson] = useState<typeof mockLessonContent | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [originalTopic, setOriginalTopic] = useState<string>("") // Store original topic for progress tracking
  const [mode, setMode] = useState<string>("video")


  useEffect(() => {
    const fetchLesson = async () => {
      try {
        setLoading(true)
        const searchParams = new URLSearchParams(window.location.search)
        const topic = searchParams.get("topic") || lessonId
        const context = searchParams.get("context") || ""
        const currentMode = searchParams.get("mode") || "video"
        setMode(currentMode)
        setOriginalTopic(topic) // Save original topic for progress tracking

        let response;

        if (currentMode === 'text') {
           // Call Composer Agent for text-based learning
           response = await fetch("/api/v1/agents/composer", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer test-key",
              },
              body: JSON.stringify({
                  // Frontend proxy expects this structure
                  contextIds: [],
                  lessonMeta: { title: topic, context: context }
              })
           })
        } else {
           // Default: Call Lesson Agent (Video fetcher)
           response = await fetch("/api/v1/agents/lesson", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ topic, context })
           })
        }

        if (!response.ok) throw new Error("Failed to load lesson")

        const data = await response.json()

        // Map backend response to UI structure
        // data is { agent_output: { payload: { title, items, ... }, sources: [...] } }
        let lessonData = data.payload || {}
        let sources = data.sources || []

        if (data.agent_output) {
          lessonData = data.agent_output.payload || {}
          sources = data.agent_output.sources || []
        }

        // Handle raw_response if schema validation failed backend-side
        if (!lessonData.title && lessonData.raw_response) {
          try {
            // Clean markdown code blocks if present
            const cleanJson = lessonData.raw_response
              .replace(/^\s*```json\s*/, '')  // Remove start block with optional whitespace
              .replace(/^\s*```\s*/, '')      // Remove start block without json tag
              .replace(/\s*```\s*$/, '')      // Remove end block with optional whitespace
              .trim()                         // Trim any remaining whitespace
            lessonData = JSON.parse(cleanJson);
          } catch (e) {
            console.error("Failed to parse raw_response as JSON, using as raw text", e);
            // If text mode (composer) returns raw markdown, we might want to use it directly in notes
            if (mode === 'text' && typeof lessonData.raw_response === 'string') {
               // Construct a dummy lesson object around the raw markdown
               lessonData = {
                  title: topic,
                  items: [],
                  notes: { summary: lessonData.raw_response }
               }
            }
          }
        }


        // Find video
        const videoItem = lessonData.items?.find((item: any) => item.type === 'video')

        // Concatenate text for notes (Allow 'text', 'code', 'reading') - filter out null content
        let notesContent = lessonData.items
          ?.filter((item: any) => (item.type === 'text' || item.type === 'code' || item.type === 'reading') && item.content)
          .map((item: any) => {
            if (item.type === 'code') return `\n\`\`\`${item.language || ''}\n${item.content}\n\`\`\`\n`
            return item.content
          })
          .filter((content: any) => content) // Remove any null/undefined from map
          .join('\n\n')

        // Fallback to structured notes if items are empty
        if (!notesContent && lessonData.notes) {
          const { summary, bullets, code_snippets } = lessonData.notes
          notesContent = ''
          if (summary) notesContent += `### Summary\n${summary}\n\n`
          if (bullets && bullets.length) notesContent += `### Key Points\n${bullets.map((b: string) => `- ${b}`).join('\n')}\n\n`
          if (code_snippets && code_snippets.length) {
            notesContent += `### Code Examples\n`
            code_snippets.forEach((snippet: any) => {
              notesContent += `\n\`\`\`${snippet.language || ''}\n${snippet.code}\n\`\`\`\n`
            })
          }
        }

        // Try to extract from raw_response if still no content
        if (!notesContent && lessonData.raw_response) {
          if (typeof lessonData.raw_response === 'string' && lessonData.raw_response.length > 20) {
             notesContent = lessonData.raw_response;
          } else {
             notesContent = "Content is being processed. Please refresh the page."
          }
        }

        const aiNotes = notesContent || "No notes available for this lesson."

        // Extract YouTube ID from URL using robust matching
        // Extract YouTube ID from URL using robust matching
        let videoUrl = videoItem?.url || ""

        // Fallback: Check sources for YouTube video if not found in items
        if (!videoUrl && sources && sources.length > 0) {
           const youtubeSource = sources.find((s: any) => 
              s.url && (s.url.includes('youtube.com') || s.url.includes('youtu.be'))
           );
           if (youtubeSource) {
              videoUrl = youtubeSource.url;
           }
        }

        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
        const match = videoUrl.match(regExp)
        const videoId = (match && match[2].length === 11) ? match[2] : ""

        setLesson({
          title: lessonData.title || topic,
          videoId: videoId,
          resources: sources,
          aiNotes: aiNotes
        })
      } catch (error) {
        console.error("Lesson load error:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchLesson()
  }, [lessonId])

  const [completed, setCompleted] = useState(false)
  const [isMarking, setIsMarking] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const completedLessons = JSON.parse(localStorage.getItem("completed_lessons") || "[]")
        if (completedLessons.includes(lessonId)) {
          setCompleted(true)
        }
      } catch (_) {}
    }
  }, [lessonId])

  const handleComplete = async () => {
    setIsMarking(true)
    try {
      // Resolve active user ID safely (signed-in user or persistent guest ID)
      const activeUserId = user?.id || (typeof window !== "undefined" ? (localStorage.getItem("grimoire_guest_id") || (() => {
        const newId = `guest_${Math.random().toString(36).substring(2, 9)}`
        localStorage.setItem("grimoire_guest_id", newId)
        return newId
      })()) : "guest_user")

      // Optimistically mark completed in UI & localStorage
      setCompleted(true)
      if (typeof window !== "undefined") {
        try {
          const completedLessons = JSON.parse(localStorage.getItem("completed_lessons") || "[]")
          if (!completedLessons.includes(lessonId)) {
            completedLessons.push(lessonId)
            localStorage.setItem("completed_lessons", JSON.stringify(completedLessons))
          }
        } catch (_) {}
      }

      // Call API to sync progress
      const response = await fetch("/api/v1/progress/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-key"
        },
        body: JSON.stringify({
          user_id: activeUserId,
          item_type: "lesson",
          item_id: lessonId,
          title: originalTopic || lesson?.title || "Unknown Lesson",
          completed_at: new Date().toISOString()
        })
      })

      if (response.ok) {
        const data = await response.json().catch(() => ({}))
        console.log("📝 Mark complete response:", data)
      } else {
        const data = await response.json().catch(() => ({}))
        console.warn("Notice: Progress sync status:", data)
      }

      // Invalidate dashboard cache so next visit re-fetches fresh progress
      if (typeof window !== "undefined" && activeUserId) {
        try { sessionStorage.removeItem(`dashboard_v1_${activeUserId}`) } catch (_) {}
      }
    } catch (err) {
      console.warn("Notice: Local progress recorded, remote sync error:", err)
    } finally {
      setIsMarking(false)
    }
  }

  // State for chat-like continuations
  const [continuations, setContinuations] = useState<{id: string, role: 'user' | 'assistant', content: string}[]>([])

  const handleContinueLesson = async (query: string) => {
    if (!query.trim()) return;
    
    // Add user message immediately
    const userMsgId = Date.now().toString();
    setContinuations(prev => [...prev, { id: userMsgId, role: 'user', content: query }]);
    
    setLoading(true);
    try {
        // Prepare context from main lesson + previous continuations
        let currentContext = lesson?.aiNotes || "";
        // Append previous continuations to context to maintain conversation history
        if (continuations.length > 0) {
            currentContext += "\n\n" + continuations.map(c => `${c.role === 'user' ? 'User' : 'Associate'}: ${c.content}`).join("\n\n");
        }

        const response = await fetch("/api/v1/agents/composer", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer test-key",
            },
            body: JSON.stringify({
                contextIds: [],
                // Pass current content as a document for context
                documents: [{
                    id: 'current_lesson_context',
                    text: currentContext,
                    title: lesson?.title || 'Current Lesson Context',
                    source_type: 'context' 
                }],
                lessonMeta: { 
                    title: query, // The query becomes the "topic" for the new chunk
                    context: `Previous lesson context provided in documents. Continue the lesson by addressing: ${query}` 
                }
            })
        })

        if (!response.ok) throw new Error("Failed to continue lesson");

        const data = await response.json();
        let newContent = "";
        
        let lessonData = data.payload || {}
        if (data.agent_output) {
             lessonData = data.agent_output.payload || {}
        }

        if (lessonData.raw_response) {
            newContent = lessonData.raw_response;
        } else if (lessonData.notes?.summary) {
            newContent = lessonData.notes.summary;
        }

        // Add AI response as a new message
        setContinuations(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: newContent }]);

    } catch (err) {
        console.error("Failed to continue lesson", err);
        // Optionally add error message to chat
    } finally {
        setLoading(false);
    }
  }

  if (loading && !lesson) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-primary/10 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse-slow" />
        <div className="absolute bottom-0 -right-4 w-96 h-96 bg-accent/10 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse-slow animation-delay-2000" />
      </div>

      <main className="container mx-auto px-4 py-8 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-7xl mx-auto"
        >
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-card/50 backdrop-blur-sm p-6 rounded-2xl border border-white/10 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-linear-to-br from-primary/20 to-accent/20">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-3 py-1">
                  Topic
                </Badge>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold font-display text-foreground">
                {lesson?.title}
              </h1>
            </div>

            <button
              onClick={handleComplete}
              disabled={completed || isMarking}
              className={`px-6 py-2.5 rounded-xl font-medium transition-all duration-300 flex items-center gap-2 shadow-md ${completed
                ? "bg-green-500/10 text-green-600 border border-green-500/20 cursor-default"
                : "bg-primary text-white hover:bg-primary/90 hover:shadow-lg hover:scale-105 active:scale-95"
                }`}
            >
              {isMarking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {completed ? "Completed ✅" : "Mark as Complete"}
            </button>
          </div>

          {mode === 'text' ? (
            <div className="max-w-4xl mx-auto space-y-8">
              {/* Main Content */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="bg-card/50 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden p-8 md:p-12"
              >
                  <article className="prose prose-lg dark:prose-invert max-w-none">
                      <ChatMarkdown content={lesson?.aiNotes || ""} />
                  </article>
              </motion.div>
              
              {/* Continuations (Chat History) */}
              <div className="space-y-6">
                {continuations.map((msg) => (
                    <motion.div 
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`max-w-[90%] rounded-2xl p-6 ${
                            msg.role === 'user' 
                            ? 'bg-primary/10 text-foreground border border-primary/20' 
                            : 'bg-card/80 backdrop-blur-md border border-white/10 shadow-xl'
                        }`}>
                            {msg.role === 'user' ? (
                                <p className="text-lg font-medium">{msg.content}</p>
                            ) : (
                                <div className="prose prose-lg dark:prose-invert max-w-none">
                                    <ChatMarkdown content={msg.content} />
                                </div>
                            )}
                        </div>
                    </motion.div>
                ))}
              </div>

              {/* Input Area - Sticky Bottom */}
              <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-white/10 z-40">
                 <div className="max-w-4xl mx-auto">
                     <div className="relative">
                        <input
                           type="text"
                           placeholder="Ask next topic or doubt (e.g. 'Explain loops')..."
                           className="w-full bg-card/80 border border-white/10 rounded-2xl pl-6 pr-14 py-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-foreground placeholder:text-muted-foreground shadow-lg"
                           onKeyDown={(e) => {
                              if (e.key === 'Enter' && !loading) {
                                 const target = e.target as HTMLInputElement;
                                 handleContinueLesson(target.value);
                                 target.value = '';
                              }
                           }}
                        />
                        <button
                           className="absolute right-2 top-2 bottom-2 aspect-square bg-primary text-primary-foreground rounded-xl flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50"
                           disabled={loading}
                           onClick={(e) => {
                               const input = e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement;
                               handleContinueLesson(input.value);
                               input.value = '';
                           }}
                        >
                           {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="font-bold text-xl">↑</span>}
                        </button>
                     </div>
                 </div>
              </div>
              
              {/* Spacer for sticky footer */}
              <div className="h-24" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                {/* Video Section */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-black/50 backdrop-blur-xl"
                >
                  {lesson?.videoId ? (
                    <LessonPlayer videoId={lesson.videoId} />
                  ) : (
                    <div className="p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                      <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mb-4">
                        <Loader2 className="h-8 w-8 text-muted-foreground animate-spin-slow" />
                      </div>
                      <p className="text-muted-foreground">Video content is unavailable</p>
                    </div>
                  )}
                </motion.div>

                <ResourceList 
                    resources={lesson?.resources || []} 
                    className="bg-card/30 backdrop-blur-md rounded-2xl border border-white/5 p-6 shadow-xl"
                />
              </div>

              <div className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-card/50 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl overflow-hidden"
                >
                  <div className="p-1">
                    <NotesPanel notes={lesson?.aiNotes || ""} />
                  </div>
                </motion.div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setChatOpen(true)}
                  className="w-full p-4 rounded-xl bg-primary text-white font-bold shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2 group"
                >
                  <span className="bg-white/20 p-1.5 rounded-lg group-hover:rotate-12 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" /></svg>
                  </span>
                  Ask AI Assistant
                </motion.button>
              </div>
            </div>
          )}
        </motion.div>
      </main>

      <ChatWidget
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        lessonId={lessonId}
        lessonTitle={lesson?.title}
        lessonContent={lesson?.aiNotes}
      />
    </div>
  )
}
