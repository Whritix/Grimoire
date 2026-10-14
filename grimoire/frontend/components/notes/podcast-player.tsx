
"use client"

import * as React from "react"
import { Play, Pause, SkipBack, SkipForward, ThumbsUp, ThumbsDown, Copy, Loader2, Sparkles, Headphones } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

interface PodcastPlayerProps {
  audioUrl?: string | null
  audioSegments?: string[]
  segmentData?: { speaker: string; text: string }[]
  streamingProgress?: { current: number; total: number } | null
  title?: string
  isLoading?: boolean
  onGenerate?: () => void
}

export function PodcastPlayer({ 
  audioUrl, 
  audioSegments = [], 
  segmentData = [],
  streamingProgress,
  title = "Audio Overview", 
  isLoading, 
  onGenerate 
}: PodcastPlayerProps) {
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [duration, setDuration] = React.useState(0)
  const [currentTime, setCurrentTime] = React.useState(0)
  const [currentSegmentIndex, setCurrentSegmentIndex] = React.useState(0)
  const audioRef = React.useRef<HTMLAudioElement>(null)

  // Use segments if available, otherwise fall back to single audioUrl
  const segments = audioSegments.length > 0 ? audioSegments : (audioUrl ? [audioUrl] : [])
  const currentSrc = segments[currentSegmentIndex] || ""
  const currentSegment = segmentData[currentSegmentIndex]
  const hasStreamingProgress = streamingProgress !== null && streamingProgress !== undefined
  const isStreaming = hasStreamingProgress && streamingProgress.current < streamingProgress.total

  React.useEffect(() => {
    if (audioRef.current && currentSrc) {
      audioRef.current.src = currentSrc
      audioRef.current.load()
      if (isPlaying) {
        audioRef.current.play().catch(e => console.error("Playback failed", e))
      }
    }
  }, [currentSrc])

  React.useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => console.error("Playback failed", e))
      } else {
        audioRef.current.pause()
      }
    }
  }, [isPlaying])

  const togglePlay = () => setIsPlaying(!isPlaying)

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handleEnded = () => {
    if (currentSegmentIndex < segments.length - 1) {
      setCurrentSegmentIndex(prev => prev + 1)
      setCurrentTime(0)
    } else {
      setIsPlaying(false)
      setCurrentSegmentIndex(0)
      setCurrentTime(0)
    }
  }

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0]
      setCurrentTime(value[0])
    }
  }

  const handlePrevious = () => {
    if (currentSegmentIndex > 0) {
      setCurrentSegmentIndex(prev => prev - 1)
      setCurrentTime(0)
    }
  }

  const handleNext = () => {
    if (currentSegmentIndex < segments.length - 1) {
      setCurrentSegmentIndex(prev => prev + 1)
      setCurrentTime(0)
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const copyTranscript = () => {
    if (currentSegment) {
      navigator.clipboard.writeText(currentSegment.text)
    }
  }

  // Initial State: No Audio Generated
  if (!audioUrl && segments.length === 0 && !isLoading) {
    return (
      <Card className="relative overflow-hidden border-border/50 bg-card">
        <div className="p-8 text-center space-y-6">
          <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-primary/10">
            <Headphones className="h-8 w-8 text-primary" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">Audio Overview</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Transform your notes into an engaging podcast-style discussion between two AI hosts.
            </p>
          </div>

          <Button 
            onClick={onGenerate} 
            size="lg" 
            className="gap-2 px-8 shadow-lg hover:shadow-primary/25 transition-all"
          >
            <Sparkles className="h-4 w-4" />
            Generate Audio
          </Button>
        </div>
      </Card>
    )
  }

  // Loading State
  if (isLoading && segments.length === 0) {
    return (
      <Card className="p-8 flex flex-col items-center justify-center gap-4 border-border/50 bg-card">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
          <Loader2 className="h-8 w-8 text-primary animate-spin relative z-10" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-medium animate-pulse">
            {hasStreamingProgress 
              ? `Generating segment ${streamingProgress.current} of ${streamingProgress.total}...`
              : "Writing script..."
            }
          </p>
          <p className="text-xs text-muted-foreground">Audio will start playing shortly</p>
        </div>
      </Card>
    )
  }

  // Player State - NotebookLM-inspired layout
  return (
    <Card className="border-border/50 bg-card min-h-[500px] flex flex-col">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />
      
      {/* Header - Clean title with icon */}
      <div className="px-6 pt-6 pb-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Headphones className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground">
              {segments.length} segment{segments.length !== 1 ? 's' : ''} • AI Generated
            </p>
          </div>
        </div>
      </div>

      {/* Transcript Area - Main content like NotebookLM */}
      <div className="px-6 py-5 flex-1 overflow-y-auto">
        {currentSegment ? (
          <div className="space-y-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary">
              {currentSegment.speaker}
            </span>
            <p className="text-sm leading-relaxed text-foreground/90">
              {currentSegment.text}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Press play to start listening...
          </p>
        )}
      </div>

      {/* Waveform Indicator */}
      <div className="px-6 h-8 flex items-center justify-center gap-0.5">
        {Array.from({ length: 50 }).map((_, i) => (
          <motion.div
            key={i}
            className="w-0.5 bg-primary/40 rounded-full"
            animate={{ 
              height: isPlaying ? [4, Math.random() * 16 + 4, 4] : 4,
              opacity: isPlaying ? 0.8 : 0.3
            }}
            transition={{ 
              duration: 0.4, 
              repeat: Infinity, 
              delay: i * 0.02,
              ease: "easeInOut" 
            }}
          />
        ))}
      </div>

      {/* Progress Bar */}
      <div className="px-6 py-4">
        <div className="flex items-center gap-3 text-xs">
          <span className="w-10 text-right font-mono text-muted-foreground">{formatTime(currentTime)}</span>
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="flex-1"
          />
          <span className="w-10 font-mono text-muted-foreground">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls - Clean centered layout */}
      <div className="px-6 pb-4">
        <div className="flex items-center justify-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handlePrevious}
            disabled={currentSegmentIndex === 0}
            className="h-10 w-10 rounded-full hover:bg-muted"
          >
            <SkipBack className="h-5 w-5" />
          </Button>
          
          <Button 
            onClick={togglePlay} 
            size="icon"
            className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleNext}
            disabled={currentSegmentIndex >= segments.length - 1}
            className="h-10 w-10 rounded-full hover:bg-muted"
          >
            <SkipForward className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Footer Actions - Like NotebookLM */}
      <div className="px-6 py-3 border-t border-border/50 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={copyTranscript} className="h-8 w-8 hover:bg-muted">
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
              <ThumbsUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
              <ThumbsDown className="h-4 w-4" />
            </Button>
          </div>
          
          {isStreaming && (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Streaming...
            </span>
          )}
          
          <span className="text-xs text-muted-foreground">
            Segment {currentSegmentIndex + 1} of {segments.length}
          </span>
        </div>
      </div>
    </Card>
  )
}
