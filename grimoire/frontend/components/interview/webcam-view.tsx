"use client"

import { useRef, useCallback } from "react"
import Webcam from "react-webcam"
import { motion } from "framer-motion"
import { Camera, CameraOff } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WebcamViewProps {
    isRecording: boolean
    onStart?: () => void
    onStop?: () => void
}

export function WebcamView({ isRecording, onStart, onStop }: WebcamViewProps) {
    const webcamRef = useRef<Webcam>(null)

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot()
        return imageSrc
    }, [])

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative rounded-2xl overflow-hidden border-2 border-border bg-black"
        >
            <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                className="w-full h-full object-cover"
                videoConstraints={{
                    width: 1280,
                    height: 720,
                    facingMode: "user",
                }}
            />

            {/* Recording indicator */}
            {isRecording && (
                <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 rounded-full bg-red-500/90 backdrop-blur-sm">
                    <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    <span className="text-white text-sm font-medium">Recording</span>
                </div>
            )}

            {/* Controls overlay */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {!isRecording ? (
                    <Button
                        onClick={onStart}
                        size="lg"
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                        <Camera className="mr-2 h-5 w-5" />
                        Start Recording
                    </Button>
                ) : (
                    <Button onClick={onStop} variant="destructive" size="lg">
                        <CameraOff className="mr-2 h-5 w-5" />
                        Stop Recording
                    </Button>
                )}
            </div>
        </motion.div>
    )
}
