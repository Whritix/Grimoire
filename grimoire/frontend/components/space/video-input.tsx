"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Youtube, Loader2, Link as LinkIcon } from "lucide-react"
import { motion } from "framer-motion"

interface VideoInputProps {
    onSubmit: (url: string) => void
    isLoading: boolean
}

export function VideoInput({ onSubmit, isLoading }: VideoInputProps) {
    const [url, setUrl] = useState("")
    const [error, setError] = useState("")

    const validateYouTubeUrl = (url: string): boolean => {
        const patterns = [
            /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/,
            /^(https?:\/\/)?(www\.)?youtube\.com\/playlist\?list=.+/,
        ]
        return patterns.some((pattern) => pattern.test(url))
    }

    const handleSubmit = () => {
        if (!url) {
            setError("Please enter a YouTube URL")
            return
        }
        if (!validateYouTubeUrl(url)) {
            setError("Please enter a valid YouTube video or playlist URL")
            return
        }
        setError("")
        onSubmit(url)
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full"
        >
            <div className="flex flex-col sm:flex-row gap-3  p-6 rounded-2xl bg-card border border-border">
                <div className="flex-1 relative">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Paste YouTube video or playlist URL here..."
                        value={url}
                        onChange={(e) => {
                            setUrl(e.target.value)
                            setError("")
                        }}
                        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                        className="pl-10 h-12"
                        disabled={isLoading}
                    />
                </div>
                <Button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    size="lg"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 whitespace-nowrap"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading...
                        </>
                    ) : (
                        <>
                            <Youtube className="mr-2 h-4 w-4" />
                            Load Video
                        </>
                    )}
                </Button>
            </div>
            {error && (
                <p className="text-sm text-red-500 mt-2 ml-2">{error}</p>
            )}
        </motion.div>
    )
}
