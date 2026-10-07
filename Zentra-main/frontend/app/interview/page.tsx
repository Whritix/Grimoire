"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useActivity } from "@/hooks/useActivity"
import { motion, AnimatePresence } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  Video,
  Mic,
  MicOff,
  VideoOff,
  Volume2,
  Loader2,
  Send,
  Code,
  X
} from "lucide-react"
import { toast } from "sonner"

// Types matching the backend
interface InterviewSession {
  id: string;
  status: string;
  job_role: string;
  skills: string[];
  level: string;
  candidate_language: string;
}

type InterviewStage = "setup" | "active" | "completed" | "scoring"

export default function InterviewPage() {
  const { trackInterviewStart, trackInterviewScore } = useActivity()
  const [stage, setStage] = useState<InterviewStage>("setup")
  const [jobTitle, setJobTitle] = useState("")
  const [skills, setSkills] = useState("")
  const [experienceLevel, setExperienceLevel] = useState("mid")
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  
  // Company Mode State
  const [companies, setCompanies] = useState<any[]>([])
  const [selectedCompany, setSelectedCompany] = useState<string>("")
  const [companyRoles, setCompanyRoles] = useState<any[]>([])

  useEffect(() => {
    // Fetch companies on mount
    fetch('/api/v1/interview/companies')
      .then(res => res.json())
      .then(data => {
        if (data.companies) setCompanies(data.companies)
      })
      .catch(err => console.error("Failed to fetch companies:", err))
  }, [])

  useEffect(() => {
    // Handle company selection change
    if (selectedCompany) {
      const company = companies.find(c => c.id === selectedCompany)
      if (company) {
        setCompanyRoles(company.roles)
        setJobTitle("") // Reset job title when switching company
        setSkills("") // Reset skills
      }
    } else {
      setCompanyRoles([])
    }
  }, [selectedCompany, companies])

  const handleRoleSelect = (roleId: string) => {
    if (!selectedCompany) return
    const role = companyRoles.find(r => r.id === roleId)
    if (role) {
        setJobTitle(role.title)
        setSkills(role.skills.join(", "))
        // Optional: Pre-select level if mapped, but user might want to override?
        // PM Requirement says: "Validate role + experience". 
        // We auto-fill skills. Level selection remains manual but we could filter it?
        // For now, let's just auto-fill skills and title.
    }
  }

  // Session State
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [messages, setMessages] = useState<Array<{ role: string, content: string }>>([])
  const [currentQuestion, setCurrentQuestion] = useState<string>("")
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState(0)
  const [userResponse, setUserResponse] = useState("")
  const [scores, setScores] = useState<any>(null)

  // Media & Interaction State
  const [isMicOn, setIsMicOn] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isAISpeaking, setIsAISpeaking] = useState(false)
  const [permissionError, setPermissionError] = useState("")
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
  const [showAIModal, setShowAIModal] = useState(false)
  const [lastAnalysis, setLastAnalysis] = useState<any>(null)


  // Code Editor State
  const [showCodeEditor, setShowCodeEditor] = useState(false)
  const [codeContent, setCodeContent] = useState("// Write your code here...\n")
  const [selectedLanguage, setSelectedLanguage] = useState("javascript")

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const isTranscribingRef = useRef(false)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null)
  // Ref for synchronous processing guard (avoids stale closure bug with isProcessing state)
  const isProcessingRef = useRef(false)
  // Ref-based recording guard — avoids stale closure when startListening is called from async TTS callbacks
  const isRecordingRef = useRef(false)
  // Ref tracking user intent for mic (stays true until user taps to stop)
  const isRecordingDesiredRef = useRef(false)
  // Fallback timer in case speechSynthesis.onend never fires (known Chrome bug)
  const ttsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // We need a ref to access the latest userResponse inside the callback without dependencies
  const userResponseRef = useRef("")

  // Update refs when state changes
  useEffect(() => {
    userResponseRef.current = userResponse;
  }, [userResponse]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Initialize Speech Synthesis and pre-load voices
  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis
      // Pre-load voices so speakText doesn't incur first-call latency
      const loadVoices = () => { synthRef.current?.getVoices() }
      loadVoices()
      window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    }

    // Cleanup on unmount
    return () => {
      if (synthRef.current) synthRef.current.cancel();
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
      if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (ttsTimeoutRef.current) clearTimeout(ttsTimeoutRef.current);
      window.speechSynthesis.removeEventListener('voiceschanged', () => {})
    }
  }, [mediaStream])

  // Primary Submission Function
  const submitAnswer = useCallback(async (forcedText?: string) => {
    const answerText = (typeof forcedText === 'string' && forcedText.trim())
      ? forcedText.trim()
      : userResponseRef.current.trim();

    if (!sessionId || !answerText || isProcessingRef.current) return;

    // Synchronous guard against duplicate submissions
    isProcessingRef.current = true;
    setIsProcessing(true);

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    setUserResponse("");
    userResponseRef.current = "";

    // Reset recording states
    isRecordingDesiredRef.current = false;
    setIsRecording(false);
    isRecordingRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
      mediaRecorderRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
      recognitionRef.current = null;
    }

    // Optimistic update in chat transcript
    setMessages(prev => [...prev, { role: 'user', content: answerText }]);

    try {
      const res = await fetch(`/api/v1/interview/${sessionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: answerText,
          confidence: 1.0
        })
      });

      const data = await res.json().catch(() => ({}));

      if (data.completed) {
        setStage("completed");
        fetchScore(sessionId);
      } else {
        const nextQ = data.question || "Thank you. Let's move to the next question. Can you tell me about your approach to testing and code quality?";
        setCurrentQuestion(nextQ);
        setCurrentQuestionNumber(data.question_number || (currentQuestionNumber + 1));
        setMessages(prev => [...prev, { role: 'assistant', content: nextQ }]);
        speakText(nextQ);
      }

    } catch (error) {
      console.error("Error submitting answer:", error);
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  }, [sessionId, currentQuestionNumber]);

  // Ref for latest submitAnswer callback
  const submitAnswerRef = useRef(submitAnswer);
  useEffect(() => {
    submitAnswerRef.current = submitAnswer;
  }, [submitAnswer]);

  // Text-To-Speech for AI interviewer
  const speakText = (text?: string) => {
    if (!text || typeof text !== 'string' || !text.trim()) {
      return;
    }
    if (!synthRef.current) {
      return;
    }
    synthRef.current.cancel();

    // Pause mic while AI speaks to prevent audio loopback
    if (isRecordingRef.current) {
      stopListening(false);
    }

    const utterance = new SpeechSynthesisUtterance(text);

    const estimatedMs = Math.max((text?.length || 0) * 70, 2000) + 2500;
    if (ttsTimeoutRef.current) clearTimeout(ttsTimeoutRef.current);
    ttsTimeoutRef.current = setTimeout(() => {
      setIsAISpeaking(false);
    }, estimatedMs);

    utterance.onstart = () => setIsAISpeaking(true);
    utterance.onend = () => {
      if (ttsTimeoutRef.current) clearTimeout(ttsTimeoutRef.current);
      setIsAISpeaking(false);
    };
    utterance.onerror = (e: any) => {
      if (ttsTimeoutRef.current) clearTimeout(ttsTimeoutRef.current);
      // 'interrupted' and 'canceled' are standard normal events when speech is stopped or replaced
      if (e?.error === 'interrupted' || e?.error === 'canceled') {
        setIsAISpeaking(false);
        return;
      }
      console.warn("TTS notice:", e?.error);
      setIsAISpeaking(false);
    };

    const voices = synthRef.current.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google US English')) || voices[0];
    if (preferredVoice) utterance.voice = preferredVoice;

    synthRef.current.speak(utterance);
  };

  // Start persistent hardware microphone recording
  const startListening = async () => {
    if (isProcessingRef.current || isTranscribingRef.current) return;

    // 1. Immediately turn on recording state
    isRecordingDesiredRef.current = true;
    setIsRecording(true);
    isRecordingRef.current = true;
    audioChunksRef.current = [];

    // 2. Start hardware MediaRecorder (NEVER cuts off, NO silence timeout!)
    try {
      let stream = mediaStream;
      if (!stream || stream.getAudioTracks().length === 0 || !stream.getAudioTracks()[0].enabled) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!mediaStream) {
          setMediaStream(stream);
        }
      }

      const audioTracks = stream.getAudioTracks();
      const audioOnlyStream = new MediaStream(audioTracks);

      let mimeType = '';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
      }

      const recorder = mimeType ? new MediaRecorder(audioOnlyStream, { mimeType }) : new MediaRecorder(audioOnlyStream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(250);
      toast.success("Mic ON: Speak at your own pace. Tap mic again when finished.", { id: "mic-status" });
    } catch (micErr: any) {
      console.error("Microphone hardware access error:", micErr);
      isRecordingDesiredRef.current = false;
      setIsRecording(false);
      isRecordingRef.current = false;
      toast.error("Could not access microphone: " + (micErr?.message || "Please allow microphone permissions."));
      return;
    }

    // 3. Optional live typing preview via Web Speech (does NOT affect MediaRecorder if it ends)
    try {
      if (typeof window !== 'undefined') {
        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRec) {
          if (recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch (e) {}
          }
          const recognition = new SpeechRec();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event: any) => {
            const transcript = Array.from(event.results)
              .map((r: any) => r[0].transcript)
              .join('');
            if (transcript.trim()) {
              setUserResponse(transcript);
              userResponseRef.current = transcript;
            }
          };

          recognition.onend = () => {
            // Keep Web Speech active for preview while user is recording
            if (isRecordingRef.current && isRecordingDesiredRef.current) {
              try { recognition.start(); } catch (e) {}
            }
          };

          recognition.onerror = (e: any) => {
            console.warn("Live speech preview notice:", e?.error);
          };

          recognitionRef.current = recognition;
          try {
            recognition.start();
          } catch (e) {}
        }
      }
    } catch (err) {
      console.warn("Speech recognition preview unavailable, recording audio directly:", err);
    }
  };

  // Stop recording and optionally transcribe + submit
  const stopListening = async (shouldSubmit: boolean = false) => {
    isRecordingDesiredRef.current = false;
    setIsRecording(false);
    isRecordingRef.current = false;

    // Stop Web Speech recognition preview
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      const finishPromise = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          const type = recorder.mimeType || 'audio/webm';
          resolve(new Blob(audioChunksRef.current, { type }));
        };
        try {
          recorder.stop();
        } catch (e) {
          const type = recorder.mimeType || 'audio/webm';
          resolve(new Blob(audioChunksRef.current, { type }));
        }
      });

      mediaRecorderRef.current = null;

      if (shouldSubmit) {
        setIsTranscribing(true);
        isTranscribingRef.current = true;
        try {
          const audioBlob = await finishPromise;
          let finalTranscription = userResponseRef.current.trim();

          if (audioBlob.size > 500) {
            const formData = new FormData();
            formData.append("file", audioBlob, "recording.webm");

            const res = await fetch("/api/v1/interview/transcribe", {
              method: "POST",
              body: formData,
            });

            if (res.ok) {
              const data = await res.json();
              if (data.text && data.text.trim()) {
                finalTranscription = data.text.trim();
                setUserResponse(finalTranscription);
                userResponseRef.current = finalTranscription;
              }
            }
          }

          setIsTranscribing(false);
          isTranscribingRef.current = false;

          if (finalTranscription && !isProcessingRef.current) {
            submitAnswerRef.current(finalTranscription);
          } else {
            toast.error("No speech detected. Please speak or type your answer.", { id: "mic-status" });
          }
        } catch (err: any) {
          console.error("Transcription error:", err);
          setIsTranscribing(false);
          isTranscribingRef.current = false;
          if (userResponseRef.current.trim() && !isProcessingRef.current) {
            submitAnswerRef.current(userResponseRef.current.trim());
          } else {
            toast.error("Could not transcribe speech. Please type your answer.", { id: "mic-status" });
          }
        }
      }
    } else {
      if (shouldSubmit && userResponseRef.current.trim() && !isProcessingRef.current) {
        submitAnswerRef.current(userResponseRef.current.trim());
      }
    }
  };

  // 1-tap mic toggle: 1st tap turns ON, 2nd tap turns OFF & submits
  const toggleListening = () => {
    if (isTranscribing || isProcessing) return;
    if (isRecording || isRecordingRef.current || isRecordingDesiredRef.current) {
      stopListening(true);
    } else {
      startListening();
    }
  };

  // Camera handling with audio-only fallback
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setMediaStream(stream);
      setIsVideoOn(true);
      setIsMicOn(true);
      return true;
    } catch (err) {
      console.warn("Could not access video+audio simultaneously, trying audio only:", err);
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMediaStream(audioStream);
        setIsVideoOn(false);
        setIsMicOn(true);
        toast.info("Webcam unavailable. Continuing in voice-only mode.");
        return true;
      } catch (audioErr) {
        console.warn("Microphone permission not granted:", audioErr);
        setIsVideoOn(false);
        setIsMicOn(false);
        setPermissionError("Microphone access not granted.");
        toast.warning("Microphone access blocked. You can still type your answers in the chat!");
        return false;
      }
    }
  };

  // Attach stream to video element when available
  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream, stage]); // Re-run when stream changes or stage changes (mounting video)

  // Restart camera when video is re-enabled
  useEffect(() => {
    if (isVideoOn && !mediaStream && stage === 'active') {
      startCamera().catch(err => console.error("Failed to restart camera:", err));
    }
  }, [isVideoOn, mediaStream, stage]);

  const startInterview = async () => {
    if (!jobTitle) return alert("Please enter a job title");

    setIsProcessing(true);
    trackInterviewStart(jobTitle, experienceLevel);
    try {
      const createRes = await fetch('/api/v1/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_role: jobTitle,
          skills: skills.split(',').map(s => s.trim()),
          level: experienceLevel,
          company_id: selectedCompany || undefined
        })
      });

      if (!createRes.ok) throw new Error("Failed to create session");
      const session = await createRes.json();
      setSessionId(session.id);

      // Upload Resume if selected
      if (resumeFile) {
          const formData = new FormData();
          formData.append('file', resumeFile);
          try {
              await fetch(`/api/v1/interview/${session.id}/resume`, {
                  method: 'POST',
                  body: formData
              });
          } catch (uploadErr) {
              console.error("Resume upload failed", uploadErr);
              // Non-blocking? Or maybe alert user? 
              // Proceeding without resume context if upload fails is safer for UX flow, 
              // but maybe show a toast. For now, just log.
          }
      }

      await fetch(`/api/v1/interview/${session.id}/consent`, { method: 'POST' });
      const startRes = await fetch(`/api/v1/interview/${session.id}/start`, { method: 'POST' });
      const startData = await startRes.json();

      // Set stage FIRST
      setStage("active");
      setCurrentQuestion(startData.question);
      setCurrentQuestionNumber(startData.question_number);
      setMessages([{ role: 'assistant', content: startData.question }]);

      // Start camera matches state but stream attach handles safely via useEffect
      // Start camera non-blocking relative to UI
      startCamera().catch(err => console.error("Camera failed silently", err));

      speakText(startData.question);
      setShowAIModal(true);

    } catch (error) {
      console.error("Error starting interview:", error);
      alert("Failed to start interview.");
    } finally {
      setIsProcessing(false);
    }
  };

  // periodic frame capture
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (stage === "active" && isVideoOn && isRecording && videoRef.current && sessionId) {
       intervalId = setInterval(async () => {
          if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

          // Capture frame
          const canvas = document.createElement("canvas");
          canvas.width = 640; // Resize for bandwidth
          canvas.height = 480;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          
          // Convert to blob
          canvas.toBlob(async (blob) => {
             if (!blob) return;
             const formData = new FormData();
             formData.append("file", blob, "frame.jpg");
             
             try {
                // Fire and forget - or store last result to show feedback?
                // We show last result in debug or subtle UI 
                const res = await fetch(`/api/v1/interview/${sessionId}/analysis`, {
                   method: 'POST',
                   body: formData
                });
                if (res.ok) {
                   const data = await res.json();
                   setLastAnalysis(data);
                }
             } catch (err) {
                console.error("Frame analysis error", err);
             }
          }, "image/jpeg", 0.7);

       }, 2000); // Every 2 seconds for snappier feedback
    }

    return () => clearInterval(intervalId);
  }, [stage, isVideoOn, isRecording, sessionId]);

  const fetchScore = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/interview/${id}/score`);
      const data = await res.json();
      setScores(data);
      setStage("scoring");
      if (data.overall) {
        trackInterviewScore(data.overall, jobTitle);
      }
    } catch (error) {
      console.error("Error fetching score:", error);
    }
  };

  const endInterview = async () => {
    if (sessionId) {
      await fetch(`/api/v1/interview/${sessionId}/end`, { method: 'POST' });
      setStage("completed");
      fetchScore(sessionId);
    } else {
      setStage("setup");
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }
    setIsVideoOn(false);
    setIsMicOn(false);
    if (synthRef.current) synthRef.current.cancel();
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden relative selection:bg-primary/30">
      {/* Ambient Background */}
      <div className="fixed inset-0 -z-10 bg-linear-to-b from-primary/10 via-background to-background pointer-events-none" />
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-200 h-200 bg-indigo-500/5 rounded-full blur-[100px] animate-pulse-slow" />
        <div className="absolute bottom-[-20%] right-[-10%] w-200 h-200 bg-purple-500/5 rounded-full blur-[100px] animate-pulse-slow animation-delay-4000" />
      </div>

      <main className="flex-1 w-full max-w-none px-4 py-4 md:py-6 overflow-hidden relative z-10">
        <AnimatePresence mode="wait">
          {/* Setup Stage */}
          {stage === "setup" && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              className="w-full max-w-4xl mx-auto h-full flex flex-col justify-center"
            >
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg"
                >
                  <Mic className="h-8 w-8 text-primary" />
                </motion.div>
                <h1 className="text-4xl md:text-5xl font-bold font-display mb-3 tracking-tight">
                  <span className="text-primary">
                    AI Voice Interviewer
                  </span>
                </h1>
                <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
                  Experience a realistic technical interview with our advanced voice AI.
                </p>
              </div>

              <Card className="p-6 md:p-8 space-y-6 bg-card/60 backdrop-blur-xl border-white/5 shadow-2xl rounded-3xl relative overflow-hidden">
                <div className="absolute inset-0 bg-white/5 pointer-events-none" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                  <div>
                    <label className="text-sm font-medium mb-2 block text-foreground/80">Company (Optional)</label>
                    <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                      <SelectTrigger className="h-12 bg-background/50 border-input/50 focus:bg-background transition-all rounded-xl">
                        <SelectValue placeholder="Select a company..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Generic (No specific company)</SelectItem>
                         {companies.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                         ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block text-foreground/80">Target Role</label>
                    {selectedCompany && companyRoles.length > 0 ? (
                        <Select 
                            value={companyRoles.find(r => r.title === jobTitle)?.id || ""} 
                            onValueChange={handleRoleSelect}
                        >
                            <SelectTrigger className="h-12 bg-background/50 border-input/50 focus:bg-background transition-all rounded-xl">
                                <SelectValue placeholder="Select a role..." />
                            </SelectTrigger>
                            <SelectContent>
                                {companyRoles.map(r => (
                                    <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <Input
                          placeholder="e.g., Senior Frontend Engineer"
                          value={jobTitle}
                          onChange={(e) => setJobTitle(e.target.value)}
                          className="h-12 bg-background/50 border-input/50 focus:bg-background transition-all rounded-xl"
                        />
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-sm font-medium mb-2 block text-foreground/80">Key Skills</label>
                    <Input
                      placeholder="React, Node.js, System Design"
                      value={skills}
                      onChange={(e) => setSkills(e.target.value)}
                      className="h-12 bg-background/50 border-input/50 focus:bg-background transition-all rounded-xl"
                      readOnly={!!selectedCompany} // Lock skills if company selected
                      disabled={!!selectedCompany}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block text-foreground/80">Experience Level</label>
                    <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                      <SelectTrigger className="h-12 bg-background/50 border-input/50 focus:bg-background transition-all rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="junior">Junior (1-3 years)</SelectItem>
                        <SelectItem value="mid">Mid-Level (3-5 years)</SelectItem>
                        <SelectItem value="senior">Senior/Lead (5+ years)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block text-foreground/80">Resume (Optional)</label>
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <Input
                                type="file"
                                accept=".txt,.md,.png,.jpg,.jpeg"
                                onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                                className="h-12 pt-2.5 bg-background/50 border-input/50 file:text-primary file:font-semibold file:bg-primary/10 file:border-0 file:mr-4 file:py-1 file:px-3 file:rounded-lg hover:file:bg-primary/20 transition-all rounded-xl cursor-pointer"
                            />
                        </div>
                         {resumeFile && (
                            <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => {
                                    setResumeFile(null);
                                }}
                                className="h-12 w-12 rounded-xl border border-input/50 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 pl-1">
                        Supported formats: PNG, JPG, JPEG, TXT, MD (Max 5MB)
                    </p>
                  </div>
                </div>

                <Button
                  className="w-full h-14 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                  onClick={startInterview}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Starting Session...
                    </>
                  ) : (
                    <>
                      <Mic className="mr-2 h-5 w-5" /> Start Voice Session
                    </>
                  )}
                </Button>
              </Card>
            </motion.div>
          )}

          {/* Active Interview Stage */}
          {stage === "active" && (
            <motion.div
              key="active"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden"
            >
              {/* Left Side - Immersive Interface */}
              <div className="lg:col-span-2 flex flex-col overflow-hidden relative">
                <Card className="flex-1 relative bg-black border-white/10 overflow-hidden rounded-3xl shadow-2xl flex flex-col group">

                  {/* Video / Avatar Container */}
                  <div className="flex-1 relative flex items-center justify-center overflow-hidden">

                    {/* User Video Feed (Background) - No overlay for clean video */}
                    <div className="absolute inset-0 z-0">
                      {isVideoOn ? (
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-radial-[circle_at_center,_var(--tw-gradient-stops)] from-gray-800 via-gray-900 to-black" />
                      )}
                    </div>



                    {/* Compact AI Avatar - Bottom Left Corner */}
                    <div className="absolute bottom-28 left-6 z-10 flex flex-col items-center">

                      {/* Small Orbital Rings */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                          className="w-[100px] h-[100px] rounded-full border border-white/10 border-dashed"
                        />
                      </div>

                      {/* Compact AI Orb */}
                      <motion.div
                        animate={isAISpeaking ? {
                          scale: [1, 1.05, 0.95, 1.05, 1],
                          boxShadow: [
                            "0 0 20px rgba(249, 115, 22, 0.3)",
                            "0 0 40px rgba(249, 115, 22, 0.5)",
                            "0 0 20px rgba(249, 115, 22, 0.3)"
                          ]
                        } : {
                          scale: 1,
                          boxShadow: "0 0 20px rgba(249, 115, 22, 0.15)"
                        }}
                        transition={{ ease: "easeInOut", duration: 2, repeat: Infinity }}
                        className="w-16 h-16 rounded-full bg-black/70 backdrop-blur-xl border border-white/30 flex items-center justify-center relative shadow-xl z-20"
                      >
                        {/* Inner Gradient */}
                        <div className="absolute inset-1 rounded-full bg-primary/30 blur-lg opacity-80" />

                        {isAISpeaking ? (
                          /* Speaking Visualizer - Smaller */
                          <div className="flex items-center gap-0.5 h-8 z-30">
                            {[1, 2, 3].map((i) => (
                              <motion.div
                                key={i}
                                animate={{ height: [6, 20, 8, 24, 6], opacity: [0.5, 1, 0.5] }}
                                transition={{
                                  duration: 0.6,
                                  repeat: Infinity,
                                  repeatType: "reverse",
                                  delay: i * 0.1,
                                  ease: "easeInOut"
                                }}
                                className="w-1.5 bg-primary rounded-full"
                              />
                            ))}
                          </div>
                        ) : isRecording ? (
                          /* Listening State */
                          <div className="relative z-30">
                            <Mic className="h-6 w-6 text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                          </div>
                        ) : (
                          /* Idle State */
                          <div className="h-2 w-2 rounded-full bg-primary/80 shadow-[0_0_10px_rgba(249,115,22,0.8)] animate-pulse z-30" />
                        )}
                      </motion.div>

                      {/* Status Pill - Smaller */}
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`mt-3 px-3 py-1 rounded-full backdrop-blur-md text-[10px] font-bold tracking-wider uppercase border transition-all duration-300
                          ${isAISpeaking
                            ? 'bg-primary/20 border-primary/30 text-primary'
                            : isTranscribing
                              ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                              : isRecording
                                ? 'bg-red-500/20 border-red-500/30 text-red-300'
                                : 'bg-white/10 border-white/20 text-white/70'}`}
                      >
                        {isAISpeaking
                          ? "AI Speaking"
                          : isTranscribing
                            ? "Transcribing voice..."
                            : isRecording
                              ? "Listening • Tap mic to send"
                              : "Ready • Tap mic to speak"}
                      </motion.div>
                    </div>

                  </div>

                  {/* Integrated Controls Bar */}
                  <div className="h-20 flex items-center justify-between px-6 bg-black/60 backdrop-blur-xl border-t border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-xs font-semibold text-primary uppercase tracking-wider">Live</span>
                      </div>

                      {/* Code Editor Toggle */}
                      <Button
                        size="sm"
                        variant="outline"
                        className={`h-9 px-4 rounded-lg flex items-center gap-2 ${showCodeEditor ? 'bg-primary text-white border-primary' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}
                        onClick={() => setShowCodeEditor(!showCodeEditor)}
                      >
                        <Code className="h-4 w-4" />
                        <span className="text-xs font-semibold">Code</span>
                      </Button>
                    </div>

                    <div className="flex items-center gap-4">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-11 w-11 rounded-full hover:bg-white/20 border border-white/20 text-white"
                        onClick={() => setIsVideoOn(!isVideoOn)}
                      >
                        {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5 text-white/50" />}
                      </Button>

                      <Button
                        size="lg"
                        variant={isRecording ? "destructive" : "default"}
                        onClick={toggleListening}
                        disabled={isTranscribing || isProcessing}
                        className={`h-14 w-14 rounded-full shadow-lg transition-all duration-300 ${
                          isTranscribing
                            ? 'bg-amber-500 text-black shadow-amber-500/30 animate-pulse'
                            : isRecording
                              ? 'shadow-red-500/30 scale-105 bg-red-500 hover:bg-red-600'
                              : 'bg-white text-black hover:scale-105'
                        }`}
                        title={isRecording ? "Click to finish and submit answer" : "Click to speak"}
                      >
                        {isTranscribing ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : isRecording ? (
                          <MicOff className="h-5 w-5" />
                        ) : (
                          <Mic className="h-5 w-5" />
                        )}
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-11 w-11 rounded-full hover:bg-white/20 border border-white/20 text-white"
                        onClick={submitAnswer}
                        disabled={!userResponse.trim() || isProcessing}
                      >
                        <Send className="h-5 w-5" />
                      </Button>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg border border-white/10"
                      onClick={endInterview}
                    >
                      End Session
                    </Button>
                  </div>
                </Card>

                {/* Code Editor Panel */}
                <AnimatePresence>
                  {showCodeEditor && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <Card className="mt-4 bg-[#1e1e1e] border-white/10 rounded-2xl overflow-hidden shadow-xl">
                        <div className="flex items-center justify-between px-4 py-3 bg-black/40 border-b border-white/10">
                          <div className="flex items-center gap-3">
                            <Code className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium text-foreground/90">Code Editor</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                              <SelectTrigger className="h-8 w-32 text-xs bg-white/5 border-white/10">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="javascript">JavaScript</SelectItem>
                                <SelectItem value="python">Python</SelectItem>
                                <SelectItem value="java">Java</SelectItem>
                                <SelectItem value="cpp">C++</SelectItem>
                                <SelectItem value="typescript">TypeScript</SelectItem>
                                <SelectItem value="sql">SQL</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-lg hover:bg-white/10"
                              onClick={() => setShowCodeEditor(false)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <textarea
                          value={codeContent}
                          onChange={(e) => setCodeContent(e.target.value)}
                          className="w-full h-64 p-4 bg-transparent text-sm font-mono text-green-400 resize-none focus:outline-none placeholder:text-white/30"
                          placeholder="// Start typing your code here..."
                          spellCheck={false}
                        />
                        <div className="flex items-center justify-between px-4 py-3 bg-black/40 border-t border-white/10">
                          <span className="text-xs text-muted-foreground">
                            {codeContent.split('\n').length} lines • {selectedLanguage}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs hover:bg-white/10"
                              onClick={() => setCodeContent("// Write your code here...\n")}
                            >
                              Clear
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-primary hover:bg-primary/90"
                              onClick={async () => {
                                if (!sessionId || isProcessing) return;

                                // Format code message for review
                                const codeMessage = `[Code Submission - ${selectedLanguage}]\n\nPlease review my code:\n\n\`\`\`${selectedLanguage}\n${codeContent}\n\`\`\`\n\nPlease evaluate this code for correctness, efficiency, and best practices.`;

                                // Add to messages immediately
                                setMessages(prev => [...prev, { role: 'user', content: codeMessage }]);
                                setIsProcessing(true);

                                try {
                                  const res = await fetch(`/api/v1/interview/${sessionId}/answer`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      transcript: codeMessage,
                                      confidence: 1.0
                                    })
                                  });

                                  const data = await res.json().catch(() => ({}));

                                  if (data.completed) {
                                    setStage("completed");
                                    fetchScore(sessionId);
                                  } else {
                                    // AI will respond with code review
                                    const nextQ = data.question || "Thank you for sharing your code! It looks structured. How would you handle potential edge cases or scale this implementation?";
                                    setCurrentQuestion(nextQ);
                                    setCurrentQuestionNumber(data.question_number || (currentQuestionNumber + 1));
                                    setMessages(prev => [...prev, { role: 'assistant', content: nextQ }]);
                                    speakText(nextQ);
                                  }
                                } catch (error) {
                                  console.error("Error submitting code:", error);
                                } finally {
                                  setIsProcessing(false);
                                }
                              }}
                              disabled={codeContent.trim() === "// Write your code here..." || isProcessing}
                            >
                              <Send className="h-3 w-3 mr-1" />
                              Submit Code
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Right Side - Transcript History */}
              <div className="lg:col-span-1 h-full overflow-hidden">
                <Card className="h-full flex flex-col bg-card/40 backdrop-blur-xl border-white/5 rounded-3xl overflow-hidden shadow-xl">
                  <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between shrink-0">
                    <h3 className="font-semibold text-sm tracking-wide uppercase text-muted-foreground">Transcript</h3>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Q{currentQuestionNumber}</Badge>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <div className="space-y-4">
                      {messages.map((msg, idx) => (
                        <motion.div
                          initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          key={idx}
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[90%] rounded-2xl p-3.5 text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                            ? 'bg-primary text-white rounded-br-none'
                            : 'bg-muted/50 border border-white/5 text-foreground/90 rounded-bl-none'
                            }`}>
                            <p className="opacity-90">{msg.content}</p>
                          </div>
                        </motion.div>
                      ))}

                      {/* Real-time user speech display */}
                      {isRecording && userResponse && (
                        <motion.div
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex justify-end"
                        >
                          <div className="max-w-[90%] rounded-2xl p-3.5 text-sm leading-relaxed shadow-sm bg-primary/60 text-white rounded-br-none border border-primary/30">
                            <p className="opacity-90">{userResponse}</p>
                            <div className="flex items-center gap-1 mt-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
                              <span className="text-xs text-white/60">Speaking...</span>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  {/* Candidate Response Input Bar */}
                  <div className="p-3 border-t border-white/10 bg-black/40 shrink-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={userResponse}
                        onChange={(e) => setUserResponse(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            submitAnswer();
                          }
                        }}
                        placeholder={
                          isTranscribing
                            ? "Transcribing your voice with AI Whisper..."
                            : isRecording
                              ? "Listening to your voice... (tap mic when done or type here)"
                              : "Type your answer or click mic to speak..."
                        }
                        className="h-10 bg-white/5 border-white/15 text-sm text-white placeholder:text-white/40 focus:bg-white/10 rounded-xl"
                        disabled={isProcessing || isTranscribing}
                      />
                      <Button
                        size="icon"
                        className="h-10 w-10 shrink-0 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
                        onClick={() => submitAnswer()}
                        disabled={!userResponse.trim() || isProcessing || isTranscribing}
                      >
                        {isProcessing || isTranscribing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                      <span>
                        {isTranscribing
                          ? "⏳ AI Whisper is transcribing your voice..."
                          : isRecording
                            ? "🔴 Mic active — speak now (tap mic again to send)"
                            : "⚪ Mic idle — tap mic to speak, or type here"}
                      </span>
                      {userResponse.trim() && <span className="text-primary font-medium">Press Enter ↵</span>}
                    </div>
                  </div>

                  <div className="p-2.5 bg-muted/20 border-t border-white/5 shrink-0">
                    <p className="text-xs text-center text-muted-foreground">
                      History is saved automatically.
                    </p>
                  </div>
                </Card>
              </div>
            </motion.div>
          )}

          {/* Scoring Stage */}
          {(stage === "scoring" || stage === "completed") && (
            <motion.div
              key="scoring"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-none mx-auto px-4 py-8 overflow-y-auto"
              style={{ maxHeight: 'calc(100vh - 120px)' }}
            >
              <div className="text-center mb-12">
                <div className="inline-flex p-4 rounded-2xl bg-green-500/10 mb-6 ring-1 ring-green-500/20">
                  <Video className="h-10 w-10 text-green-500" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4 font-display">Performance Analysis</h2>
                <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">Comprehensive breakdown of your interview session.</p>
              </div>

              {scores ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  {/* Overall Score - Full Width Card */}
                  <Card className="p-6 md:p-8 border-primary/20 bg-linear-to-br from-primary/10 via-card to-card backdrop-blur-xl relative overflow-hidden rounded-2xl shadow-xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
                      <div className="flex-1">
                        <h3 className="text-xl md:text-2xl font-bold text-primary mb-3">Executive Summary</h3>
                        <p className="text-muted-foreground leading-relaxed text-sm md:text-base">{scores.rationale}</p>
                      </div>
                      <div className="flex flex-col items-center p-6 md:p-8 rounded-2xl bg-background/80 border border-primary/20 shadow-lg min-w-[160px]">
                        <span className="text-xs md:text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Overall Score</span>
                        {(() => {
                          const rawOverall = scores.overall ?? 0;
                          const overall10 = rawOverall > 5 ? Math.min(10, Math.max(1, Math.round(rawOverall))) : Math.min(10, Math.max(1, Math.round(rawOverall * 2)));
                          return (
                            <>
                              <div className="text-4xl md:text-5xl font-bold text-primary tracking-tighter">
                                {overall10}<span className="text-xl md:text-2xl text-muted-foreground font-light">/10</span>
                              </div>
                              <span className="text-xs text-muted-foreground mt-2 font-medium">
                                {overall10 >= 8 ? 'Strong' : overall10 >= 6 ? 'Proficient' : overall10 >= 4 ? 'Developing' : 'Needs Improvement'}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </Card>

                  {/* Detailed Scores Grid - 4 columns on large screens */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {scores?.scores && Object.entries(scores.scores).map(([category, rawScore]: [string, any], i) => {
                      const num = typeof rawScore === 'number' ? rawScore : parseFloat(rawScore) || 0;
                      const score10 = num > 5 ? Math.min(10, Math.max(1, Math.round(num))) : Math.min(10, Math.max(1, Math.round(num * 2)));
                      return (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
                          key={category}
                        >
                          <Card className="p-4 md:p-5 h-full hover:border-primary/30 transition-all hover:shadow-lg bg-card/80 backdrop-blur-sm rounded-xl border-border/50">
                            <div className="flex justify-between items-start mb-3">
                              <span className="capitalize font-semibold text-xs md:text-sm text-foreground/80 leading-tight">
                                {category.replace(/([A-Z])/g, ' $1').trim()}
                              </span>
                              <Badge variant={score10 >= 8 ? "default" : "secondary"} className="rounded-md text-xs shrink-0 ml-2">
                                {score10}/10
                              </Badge>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(score10 / 10) * 100}%` }}
                                transition={{ duration: 1, delay: 0.5 }}
                                className={`h-full rounded-full ${score10 >= 8 ? 'bg-green-500' : score10 >= 6 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              />
                            </div>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Interview Performance Breakdown */}
                  <Card className="p-5 md:p-6 border-border/50 bg-card/60 backdrop-blur-sm rounded-2xl">
                    <h3 className="font-bold text-base md:text-lg text-foreground mb-4 flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-primary/10"><Video className="h-4 w-4 text-primary" /></div>
                      Interview Performance Breakdown
                    </h3>
                    <div className="grid grid-cols-3 gap-3 md:gap-4">
                      <div className="p-3 md:p-4 rounded-xl bg-muted/50 border border-border/50 text-center">
                        <span className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider block">Questions</span>
                        <p className="text-xl md:text-2xl font-bold text-foreground mt-1">{currentQuestionNumber}</p>
                      </div>
                      <div className="p-3 md:p-4 rounded-xl bg-muted/50 border border-border/50 text-center">
                        <span className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider block">Code Submitted</span>
                        <p className="text-xl md:text-2xl font-bold text-foreground mt-1">{messages.filter(m => typeof m?.content === 'string' && m.content.includes('[Code Submission')).length}</p>
                      </div>
                      <div className="p-3 md:p-4 rounded-xl bg-muted/50 border border-border/50 text-center">
                        <span className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider block">Duration</span>
                        <p className="text-xl md:text-2xl font-bold text-foreground mt-1">~{Math.max(5, currentQuestionNumber * 3)}m</p>
                      </div>
                    </div>
                  </Card>

                  {/* Strengths & Weaknesses */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <Card className="p-5 md:p-6 border-green-500/20 bg-green-500/5 backdrop-blur-sm rounded-2xl">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-green-500/10"><div className="h-2 w-2 rounded-full bg-green-500" /></div>
                        <h3 className="font-bold text-base md:text-lg text-foreground">Key Strengths</h3>
                      </div>
                      <ul className="space-y-2.5">
                        {scores.strengths?.map((s: string, i: number) => (
                          <li key={i} className="flex gap-2.5 text-sm text-muted-foreground">
                            <span className="text-green-500 shrink-0">✓</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>

                    <Card className="p-5 md:p-6 border-amber-500/20 bg-amber-500/5 backdrop-blur-sm rounded-2xl">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-amber-500/10"><div className="h-2 w-2 rounded-full bg-amber-500" /></div>
                        <h3 className="font-bold text-base md:text-lg text-foreground">Areas for Growth</h3>
                      </div>
                      <ul className="space-y-2.5">
                        {scores.weaknesses?.map((w: string, i: number) => (
                          <li key={i} className="flex gap-2.5 text-sm text-muted-foreground">
                            <span className="text-amber-500 shrink-0">!</span>
                            <span>{w}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </div>

                  {/* Recommendations */}
                  <Card className="p-5 md:p-6 border-blue-500/20 bg-blue-500/5 backdrop-blur-sm rounded-2xl">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-lg bg-blue-500/10"><div className="h-2 w-2 rounded-full bg-blue-500" /></div>
                      <h3 className="font-bold text-base md:text-lg text-foreground">Recommendations for Improvement</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      <div className="p-3 md:p-4 rounded-xl bg-muted/30 border border-border/50">
                        <h4 className="font-semibold text-sm text-foreground mb-1.5">Technical Skills</h4>
                        <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">{scores.recommendations?.technicalSkills || "Continue practicing coding problems on platforms like LeetCode and HackerRank."}</p>
                      </div>
                      <div className="p-3 md:p-4 rounded-xl bg-muted/30 border border-border/50">
                        <h4 className="font-semibold text-sm text-foreground mb-1.5">Communication</h4>
                        <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">{scores.recommendations?.communication || "Practice explaining your thought process while coding."}</p>
                      </div>
                      <div className="p-3 md:p-4 rounded-xl bg-muted/30 border border-border/50">
                        <h4 className="font-semibold text-sm text-foreground mb-1.5">Problem Solving</h4>
                        <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">{scores.recommendations?.problemSolving || "Take time to understand the problem fully before coding."}</p>
                      </div>
                      <div className="p-3 md:p-4 rounded-xl bg-muted/30 border border-border/50">
                        <h4 className="font-semibold text-sm text-foreground mb-1.5">Next Steps</h4>
                        <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">{scores.recommendations?.nextSteps || "Review your responses and schedule another mock interview."}</p>
                      </div>
                    </div>
                  </Card>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4 pb-8">
                    <Button size="lg" onClick={() => window.location.reload()} className="rounded-xl h-11 px-8">Start New Session</Button>
                    <Button size="lg" variant="outline" onClick={() => window.location.href = '/dashboard'} className="rounded-xl h-11 px-8">Return to Dashboard</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px]">
                  <div className="relative w-24 h-24 mb-8">
                    <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" />
                    <div className="absolute inset-2 rounded-full border-r-2 border-accent animate-spin-slow" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Analyzing Performance</h3>
                  <p className="text-muted-foreground">Compiling feedback and scoring your responses...</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main >
    </div >
  )
}
