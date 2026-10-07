"use client"

import { useEffect, useRef } from "react"
import { motion } from "framer-motion"

interface VideoPlayerProps {
    videoId: string
    onTimeUpdate?: (time: number) => void
}

export function VideoPlayer({ videoId, onTimeUpdate }: VideoPlayerProps) {
    const playerRef = useRef<HTMLIFrameElement>(null)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        // Cleanup interval on unmount
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }
    }, [])

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full rounded-2xl overflow-hidden bg-black shadow-2xl"
            style={{ aspectRatio: "16/9" }}
        >
            <iframe
                ref={playerRef}
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
            />
        </motion.div>
    )
}
