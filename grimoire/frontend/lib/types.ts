// Extended types for new features

import type { ReactNode } from 'react'

// Existing types from lib/types.ts
export interface RoadmapModule {
  moduleId: string
  title: string
  description?: string
  outcome?: string  // Response from backend often has this
  lessons: LessonItem[]
  estimatedHours: number
  estimated_hours?: number  // Backend often uses snake_case
  status?: 'locked' | 'current' | 'completed'
}

export interface LessonItem {
  id?: string // Alias for lessonId often returned by backend
  lessonId: string
  title: string
  type: 'video' | 'article' | 'quiz'
  duration?: number
  estMin?: number // Often returned by backend
}

export interface Question {
  id: string
  text: string
  choices: string[]
  category: string
  type?: 'mcq' | 'short' | 'code'
  correctAnswer?: string
}

export interface AssessmentAnswer {
  qId: string
  choice: string
  timeMs: number
}

export interface EvalResult {
  score: number
  strengths: string[]
  weaknesses: string[]
  suggested_goal: string
}

// New types for Space feature
export interface VideoMetadata {
  videoId: string
  title: string
  description: string
  duration: number
  thumbnail: string
  channelName: string
  uploadDate: string
  transcript?: string
  chapters?: VideoChapter[]
  keyTopics?: string[]
  summary?: string
}

export interface VideoChapter {
  timestamp: number
  title: string
  description?: string
}

export interface VideoChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  relevantTimestamps?: number[]
  suggestions?: string[]
}

export interface PlaylistInfo {
  playlistId: string
  title: string
  description: string
  videos: VideoMetadata[]
  totalDuration: number
}

// Interview feature types
export interface InterviewSession {
  sessionId: string
  role: string
  company?: string
  jobDescription: string
  status: 'pending' | 'active' | 'completed' | 'paused'
  questions: InterviewQuestion[]
  startedAt: number
  completedAt?: number
}

export interface InterviewQuestion {
  questionId: string
  question: string
  type: 'behavioral' | 'technical' | 'situational'
  difficulty: 'easy' | 'medium' | 'hard'
  answered: boolean
  answer?: string
  feedback?: string
}

export interface InterviewFeedback {
  sessionId: string
  overallScore: number
  feedback: {
    communication: FeedbackDetail
    technical: FeedbackDetail
    confidence: FeedbackDetail
    bodyLanguage?: FeedbackDetail
    problemSolving?: FeedbackDetail
  }
  improvements: string[]
  strengths: string[]
  recordingUrl?: string
}

export interface FeedbackDetail {
  score: number  // 0-100
  comments: string
  examples?: string[]
}

// User profile types
export interface UserBadge {
  badgeId: string
  name: string
  description: string
  earnedAt: number
  icon: string
  category: 'learning' | 'achievement' | 'streak' | 'special'
}

export interface UserProfile {
  userId: string
  name: string
  email: string
  avatar?: string
  badges: UserBadge[]
  stats: UserStats
  completedModules: string[]
  currentGoal?: string
}

export interface UserStats {
  completedQuizzes: number
  totalScore: number
  videoHoursWatched: number
  interviewsPracticed: number
  currentStreak: number
  totalLearningHours: number
}

// Assessment enhancement types
export interface AssessmentContext {
  userBadges: UserBadge[]
  pastQuizzes: QuizHistory[]
  requirements?: string
  targetRole?: string
}

export interface QuizHistory {
  quizId: string
  topic: string
  score: number
  completedAt: number
  questionsCount: number
}

// Roadmap enhancement types
export interface RoadmapRequest {
  goal: string
  score?: number
  completedSkills: string[]
  desiredSkills: string[]
  timeAvailable?: number  // hours per week
  reasoning?: boolean
}

export interface EnhancedRoadmap {
  roadmap: RoadmapModule[]
  reasoning: string
  estimatedTotalTime: number
  milestones: Milestone[]
  metadata: RoadmapMetadata
}

export interface Milestone {
  id: string
  title: string
  achievementCriteria: string
  rewardBadge?: string
}

export interface RoadmapMetadata {
  goal: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedHours: number
  prerequisites: string[]
}

// Media permission types
export interface MediaPermissions {
  camera: boolean
  microphone: boolean
  screen?: boolean
}

export interface RecordingOptions {
  video: boolean
  audio: boolean
  screen?: boolean
}
