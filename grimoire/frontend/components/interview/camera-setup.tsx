"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Camera, Mic, Video, VideoOff, MicOff, CheckCircle2, AlertCircle } from "lucide-react"

interface CameraSetupProps {
    onReady: () => void
    onBack: () => void
}

export function CameraSetup({ onReady, onBack }: CameraSetupProps) {
    const [cameraEnabled, setCameraEnabled] = useState(false)
    const [micEnabled, setMicEnabled] = useState(false)
    const [stream, setStream] = useState<MediaStream | null>(null)
    const [error, setError] = useState("")
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        return () => {
            // Cleanup: stop all tracks when component unmounts
            if (stream) {
                stream.getTracks().forEach(track => track.stop())
            }
        }
    }, [stream])

    const requestPermissions = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            })

            setStream(mediaStream)
            setCameraEnabled(true)
            setMicEnabled(true)
            setError("")

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream
            }
        } catch (err: any) {
            setError("Unable to access camera/microphone. Please check your permissions.")
            console.error("Media access error:", err)
        }
    }

    const handleContinue = () => {
        if (cameraEnabled && micEnabled) {
            onReady()
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-3xl mx-auto"
        >
            <div className="p-8 rounded-2xl bg-card border border-border">
                <h2 className="text-2xl font-bold mb-6">Camera & Microphone Setup</h2>

                {/* Camera Preview */}
                <div className="relative aspect-video bg-black rounded-xl overflow-hidden mb-6">
                    {cameraEnabled ? (
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                            <VideoOff className="h-16 w-16 mb-4" />
                            <p>Camera not enabled</p>
                        </div>
                    )}
                </div>

                {/* Permission Status */}
                <div className="space-y-3 mb-6">
                    <div className={`flex items-center justify-between p-4 rounded-lg border ${cameraEnabled ? 'border-green-500 bg-green-500/10' : 'border-border bg-muted'}`}>
                        <div className="flex items-center gap-3">
                            <Camera className="h-5 w-5" />
                            <span className="font-medium">Camera</span>
                        </div>
                        {cameraEnabled ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                            <AlertCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                    </div>

                    <div className={`flex items-center justify-between p-4 rounded-lg border ${micEnabled ? 'border-green-500 bg-green-500/10' : 'border-border bg-muted'}`}>
                        <div className="flex items-center gap-3">
                            <Mic className="h-5 w-5" />
                            <span className="font-medium">Microphone</span>
                        </div>
                        {micEnabled ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                            <AlertCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                    </div>
                </div>

                {error && (
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 mb-6">
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                <div className="flex gap-3">
                    <Button variant="outline" onClick={onBack} className="flex-1">
                        Back
                    </Button>

                    {!cameraEnabled || !micEnabled ? (
                        <Button
                            onClick={requestPermissions}
                            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            <Video className="mr-2 h-4 w-4" />
                            Enable Camera & Mic
                        </Button>
                    ) : (
                        <Button
                            onClick={handleContinue}
                            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Start Interview
                        </Button>
                    )}
                </div>
            </div>
        </motion.div>
    )
}
