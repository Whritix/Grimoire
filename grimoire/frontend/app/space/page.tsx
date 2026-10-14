"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { VideoPlayer } from "@/components/space/video-player"
import { VideoChat } from "@/components/space/video-chat"
import { VideoInput } from "@/components/space/video-input"
import { VideoInfo } from "@/components/space/video-info"
import { WorkflowBox } from "@/components/space/workflow-box"
import type { VideoMetadata, VideoChatMessage } from "@/lib/types"

/**
 * Extract YouTube video ID from URL
 */
function extractVideoId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\?\/]+)/,
        /youtube\.com\/embed\/([^&\?\/]+)/,
        /youtube\.com\/v\/([^&\?\/]+)/,
    ]

    for (const pattern of patterns) {
        const match = url.match(pattern)
        if (match) return match[1]
    }
    return null
}

/**
 * Extract YouTube playlist ID from URL
 */
function extractPlaylistId(url: string): string | null {
    const patterns = [
        /[?&]list=([^&]+)/,
        /youtube\.com\/playlist\?list=([^&]+)/,
    ]

    for (const pattern of patterns) {
        const match = url.match(pattern)
        if (match) return match[1]
    }
    return null
}



export default function SpacePage() {
    const router = useRouter()

    const [videoData, setVideoData] = useState<VideoMetadata | null>(null)
    const [messages, setMessages] = useState<VideoChatMessage[]>([])
    const [currentTime, setCurrentTime] = useState(0)
    const [sessionId, setSessionId] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        // Generate a random session ID on mount
        setSessionId(`user_${Math.random().toString(36).slice(2, 10)}`)
    }, [])

    const handleVideoSubmit = async (url: string) => {
        setIsLoading(true)

        // Check if it's a playlist URL
        const playlistId = extractPlaylistId(url)
        if (playlistId) {
            // Redirect to playlist page
            router.push(`/space/playlist/${playlistId}`)
            return
        }

        // Extract video ID from URL
        const videoId = extractVideoId(url)

        if (!videoId) {
            alert("Invalid YouTube URL. Please enter a valid YouTube video link.")
            setIsLoading(false)
            return
        }

        try {
            // Use API key for internal API calls (Clerk token is for user auth, not API auth)
            const response = await fetch("/api/v1/space/video-info", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer test-key",
                },
                body: JSON.stringify({ videoUrl: url }),
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            const data = await response.json()

            // Ensure we have the video ID in the response
            if (!data.videoId) {
                data.videoId = videoId
            }

            setVideoData(data)
            setMessages([])
            setCurrentTime(0)
            // Generate valid new session ID for the new video context
            setSessionId(`user_${Math.random().toString(36).slice(2, 10)}`)
        } catch (error) {
            console.error("Error loading video:", error)
            // Even if API fails, we can still show the video player
            setVideoData({
                videoId,
                title: "YouTube Video",
                description: "Loading video information...",
                duration: 0,
                thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                channelName: "Unknown",
                uploadDate: new Date().toISOString(),
                keyTopics: [],
                chapters: []
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleSendMessage = async (message: string) => {
        const userMessage: VideoChatMessage = {
            id: Date.now().toString(),
            role: "user",
            content: message,
            timestamp: Date.now(),
        }
        setMessages([...messages, userMessage])

        try {
            // Use API key for internal API calls
            const response = await fetch("/api/v1/space/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer test-key",
                },
                body: JSON.stringify({
                    message,
                    videoContext: `Title: ${videoData?.title}\n\nSummary: ${videoData?.summary}\n\nTranscript: ${videoData?.transcript?.slice(0, 20000)}...`, // Limit context size
                    currentTimestamp: currentTime,
                    sessionId: sessionId,
                }),
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            const data = await response.json()

            const aiMessage: VideoChatMessage = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: data.reply,
                timestamp: Date.now(),
                relevantTimestamps: data.relevantTimestamps,
                suggestions: data.suggestions,
            }
            setMessages((prev) => [...prev, aiMessage])
        } catch (error) {
            console.error("Error sending message:", error)
            // Add error message
            const errorMessage: VideoChatMessage = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: "Sorry, I encountered an error processing your message. Please try again.",
                timestamp: Date.now(),
            }
            setMessages((prev) => [...prev, errorMessage])
        }
    }

    const handleClearVideo = () => {
        setVideoData(null)
        setMessages([])
        setCurrentTime(0)

    }

    return (
        <div className="min-h-screen bg-background">

            <main className="container mx-auto px-4 py-8">
                {!videoData && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8"
                    >
                        <h1 className="text-3xl md:text-4xl font-bold font-display mb-4">
                            <span className="text-primary">
                                GRIMOIRE
                            </span>{" "}
                            - Space
                        </h1>
                        <p className="text-muted-foreground max-w-2xl">
                            Learn from YouTube videos with an AI assistant that understands the content and helps you grasp concepts better.
                        </p>
                    </motion.div>
                )}

                {!videoData && <WorkflowBox />}

                <VideoInput onSubmit={handleVideoSubmit} isLoading={isLoading} />

                {videoData && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6"
                    >
                        {/* Left side - Video Player (2/3 width on large screens) */}
                        <div className="lg:col-span-2 space-y-6">
                            <VideoPlayer
                                videoId={videoData.videoId}
                                onTimeUpdate={setCurrentTime}
                            />
                            <VideoInfo metadata={videoData} currentTime={currentTime} />
                        </div>

                        {/* Right side - Chat (1/3 width on large screens) */}
                        <div className="lg:col-span-1">
                            <VideoChat
                                messages={messages}
                                onSendMessage={handleSendMessage}
                                videoTitle={videoData.title}
                            />
                        </div>
                    </motion.div>
                )}

                {!videoData && !isLoading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-16 text-center text-muted-foreground"
                    >
                        <p className="text-lg">Enter a YouTube video URL or playlist to get started</p>
                        <p className="text-sm mt-2">Your AI learning companion is ready to help you understand any video content</p>
                    </motion.div>
                )}
            </main>
        </div>
    )
}
