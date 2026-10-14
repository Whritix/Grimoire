"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { QuestionCard } from "@/components/assessment/question-card"
import { AssessmentProgress } from "@/components/assessment/assessment-progress"
import { useUser } from "@clerk/nextjs"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, BookOpen, Target, Trophy, ArrowRight, Sparkles, CheckCircle2, AlertCircle, Brain } from "lucide-react"
import { mockQuestions } from "@/lib/mocks/assessment"
import type { AssessmentAnswer, EvalResult, Question } from "@/lib/types"

type AssessmentStage = "input" | "quiz" | "result"

export default function AssessmentPage() {
  const router = useRouter()
  const { user } = useUser()
  const [stage, setStage] = useState<AssessmentStage>("input")

  const [topic, setTopic] = useState("")
  const [difficulty, setDifficulty] = useState("medium")
  const [questionCount, setQuestionCount] = useState("5")
  const [isAssignment, setIsAssignment] = useState(false)
  const [isMcqOnly, setIsMcqOnly] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<AssessmentAnswer[]>([])
  const [startTime, setStartTime] = useState<number>(Date.now())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<EvalResult | null>(null)

  const currentQuestion = questions[currentIndex]
  const isLastQuestion = currentIndex === questions.length - 1

  const handleGenerateAssessment = async () => {
    if (!topic.trim()) {
      alert("Please enter a topic")
      return
    }

    setIsGenerating(true)

    try {
      // Map frontend difficulty to backend difficulty_level
      const difficultyMap: Record<string, 'Beginner' | 'Intermediate' | 'Advanced'> = {
        'beginner': 'Beginner',
        'medium': 'Intermediate',
        'advanced': 'Advanced',
        'expert': 'Advanced'
      }

      const response = await fetch("/api/v1/agents/assessment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-key",
        },
        body: JSON.stringify({
          mode: "generate",
          lesson_content: topic,
          question_count: parseInt(questionCount),
          difficulty_level: difficultyMap[difficulty],
          is_assignment: isAssignment, // Pass flag to backend
          mcq_only: isMcqOnly,
          model: "assessment-v1",
          temperature: 0.3,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMsg = typeof errorData.error === 'string'
          ? errorData.error
          : typeof errorData.message === 'string'
            ? errorData.message
            : errorData.error?.message || 'Failed to generate assessment'
        throw new Error(errorMsg)
      }

      const data = await response.json()

      // Parse questions from backend response

      // Normalize questions to match frontend interface
      const normalizeQuestion = (q: any) => {
        // Clean up choices to remove "(correct)" marker if model hallucinates it
        const choices = (q.choices || q.options || []).map((c: string) =>
          c.replace(/\s*\(correct\)\s*/gi, "").replace(/\s*\*correct\*\s*/gi, "").trim()
        )

        return {
          ...q,
          text: q.text || q.q, // Handle both 'text' (mock) and 'q' (backend)
          choices: choices,
          correctAnswer: q.correctAnswer || q.correct_answer,
        }
      }


      const count = parseInt(questionCount, 10) || 5
      let rawQuestions: any[] = []
      if (data.questions && Array.isArray(data.questions)) {
        rawQuestions = data.questions
      } else if (data.agent_output?.payload?.questions) {
        rawQuestions = data.agent_output.payload.questions
      } else if (data.payload?.questions) {
        rawQuestions = data.payload.questions
      } else {
        // Fallback to mock if response format unexpected
        console.warn('Unexpected response format, using mock data')
        rawQuestions = mockQuestions
      }

      const finalQuestions = rawQuestions.slice(0, count)
      setQuestions(finalQuestions.map(normalizeQuestion))

      setStage("quiz")
      setStartTime(Date.now())
    } catch (error) {
      console.error("Error generating assessment:", error)
      alert(`Failed to generate assessment: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleAnswer = (choice: string) => {
    const timeMs = Date.now() - startTime
    const newAnswer: AssessmentAnswer = {
      qId: currentQuestion.id,
      choice,
      timeMs,
    }
    setAnswers([...answers, newAnswer])

    if (isLastQuestion) {
      submitAssessment([...answers, newAnswer])
    } else {
      setCurrentIndex(currentIndex + 1)
      setStartTime(Date.now())
    }
  }

  const handleSkip = () => {
    const timeMs = Date.now() - startTime
    const newAnswer: AssessmentAnswer = {
      qId: currentQuestion.id,
      choice: "SKIPPED",
      timeMs,
    }
    setAnswers([...answers, newAnswer])

    if (isLastQuestion) {
      submitAssessment([...answers, newAnswer])
    } else {
      setCurrentIndex(currentIndex + 1)
      setStartTime(Date.now())
    }
  }

  const submitAssessment = async (finalAnswers: AssessmentAnswer[]) => {
    setIsSubmitting(true)

    try {
      let totalScore = 0
      let correctCount = 0
      const detailedResults: any[] = []

      for (const answer of finalAnswers) {
        const question = questions.find(q => q.id === answer.qId)
        if (!question) continue

        let isCorrect = false
        let score = 0 // 0 to 1

        if (!question.type || question.type === 'mcq') {
          // Local grading for MCQs
          const correct = question.correctAnswer?.toString().trim().toLowerCase() || "";
          const userSelection = answer.choice?.toString().trim().toLowerCase() || "";

          // Explicitly handle skipped questions
          if (userSelection === "skipped") {
            isCorrect = false
            score = 0
          } else if (correct === userSelection || (correct.length > 0 && userSelection.includes(correct))) {
            isCorrect = true
            score = 1
          } else if (!question.correctAnswer) {
            // Fallback if no correct answer provided
          }
        }

        // If score is 0 and we want to verify via backend (e.g. for open text), we could still call grade
        // BUT for MCQs validation should be enough locally if we have the answer

        if (isCorrect) {
          correctCount++
          totalScore += 1 // 1 point per question
        }

        detailedResults.push({
          id: question.id,
          text: question.text,
          user_answer: answer.choice,
          correct_answer: question.correctAnswer || "N/A",
          is_correct: isCorrect,
          time_taken: answer.timeMs
        })
      }

      const finalScore = Math.round((totalScore / questions.length) * 100)
      const totalTimeMs = finalAnswers.reduce((acc, curr) => acc + curr.timeMs, 0)

      // Submit to backend for history
      if (user) {
        try {
          await fetch('/api/v1/agents/assessment/submit', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-key'
            },
            body: JSON.stringify({
              mode: 'submit',
              user_id: user.id,
              topic: topic,
              score: finalScore,
              total_questions: questions.length,
              correct_count: correctCount,
              results: detailedResults,
              time_taken_total: totalTimeMs,
            })
          })
        } catch (e) {
          console.error("Failed to save history:", e)
        }
      }
      // Generate personalized feedback using LLM
      let aiStrengths: string[] = []
      let aiWeaknesses: string[] = []
      let suggestedGoal = `${topic} Developer`

      try {
        // Prepare summary for LLM analysis
        const wrongAnswers = detailedResults.filter((r: any) => !r.is_correct)
        const correctAnswers = detailedResults.filter((r: any) => r.is_correct)

        const analysisPrompt = {
          topic,
          score: finalScore,
          totalQuestions: questions.length,
          correctCount,
          wrongQuestions: wrongAnswers.map((r: any) => ({
            question: r.text,
            userAnswer: r.user_answer,
            correctAnswer: r.correct_answer
          })),
          correctQuestions: correctAnswers.slice(0, 3).map((r: any) => r.text) // Sample of correct answers
        }

        const feedbackRes = await fetch('/api/v1/agents/assessment/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-key' },
          body: JSON.stringify(analysisPrompt)
        })

        if (feedbackRes.ok) {
          const feedback = await feedbackRes.json()
          aiStrengths = feedback.strengths || []
          aiWeaknesses = feedback.weaknesses || []
          suggestedGoal = feedback.suggested_goal || suggestedGoal
        }
      } catch (e) {
        console.error("Failed to get AI feedback:", e)
      }

      // Fallback to basic feedback if LLM fails
      if (aiStrengths.length === 0) {
        aiStrengths = finalScore === 100
          ? ["Perfect Score! 🎉", `Complete ${topic} Mastery`, "Exceptional Problem Solving"]
          : finalScore >= 70
            ? ["Good Understanding", `${topic} Fundamentals`, "Problem Solving"]
            : ["Effort", "Determination"]
      }
      if (aiWeaknesses.length === 0 && finalScore < 100) {
        aiWeaknesses = finalScore >= 80
          ? ["Continue exploring advanced topics"]
          : [`Review ${topic} concepts`, "More practice recommended"]
      }
      if (!suggestedGoal || suggestedGoal === `${topic} Developer`) {
        suggestedGoal = finalScore >= 90 ? `Expert ${topic} Developer` : finalScore >= 60 ? `Advanced ${topic} Developer` : `${topic} Beginner`
      }

      const evalResult: EvalResult = {
        score: finalScore,
        strengths: aiStrengths,
        weaknesses: aiWeaknesses,
        suggested_goal: suggestedGoal,
        // Attach detailed results for UI
        ...({ detailedResults } as any)
      }

      setResult(evalResult)
      setStage("result")
    } catch (error) {
      console.error("Error submitting assessment:", error)
      alert("Failed to submit assessment. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleContinue = () => {
    if (result) {
      localStorage.setItem("assessmentResult", JSON.stringify(result))
      localStorage.setItem("assessmentTopic", topic)
      router.push("/roadmap")
    }
  }

  const handleRestart = () => {
    setStage("input")
    setTopic("")
    setDifficulty("medium")
    setQuestionCount("5")
    setQuestions([])
    setCurrentIndex(0)
    setAnswers([])
    setResult(null)
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated Background Elements - Shared across app but customized here */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] -left-10 w-160 h-160 bg-primary/5 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-pulse-slow" />
        <div className="absolute top-[20%] -right-20 w-140 h-140 bg-accent/5 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-pulse-slow animation-delay-2000" />
        <div className="absolute bottom-[-10%] left-1/3 w-180 h-180 bg-chart-4/5 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse-slow animation-delay-4000" />
      </div>

      <main className="container mx-auto px-4 py-8 relative">
        <AnimatePresence mode="wait">
          {stage === "input" && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="max-w-2xl mx-auto"
            >
              <div className="text-center mb-10">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="inline-block mb-3 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-medium text-sm"
                >
                  AI-Powered Evaluation
                </motion.div>
                <h1 className="text-4xl md:text-5xl font-bold font-display mb-4 tracking-tight">
                  <span className="text-primary">
                    Skill Assessment
                  </span>
                </h1>
                <p className="text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
                  Generate a custom assessment to test your knowledge and get a personalized learning path.
                </p>
              </div>

              <Card className="p-8 md:p-10 space-y-8 bg-card border border-border shadow-2xl relative overflow-hidden rounded-3xl">

                <div className="space-y-3 relative">
                  <label className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    Topic / Subject
                  </label>
                  <div className="relative">
                    <Input
                      placeholder="e.g., React, JavaScript, Python, Data Structures..."
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleGenerateAssessment()}
                      className="text-lg py-6 px-5 rounded-xl border-border/50 bg-background/50 focus:bg-background transition-all shadow-sm focus:ring-2 focus:ring-primary/20"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:block">
                      <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded border border-border/50">Press Enter</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground pl-1">
                    Enter any technology, programming language, or concept you want to assess
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                  <div className="space-y-3">
                    <label className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
                      <div className="p-1.5 rounded-lg bg-accent/10 text-accent">
                        <Target className="h-4 w-4" />
                      </div>
                      Difficulty Level
                    </label>
                    <Select value={difficulty} onValueChange={setDifficulty}>
                      <SelectTrigger className="h-12 rounded-xl border-border/50 bg-background/50 focus:bg-background transition-all">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="medium">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                        <SelectItem value="expert">Expert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
                      <div className="p-1.5 rounded-lg bg-chart-4/10 text-chart-4">
                        <Trophy className="h-4 w-4" />
                      </div>
                      Number of Questions
                    </label>
                    <Select value={questionCount} onValueChange={setQuestionCount}>
                      <SelectTrigger className="h-12 rounded-xl border-border/50 bg-background/50 focus:bg-background transition-all">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 Questions</SelectItem>
                        <SelectItem value="10">10 Questions</SelectItem>
                        <SelectItem value="15">15 Questions</SelectItem>
                        <SelectItem value="20">20 Questions</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>



                <Button
                  className="w-full h-14 text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 shadow-lg rounded-xl relative overflow-hidden"
                  size="lg"
                  onClick={handleGenerateAssessment}
                  disabled={isGenerating || !topic.trim()}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Generating Assessment...
                    </>
                  ) : (
                    <span className="flex items-center gap-2">
                      Start Assessment <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  )}
                </Button>

                <div className="pt-6 border-t border-border/50 relative">
                  <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wider">Popular Topics</h3>
                  <div className="flex flex-wrap gap-2">
                    {["React", "JavaScript", "Python", "Node.js", "TypeScript", "System Design", "Data Structures"].map((t) => (
                      <Button
                        key={t}
                        variant="outline"
                        size="sm"
                        onClick={() => setTopic(t)}
                        className="rounded-full border-border/50 bg-background/30 hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all"
                      >
                        {t}
                      </Button>
                    ))}
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {stage === "quiz" && !isSubmitting && (
            <motion.div
              key="quiz"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-3xl mx-auto"
            >
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-block mb-3 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-medium text-sm"
                >
                  Assessment In Progress
                </motion.div>
                <h1 className="text-3xl md:text-4xl font-bold font-display mb-2 capitalize">
                  {topic} Assessment
                </h1>
                <p className="text-muted-foreground">Focus and do your best!</p>
              </div>

              <AssessmentProgress current={currentIndex + 1} total={questions.length} />

              <QuestionCard
                key={currentQuestion?.id || currentIndex}
                question={currentQuestion}
                onAnswer={handleAnswer}
                onSkip={handleSkip}
                isSubmitting={false}
              />
            </motion.div>
          )}

          {isSubmitting && (
            <motion.div
              key="submitting"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl mx-auto text-center py-20"
            >
              <div className="relative w-24 h-24 mx-auto mb-8">
                <div className="absolute inset-0 rounded-full border-4 border-muted opacity-20" />
                <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                <div className="absolute inset-4 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                  <Brain className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h2 className="text-3xl font-bold mb-4 font-display">Analyzing Performance</h2>
              <p className="text-muted-foreground max-w-md mx-auto text-lg">
                Our AI is evaluating your answers, identifying strengths, and preparing your personalized learning path...
              </p>
            </motion.div>
          )}

          {stage === "result" && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-4xl mx-auto"
            >
              <div className="text-center mb-10">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                  className="relative inline-block"
                >
                  <div className="absolute -inset-4 bg-primary/20 rounded-full blur-xl animate-pulse" />
                  <Trophy className="h-20 w-20 text-primary relative z-10 drop-shadow-xl" />
                </motion.div>
                <h1 className="text-4xl md:text-5xl font-bold font-display mb-4 mt-6 text-foreground">
                  Assessment Complete!
                </h1>
                <p className="text-xl text-muted-foreground">Here is your comprehensive performance report</p>
              </div>

              <div className="grid gap-8">
                {/* Score Card */}
                <Card className="p-8 text-center relative overflow-hidden border-white/10 bg-card/50 backdrop-blur-md shadow-2xl rounded-3xl group">
                  <div className="absolute inset-0 bg-primary/5 opacity-50" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-center gap-6 mb-6">
                      <div className="text-7xl md:text-8xl font-black font-display text-primary drop-shadow-sm filter">
                        {result.score}%
                      </div>
                      <div className="text-left space-y-1">
                        <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Final Score</p>
                        <div className="text-2xl">
                          {result.score >= 80 ? "🏆 Excellent" : result.score >= 60 ? "👍 Good" : "💪 Keep Going"}
                        </div>
                      </div>
                    </div>

                    {/* Simple visual meter */}
                    <div className="max-w-md mx-auto h-3 bg-muted/50 rounded-full overflow-hidden mb-6 border border-white/5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${result.score}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.5 }}
                        className={`h-full ${result.score >= 70 ? 'bg-green-500' : 'bg-orange-500'}`}
                      />
                    </div>
                  </div>
                </Card>

                <div className="grid md:grid-cols-2 gap-8">
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
                    <Card className="p-8 h-full border-green-500/10 bg-green-500/5 backdrop-blur-sm rounded-3xl hover:shadow-lg transition-all border-l-4 border-l-green-500">
                      <h3 className="font-bold text-xl mb-6 flex items-center gap-3 text-green-600 dark:text-green-400">
                        <div className="p-2 rounded-lg bg-green-500/10"><CheckCircle2 className="w-5 h-5" /></div>
                        Key Strengths
                      </h3>
                      <ul className="space-y-4">
                        {result.strengths.map((strength, idx) => (
                          <li key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-background/40 border border-green-500/10">
                            <span className="text-green-500 font-bold mt-0.5">•</span>
                            <span className="text-foreground/90 font-medium">{strength}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
                    {result.weaknesses.length > 0 ? (
                      <Card className="p-8 h-full border-orange-500/10 bg-orange-500/5 backdrop-blur-sm rounded-3xl hover:shadow-lg transition-all border-l-4 border-l-orange-500">
                        <h3 className="font-bold text-xl mb-6 flex items-center gap-3 text-orange-600 dark:text-orange-400">
                          <div className="p-2 rounded-lg bg-orange-500/10"><AlertCircle className="w-5 h-5" /></div>
                          Focus Areas
                        </h3>
                        <ul className="space-y-4">
                          {result.weaknesses.map((weakness, idx) => (
                            <li key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-background/40 border border-orange-500/10">
                              <span className="text-orange-500 font-bold mt-0.5">•</span>
                              <span className="text-foreground/90 font-medium">{weakness}</span>
                            </li>
                          ))}
                        </ul>
                      </Card>
                    ) : (
                      <Card className="p-8 h-full border-green-500/10 bg-green-500/5 backdrop-blur-sm rounded-3xl hover:shadow-lg transition-all border-l-4 border-l-green-500">
                        <h3 className="font-bold text-xl mb-6 flex items-center gap-3 text-green-600 dark:text-green-400">
                          <div className="p-2 rounded-lg bg-green-500/10"><Trophy className="w-5 h-5" /></div>
                          No Weaknesses!
                        </h3>
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                          <div className="text-5xl mb-4">🎉</div>
                          <p className="text-foreground/90 font-medium">Perfect performance!</p>
                          <p className="text-muted-foreground text-sm mt-2">You answered all questions correctly.</p>
                        </div>
                      </Card>
                    )}
                  </motion.div>
                </div>

                <Card className="p-8 bg-primary/10 border-primary/20 rounded-3xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                  <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
                    <div>
                      <h3 className="font-bold text-xl mb-2 flex items-center justify-center md:justify-start gap-2">
                        <Sparkles className="w-5 h-5 text-accent animate-pulse" />
                        Recommended Next Step
                      </h3>
                      <p className="text-muted-foreground">
                        Based on your results, we've designed a custom path: <strong className="text-foreground text-lg ml-1">{result.suggested_goal}</strong>
                      </p>
                    </div>
                    <Button onClick={handleContinue} size="lg" className="min-w-[200px] h-12 bg-primary hover:bg-primary/90 shadow-lg hover:shadow-primary/30 rounded-xl transition-all">
                      Generate Roadmap <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </div>
                </Card>

                {/* Detailed Analysis */}
                <div className="space-y-4">
                  <h3 className="font-bold text-2xl font-display px-2">Detailed Analysis</h3>
                  {(result as any).detailedResults?.map((res: any, idx: number) => (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 + (idx * 0.1) }}
                      key={idx}
                      className={`p-6 rounded-2xl border backdrop-blur-sm transition-all hover:shadow-md ${res.is_correct ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}
                    >
                      <div className="flex flex-col md:flex-row justify-between gap-4 mb-3">
                        <span className="font-bold text-lg text-foreground/80">Question {idx + 1}</span>
                        <span className="text-xs font-mono px-2 py-1 rounded bg-background/50 border border-border/50 text-muted-foreground self-start">
                          {(res.time_taken / 1000).toFixed(1)}s
                        </span>
                      </div>

                      <p className="mb-4 text-base font-medium leading-relaxed">{res.text}</p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-4 pt-4 border-t border-border/10">
                        <div className="bg-background/40 p-3 rounded-lg">
                          <span className="text-muted-foreground text-xs uppercase tracking-wider block mb-1">Your Answer</span>
                          <span className={`font-semibold text-base ${res.is_correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                            {res.user_answer}
                          </span>
                        </div>

                        {(!res.is_correct || true) && (
                          <div className="bg-background/40 p-3 rounded-lg">
                            <span className="text-muted-foreground text-xs uppercase tracking-wider block mb-1">Correct Answer</span>
                            <span className="text-green-600 dark:text-green-400 font-semibold text-base">{res.correct_answer}</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>


                <div className="flex gap-4 justify-center pt-8 pb-12">
                  <Button variant="outline" size="lg" onClick={handleRestart} className="h-12 px-8 rounded-xl border-border/50 hover:bg-muted/50">
                    Retake Assessment
                  </Button>
                  <Button variant="ghost" size="lg" onClick={() => router.push("/dashboard")} className="h-12 px-8 rounded-xl text-muted-foreground hover:text-foreground">
                    Back to Dashboard
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
