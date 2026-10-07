"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { VideoPlayer } from "@/components/space/video-player"
import { VideoChat } from "@/components/space/video-chat"
import { PlaylistSidebar } from "@/components/space/playlist-sidebar"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import type { VideoMetadata, VideoChatMessage } from "@/lib/types"

export default function PlaylistPage() {
    const params = useParams()
    const router = useRouter()
    const playlistId = params.id as string

    const [videos, setVideos] = useState<VideoMetadata[]>([])
    const [currentVideo, setCurrentVideo] = useState<VideoMetadata | null>(null)
    const [messages, setMessages] = useState<VideoChatMessage[]>([])
    const [currentTime, setCurrentTime] = useState(0)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        fetchPlaylist()
    }, [playlistId])

    const fetchPlaylist = async () => {
        setIsLoading(true)
        try {
            const response = await fetch(`/api/v1/space/playlist?playlistId=${playlistId}`, {
                headers: {
                    Authorization: "Bearer test-key",
                },
            })
            const data = await response.json()
            setVideos(data.videos || [])
            if (data.videos && data.videos.length > 0) {
                setCurrentVideo(data.videos[0])
            }
        } catch (error) {
            console.error("Error fetching playlist:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleVideoSelect = (video: VideoMetadata) => {
        setCurrentVideo(video)
        setMessages([])
        setCurrentTime(0)
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
            const response = await fetch("/api/v1/space/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer test-key",
                },
                body: JSON.stringify({
                    message,
                    videoContext: currentVideo?.title,
                    currentTimestamp: currentTime,
                }),
            })
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
        }
    }

    return (
        <div className="min-h-screen bg-background">

            <main className="container mx-auto px-4 py-8">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    {/* Header */}
                    <div className="mb-6 flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push("/space")}
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold font-display">
                                <span className="text-primary">
                                    Playlist
                                </span>
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                {videos.length} videos in this playlist
                            </p>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center h-96">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* Main Content - Video Player + Description */}
                            <div className="lg:col-span-8 space-y-4">
                                {currentVideo && (
                                    <>
                                        <VideoPlayer
                                            videoId={currentVideo.videoId}
                                            onTimeUpdate={setCurrentTime}
                                        />
                                        <div className="p-4 rounded-lg bg-card border border-border">
                                            <h2 className="text-lg font-bold mb-2">{currentVideo.title}</h2>
                                            <p className="text-sm text-muted-foreground mb-3">
                                                {currentVideo.channelName}
                                            </p>
                                            {currentVideo.description && (
                                                <div className="text-sm text-muted-foreground">
                                                    <p className="whitespace-pre-wrap">{currentVideo.description}</p>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Sidebar - Playlist Videos + Chat */}
                            <div className="lg:col-span-4 space-y-4">
                                <PlaylistSidebar
                                    videos={videos}
                                    currentVideoId={currentVideo?.videoId}
                                    onSelectVideo={handleVideoSelect}
                                />
                                <VideoChat
                                    messages={messages}
                                    onSendMessage={handleSendMessage}
                                    videoTitle={currentVideo?.title || ""}
                                />
                            </div>
                        </div>
                    )}
                </motion.div>
            </main>
        </div>
    )
}
