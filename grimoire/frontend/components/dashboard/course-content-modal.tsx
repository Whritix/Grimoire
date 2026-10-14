"use client"

import * as React from "react"
import { useUser } from "@clerk/nextjs"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
// import { ScrollArea } from "@/components/ui/scroll-area"
import { CheckCircle2, Circle, Clock, PlayCircle, Loader2, BookOpen } from "lucide-react"
import { useRouter } from "next/navigation"

interface CourseContentModalProps {
    roadmap: any
    isOpen: boolean
    onClose: () => void
    onStartLearning: (topic: string, context: string) => void
    completedTopics?: Set<string>
    onTopicComplete?: (topic: string) => void
}

export function CourseContentModal({
    roadmap,
    isOpen,
    onClose,
    onStartLearning,
    completedTopics = new Set(),
    onTopicComplete,
}: CourseContentModalProps) {
    const { user } = useUser()
    const [markingTopic, setMarkingTopic] = React.useState<string | null>(null)
    const [selectedTopic, setSelectedTopic] = React.useState<string | null>(null)

    const handleMarkComplete = async (topic: string) => {
        if (!user) {
            alert("Please sign in to track progress")
            return
        }

        setMarkingTopic(topic)
        console.log(`[Progress] Marking topic "${topic}" as complete for user ${user.id}`)

        try {
            const response = await fetch("/api/v1/progress/update", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer test-key" },
                body: JSON.stringify({
                    user_id: user.id,
                    item_type: "lesson",
                    item_id: topic.toLowerCase().replace(/\s+/g, '-'),
                    title: topic,
                    completed_at: new Date().toISOString()
                })
            })

            if (response.ok) {
                console.log(`[Progress] Successfully marked "${topic}" as complete`)
                // Invalidate dashboard cache so it re-fetches fresh progress
                try { sessionStorage.removeItem(`dashboard_v1_${user.id}`) } catch (_) {}
                if (onTopicComplete) {
                    onTopicComplete(topic)
                }
            } else {
                const errorData = await response.json().catch(() => ({}))
                console.error(`[Progress] Failed to mark "${topic}" complete. Status: ${response.status}`, errorData)
            }
        } catch (err) {
            console.error("[Progress] Failed to mark topic complete", err)
        } finally {
            setMarkingTopic(null)
        }
    }

    // If no roadmap selected, don't render content (or render placeholder)
    if (!roadmap) return null

    const modules = roadmap.modules || []

    return (
        <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                {!selectedTopic ? (
                    <>
                        <DialogHeader className="p-6 pb-2">
                            <div className="flex items-center gap-3 mb-2">
                                <DialogTitle className="text-2xl font-bold font-display">
                                    {roadmap.technology || "Course Content"}
                                </DialogTitle>
                                <Badge variant="outline" className="capitalize">
                                    {roadmap.level}
                                </Badge>
                            </div>
                            <DialogDescription>
                                {roadmap.goal || "Master this technology with our structured learning path."}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 px-6 pb-6 overflow-y-auto">
                            <div className="space-y-6">
                                <Accordion type="single" collapsible className="w-full">
                                    {modules.map((module: any, index: number) => (
                                        <AccordionItem key={module.id || index} value={`item-${index}`}>
                                            <AccordionTrigger className="hover:no-underline px-2">
                                                <div className="flex flex-col items-start text-left gap-1">
                                                    <span className="font-semibold text-lg flex items-center gap-2">
                                                        Module {index + 1}: {module.title}
                                                    </span>
                                                    <span className="text-sm text-muted-foreground font-normal">
                                                        {module.estimated_hours || module.estimatedHours || 0} Hours • {module.topics?.length || 0} Topics
                                                    </span>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="px-2 pt-2 pb-4">
                                                <p className="text-sm text-muted-foreground mb-4">
                                                    {module.description}
                                                </p>

                                                <div className="space-y-2">
                                                    {module.topics && module.topics.map((topic: string, tIndex: number) => {
                                                        // STRICT ALPHANUMERIC ONLY to ensure perfect matching
                                                        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

                                                        const isCompleted = completedTopics.has(topic) ||
                                                            completedTopics.has(topic.toLowerCase()) ||
                                                            completedTopics.has(normalize(topic));

                                                        const isMarking = markingTopic === topic;

                                                        return (
                                                            <div
                                                                key={tIndex}
                                                                className="flex items-center justify-between p-3 rounded-lg border bg-card/50 hover:bg-accent/50 transition-colors"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <button
                                                                        onClick={() => !isCompleted && handleMarkComplete(topic)}
                                                                        disabled={isCompleted || isMarking}
                                                                        className="focus:outline-none disabled:cursor-default"
                                                                        title={isCompleted ? "Completed" : "Click to mark as complete"}
                                                                    >
                                                                        {isMarking ? (
                                                                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                                                        ) : isCompleted ? (
                                                                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                                                                        ) : (
                                                                            <Circle className="h-5 w-5 text-muted-foreground hover:text-primary cursor-pointer" />
                                                                        )}
                                                                    </button>
                                                                    <span className={`font-medium ${isCompleted ? 'text-muted-foreground line-through' : ''}`}>
                                                                        {topic}
                                                                    </span>
                                                                </div>

                                                                <Button
                                                                    size="sm"
                                                                    variant={isCompleted ? "outline" : "default"}
                                                                    onClick={() => setSelectedTopic(topic)} // Using selectedTopic state to trigger mode selection view locally
                                                                    className="gap-2"
                                                                >
                                                                    <PlayCircle className="h-4 w-4" />
                                                                    {isCompleted ? "Review" : "Start"}
                                                                </Button>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="p-8 flex flex-col items-center justify-center h-full text-center space-y-8">
                        <div>
                            <h3 className="text-2xl font-bold mb-2">Choose Learning Mode</h3>
                            <p className="text-muted-foreground">How would you like to learn <span className="text-primary font-semibold">{selectedTopic}</span>?</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
                            <button
                                onClick={() => {
                                    if (selectedTopic) {
                                        onStartLearning(selectedTopic, roadmap.technology)
                                        setSelectedTopic(null)
                                    }
                                }}
                                className="group p-6 rounded-2xl border-2 border-border hover:border-primary/50 hover:bg-accent/5 transition-all text-left space-y-4"
                            >
                                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <PlayCircle className="h-6 w-6 text-red-600" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-lg">Video Based</h4>
                                    <p className="text-sm text-muted-foreground">Watch curated video tutorials and visual explanations</p>
                                </div>
                            </button>

                            <button
                                onClick={() => {
                                    if (selectedTopic) {
                                        // Find the module that contains this topic to pass as context
                                        const module = modules.find((m: any) => 
                                            m.topics && m.topics.some((t: string) => t === selectedTopic)
                                        );
                                        const moduleContext = module ? ` - Module: ${module.title}` : "";
                                        
                                        // Redirect with mode=text and enriched context
                                        const contextString = `${roadmap.technology}${moduleContext}`;
                                        window.location.href = `/lesson/l1?topic=${encodeURIComponent(selectedTopic)}&context=${encodeURIComponent(contextString)}&mode=text`
                                        setSelectedTopic(null)
                                    }
                                }}
                                className="group p-6 rounded-2xl border-2 border-border hover:border-primary/50 hover:bg-accent/5 transition-all text-left space-y-4"
                            >
                                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <BookOpen className="h-6 w-6 text-blue-600" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-lg">Text Based</h4>
                                    <p className="text-sm text-muted-foreground">Read comprehensive AI-generated guides and documentation</p>
                                </div>
                            </button>
                        </div>

                        <Button variant="ghost" onClick={() => setSelectedTopic(null)}>
                            Cancel
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}

