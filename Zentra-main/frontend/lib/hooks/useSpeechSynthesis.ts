/**
 * Web Speech Synthesis Hook for Text-to-Speech
 * Browser-based AI voice
 */

import { useState, useCallback, useEffect } from 'react'

interface UseSpeechSynthesisOptions {
    voice?: SpeechSynthesisVoice | null
    rate?: number
    pitch?: number
    volume?: number
}

interface UseSpeechSynthesis {
    speak: (text: string) => void
    cancel: () => void
    pause: () => void
    resume: () => void
    isSpeaking: boolean
    isPaused: boolean
    voices: SpeechSynthesisVoice[]
    isSupported: boolean
}

export function useSpeechSynthesis(
    options: UseSpeechSynthesisOptions = {}
): UseSpeechSynthesis {
    const { voice = null, rate = 1, pitch = 1, volume = 1 } = options

    const [isSpeaking, setIsSpeaking] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

    const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

    useEffect(() => {
        if (!isSupported) return

        const loadVoices = () => {
            const availableVoices = window.speechSynthesis.getVoices()
            setVoices(availableVoices)
        }

        loadVoices()
        window.speechSynthesis.onvoiceschanged = loadVoices

        return () => {
            window.speechSynthesis.cancel()
        }
    }, [isSupported])

    const speak = useCallback(
        (text: string) => {
            if (!isSupported) return

            window.speechSynthesis.cancel()

            const utterance = new SpeechSynthesisUtterance(text)
            if (voice) {
                utterance.voice = voice
            }
            utterance.rate = rate
            utterance.pitch = pitch
            utterance.volume = volume

            utterance.onstart = () => setIsSpeaking(true)
            utterance.onend = () => {
                setIsSpeaking(false)
                setIsPaused(false)
            }
            utterance.onerror = () => setIsSpeaking(false)

            window.speechSynthesis.speak(utterance)
        },
        [voice, rate, pitch, volume, isSupported]
    )

    const cancel = useCallback(() => {
        if (isSupported) {
            window.speechSynthesis.cancel()
            setIsSpeaking(false)
            setIsPaused(false)
        }
    }, [isSupported])

    const pause = useCallback(() => {
        if (isSupported && isSpeaking) {
            window.speechSynthesis.pause()
            setIsPaused(true)
        }
    }, [isSupported, isSpeaking])

    const resume = useCallback(() => {
        if (isSupported && isPaused) {
            window.speechSynthesis.resume()
            setIsPaused(false)
        }
    }, [isSupported, isPaused])

    return {
        speak,
        cancel,
        pause,
        resume,
        isSpeaking,
        isPaused,
        voices,
        isSupported,
    }
}
