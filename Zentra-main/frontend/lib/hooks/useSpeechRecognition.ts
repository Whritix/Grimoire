/**
 * Web Speech API Hook for Speech Recognition
 * Browser-based speech-to-text
 */

import { useState, useEffect, useCallback, useRef } from 'react'

interface UseSpeechRecognitionOptions {
    continuous?: boolean
    interimResults?: boolean
    lang?: string
}

interface UseSpeechRecognition {
    transcript: string
    interimTranscript: string
    isListening: boolean
    start: () => void
    stop: () => void
    reset: () => void
    isSupported: boolean
}

export function useSpeechRecognition(
    options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognition {
    const {
        continuous = true,
        interimResults = true,
        lang = 'en-US',
    } = options

    const [transcript, setTranscript] = useState('')
    const [interimTranscript, setInterimTranscript] = useState('')
    const [isListening, setIsListening] = useState(false)
    const recognitionRef = useRef<any>(null)

    // Check browser support
    const isSupported =
        typeof window !== 'undefined' &&
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

    useEffect(() => {
        if (!isSupported) return

        const SpeechRecognition =
            (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition

        const recognition = new SpeechRecognition()
        recognition.continuous = continuous
        recognition.interimResults = interimResults
        recognition.lang = lang

        recognition.onresult = (event: any) => {
            let finalTranscript = ''
            let interimTranscript = ''

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcriptPiece = event.results[i][0].transcript
                if (event.results[i].isFinal) {
                    finalTranscript += transcriptPiece + ' '
                } else {
                    interimTranscript += transcriptPiece
                }
            }

            if (finalTranscript) {
                setTranscript((prev) => prev + finalTranscript)
            }
            setInterimTranscript(interimTranscript)
        }

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error)
            setIsListening(false)
        }

        recognition.onend = () => {
            setIsListening(false)
        }

        recognitionRef.current = recognition

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop()
            }
        }
    }, [continuous, interimResults, lang, isSupported])

    const start = useCallback(() => {
        if (recognitionRef.current && !isListening) {
            recognitionRef.current.start()
            setIsListening(true)
        }
    }, [isListening])

    const stop = useCallback(() => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop()
            setIsListening(false)
        }
    }, [isListening])

    const reset = useCallback(() => {
        setTranscript('')
        setInterimTranscript('')
    }, [])

    return {
        transcript,
        interimTranscript,
        isListening,
        start,
        stop,
        reset,
        isSupported,
    }
}
