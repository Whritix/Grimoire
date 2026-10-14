"use client"

import { motion } from "framer-motion"
import { Clock, Calendar, User as UserIcon, BookOpen, Tag } from "lucide-react"
import type { VideoMetadata } from "@/lib/types"
import { Badge } from "@/components/ui/badge"

interface VideoInfoProps {
    metadata: VideoMetadata
    currentTime: number
}

export function VideoInfo({ metadata, currentTime }: VideoInfoProps) {
    const formatDuration = (seconds: number) => {
        const totalSeconds = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        const secs = totalSeconds % 60
        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
        }
        return `${minutes}:${String(secs).padStart(2, "0")}`
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-2xl bg-card border border-border"
        >
            <h2 className="text-xl font-bold mb-4">{metadata.title}</h2>

            <div className="flex flex-wrap gap-4 mb-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4" />
                    <span>{metadata.channelName}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(metadata.uploadDate).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>{formatDuration(metadata.duration)}</span>
                </div>
            </div>

            {metadata.summary && (
                <div className="mb-6 p-4 bg-primary/5 rounded-xl border border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                        <BookOpen className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold text-primary">AI Summary</span>
                    </div>
                    <p className="text-sm leading-relaxed">
                        {metadata.summary}
                    </p>
                </div>
            )}

            {metadata.description && (
                <div className="mb-4">
                    <p className="text-sm text-muted-foreground line-clamp-3 hover:line-clamp-none transition-all cursor-pointer">
                        {metadata.description}
                    </p>
                </div>
            )}

            {metadata.keyTopics && metadata.keyTopics.length > 0 && (
                <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Tag className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">Key Topics</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {metadata.keyTopics.map((topic, idx) => (
                            <Badge key={idx} variant="secondary">
                                {topic}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}

            {metadata.chapters && metadata.chapters.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <BookOpen className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">Chapters</span>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {metadata.chapters.map((chapter, idx) => (
                            <button
                                key={idx}
                                className={`w-full text-left p-3 rounded-lg border transition-all ${currentTime >= chapter.timestamp &&
                                    (idx === metadata.chapters!.length - 1 ||
                                        currentTime < metadata.chapters![idx + 1].timestamp)
                                    ? "border-primary bg-primary/10"
                                    : "border-border hover:border-primary/50 hover:bg-muted"
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">{chapter.title}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {chapter.timestamp}
                                    </span>
                                </div>
                                {chapter.description && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                        {chapter.description}
                                    </p>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </motion.div>
    )
}
