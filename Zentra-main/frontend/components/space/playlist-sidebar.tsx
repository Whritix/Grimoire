"use client"

import { motion } from "framer-motion"
import { Play, Check, Clock } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { VideoMetadata } from "@/lib/types"

interface PlaylistSidebarProps {
    videos: VideoMetadata[]
    currentVideoId?: string
    onSelectVideo: (video: VideoMetadata) => void
}

export function PlaylistSidebar({
    videos,
    currentVideoId,
    onSelectVideo,
}: PlaylistSidebarProps) {
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${String(secs).padStart(2, "0")}`
    }

    return (
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
            <div className="p-4 border-b border-border bg-primary/5">
                <h3 className="font-bold font-display">Playlist Videos</h3>
                <p className="text-xs text-muted-foreground">{videos.length} videos</p>
            </div>

            <ScrollArea className="h-[600px]">
                <div className="p-2">
                    {videos.map((video, idx) => {
                        const isActive = video.videoId === currentVideoId
                        const isCompleted = false // TODO: Get from database

                        return (
                            <motion.button
                                key={video.videoId}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                onClick={() => onSelectVideo(video)}
                                className={`w-full p-3 mb-2 rounded-xl flex gap-3 text-left transition-all ${isActive
                                        ? "bg-primary/10 border border-primary/30"
                                        : "hover:bg-muted border border-transparent"
                                    }`}
                            >
                                {/* Thumbnail */}
                                <div className="relative shrink-0">
                                    <img
                                        src={video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/default.jpg`}
                                        alt={video.title}
                                        className="w-24 h-16 object-cover rounded-lg"
                                    />
                                    {isActive && (
                                        <div className="absolute inset-0 bg-primary/20 rounded-lg flex items-center justify-center">
                                            <Play className="h-6 w-6 text-primary fill-primary" />
                                        </div>
                                    )}
                                    {isCompleted && !isActive && (
                                        <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                                            <Check className="h-3 w-3 text-white" />
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <span className="text-xs font-bold text-muted-foreground">
                                            {idx + 1}
                                        </span>
                                        {video.duration && (
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Clock className="h-3 w-3" />
                                                <span>{formatDuration(video.duration)}</span>
                                            </div>
                                        )}
                                    </div>
                                    <h4
                                        className={`text-sm font-semibold line-clamp-2 mb-1 ${isActive ? "text-primary" : ""
                                            }`}
                                    >
                                        {video.title}
                                    </h4>
                                    <p className="text-xs text-muted-foreground line-clamp-1">
                                        {video.channelName}
                                    </p>
                                </div>
                            </motion.button>
                        )
                    })}
                </div>
            </ScrollArea>
        </div>
    )
}
