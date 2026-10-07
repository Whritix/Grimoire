"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { StopCircle, Code, Video } from "lucide-react"
import { WebcamView } from "./webcam-view"
import { AIAvatar } from "./ai-avatar"
import { CaptionDisplay } from "./caption-display"
import { CodePlayground } from "./code-playground"
import type { InterviewSession as ISession } from "@/lib/types"

interface InterviewSessionProps {
    session: ISession
    onComplete: (transcript: string, videoAnalysis?: any) => void
}

export function InterviewSession({ session, onComplete }: InterviewSessionProps) {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
    const [isRecording, setIsRecording] = useState(true)
    const [elapsedTime, setElapsedTime] = useState(0)
    const [transcript, setTranscript] = useState<string[]>([])
    const [showCodeEditor, setShowCodeEditor] = useState(false)
    const [userCode, setUserCode] = useState("")
    const [captionMessages, setCaptionMessages] = useState<Array<{ id: string; type: "ai" | "user"; text: string }>>([])
    const [currentCaption, setCurrentCaption] = useState("")

    const currentQuestion = session.questions[currentQuestionIndex]
    const progress = ((currentQuestionIndex + 1) / session.questions.length) * 100
    const isCodingQuestion = currentQuestion.type === "technical"

    useEffect(() => {
        const timer = setInterval(() => {
            setElapsedTime((prev) => prev + 1)
        }, 1000)

        return () => clearInterval(timer)
    }, [])

    // Add AI question to captions when question changes
    useEffect(() => {
        setCaptionMessages((prev) => [
            ...prev,
            {
                id: `ai-${currentQuestionIndex}`,
                type: "ai",
                text: currentQuestion.question,
            },
        ])
    }, [currentQuestionIndex, currentQuestion.question])

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    }

    const handleNextQuestion = () => {
        // Mock: add answer to transcript
        const answer = showCodeEditor ? userCode : "[Verbal answer recorded]"
        setTranscript([...transcript, `Q: ${currentQuestion.question}`, `A: ${answer}`])

        // Add user answer to captions
        setCaptionMessages((prev) => [
            ...prev,
            {
                id: `user-${currentQuestionIndex}`,
                type: "user",
                text: showCodeEditor ? "Submitted code solution" : "Answered verbally",
            },
        ])

        if (currentQuestionIndex < session.questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1)
            setShowCodeEditor(false)
            setUserCode("")
        } else {
            handleEndInterview()
        }
    }

    const handleEndInterview = () => {
        setIsRecording(false)
        const fullTranscript = transcript.join("\n\n")
        onComplete(fullTranscript, { duration: elapsedTime })
    }

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-7xl mx-auto"
            >
                {/* Recording Indicator & Progress */}
                <div className="flex items-center justify-between mb-6 p-4 rounded-xl bg-card border border-border">
                    <div className="flex items-center gap-3">
                        {isRecording && (
                            <div className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-sm font-medium">Recording</span>
                            </div>
                        )}
                        <span className="text-sm text-muted-foreground">
                            Question {currentQuestionIndex + 1} of {session.questions.length}
                        </span>
                    </div>
                    <span className="text-sm font-mono">{formatTime(elapsedTime)}</span>
                </div>

                {/* Progress */}
                <Progress value={progress} className="mb-6" />

                {/* Main Interview Layout - 3 Columns */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
                    {/* Left: AI Avatar + Question */}
                    <div className="lg:col-span-3 space-y-4">
                        <div className="p-6 rounded-2xl bg-card border border-border flex flex-col items-center">
                            <AIAvatar isActive={isRecording} isSpeaking={false} />
                            <h3 className="text-lg font-bold font-display mt-4 mb-2">AI Interviewer</h3>
                            <p className="text-xs text-muted-foreground text-center">
                                Listening to your response...
                            </p>
                        </div>

                        <div className="p-4 rounded-xl bg-card border border-border">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary font-medium">
                                    {currentQuestion.type}
                                </span>
                                <span className="text-xs px-2 py-1 rounded bg-accent/10 text-accent font-medium">
                                    {currentQuestion.difficulty}
                                </span>
                            </div>
                            <p className="text-sm font-semibold">{currentQuestion.question}</p>
                        </div>
                    </div>

                    {/* Center: Webcam or Code Editor */}
                    <div className="lg:col-span-6">
                        {!showCodeEditor ? (
                            <WebcamView isRecording={isRecording} />
                        ) : (
                            <CodePlayground
                                initialCode={userCode}
                                language="javascript"
                                onChange={setUserCode}
                            />
                        )}

                        {/* Toggle Button for Coding Questions */}
                        {isCodingQuestion && (
                            <div className="mt-4 flex justify-center">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowCodeEditor(!showCodeEditor)}
                                    className="gap-2"
                                >
                                    {showCodeEditor ? (
                                        <>
                                            <Video className="h-4 w-4" />
                                            Show Webcam
                                        </>
                                    ) : (
                                        <>
                                            <Code className="h-4 w-4" />
                                            Open Code Editor
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Right: Transcript/Answers */}
                    <div className="lg:col-span-3">
                        <div className="p-6 rounded-2xl bg-card border border-border h-full">
                            <h3 className="font-bold font-display mb-4">Conversation</h3>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {captionMessages.slice(-5).map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`p-3 rounded-lg ${msg.type === "ai" ? "bg-primary/10" : "bg-muted"
                                            }`}
                                    >
                                        <span className="text-xs font-semibold opacity-70 uppercase">
                                            {msg.type === "ai" ? "AI:" : "You:"}
                                        </span>
                                        <p className="text-sm mt-1">{msg.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex gap-3">
                    <Button variant="outline" onClick={handleEndInterview} className="flex-1">
                        <StopCircle className="mr-2 h-4 w-4" />
                        End Interview
                    </Button>
                    <Button
                        onClick={handleNextQuestion}
                        className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                        {currentQuestionIndex < session.questions.length - 1 ? "Next Question" : "Finish Interview"}
                    </Button>
                </div>
            </motion.div>

            {/* Live Captions Overlay */}
            <CaptionDisplay messages={captionMessages} currentMessage={currentCaption} />
        </>
    )
}
