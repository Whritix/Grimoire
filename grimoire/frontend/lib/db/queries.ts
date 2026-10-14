/**
 * Database Query Helpers
 * Centralized functions for all database operations
 */

import { prisma } from './prisma'
import type { User, QuizResult, Roadmap, VideoProgress, LearningHistory } from '@prisma/client'

// ============================================
// USER OPERATIONS
// ============================================

export async function getUserByClerkId(clerkId: string): Promise<User | null> {
    return await prisma.user.findUnique({
        where: { clerkId },
        include: {
            quizResults: {
                take: 10,
                orderBy: { createdAt: 'desc' },
            },
            roadmaps: {
                orderBy: { createdAt: 'desc' },
            },
        },
    })
}

export async function createUser(data: {
    clerkId: string
    email: string
    name?: string
    avatar?: string
}): Promise<User> {
    return await prisma.user.create({
        data,
    })
}

export async function upsertUser(data: {
    clerkId: string
    email: string
    name?: string
    avatar?: string
}): Promise<User> {
    return await prisma.user.upsert({
        where: { clerkId: data.clerkId },
        update: {
            email: data.email,
            name: data.name,
            avatar: data.avatar,
        },
        create: data,
    })
}

export async function updateUserGoal(userId: string, goal: string): Promise<User> {
    return await prisma.user.update({
        where: { id: userId },
        data: { currentGoal: goal },
    })
}

// ============================================
// QUIZ OPERATIONS
// ============================================

export async function saveQuizResult(data: {
    userId: string
    topic: string
    score: number
    totalQuestions: number
    correctAnswers: number
    answers: any
    strengths: string[]
    weaknesses: string[]
    timeSpentMs?: number
}): Promise<QuizResult> {
    return await prisma.quizResult.create({
        data,
    })
}

export async function getUserQuizHistory(
    userId: string,
    limit: number = 20
): Promise<QuizResult[]> {
    return await prisma.quizResult.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
    })
}

export async function getQuizStatsByUser(userId: string) {
    const results = await prisma.quizResult.findMany({
        where: { userId },
    })

    if (results.length === 0) {
        return {
            totalQuizzes: 0,
            averageScore: 0,
            topTopics: [],
            recentStrengths: [],
            recentWeaknesses: [],
        }
    }

    const averageScore = results.reduce((sum, r) => sum + r.score, 0) / results.length

    // Get top topics
    const topicCounts = results.reduce((acc, r) => {
        acc[r.topic] = (acc[r.topic] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    const topTopics = Object.entries(topicCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([topic]) => topic)

    // Get recent strengths/weaknesses
    const recent = results.slice(0, 5)
    const recentStrengths = [...new Set(recent.flatMap((r) => r.strengths))]
    const recentWeaknesses = [...new Set(recent.flatMap((r) => r.weaknesses))]

    return {
        totalQuizzes: results.length,
        averageScore,
        topTopics,
        recentStrengths,
        recentWeaknesses,
    }
}

// ============================================
// ROADMAP OPERATIONS
// ============================================

export async function saveRoadmap(data: {
    userId: string
    title: string
    goal: string
    modules: any
    estimatedHours?: number
    difficulty?: string
}): Promise<Roadmap> {
    return await prisma.roadmap.create({
        data,
    })
}

export async function getUserRoadmaps(userId: string): Promise<Roadmap[]> {
    return await prisma.roadmap.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
    })
}

export async function updateRoadmapProgress(roadmapId: string, progress: number): Promise<Roadmap> {
    return await prisma.roadmap.update({
        where: { id: roadmapId },
        data: { progress },
    })
}

export async function deleteRoadmap(roadmapId: string): Promise<Roadmap> {
    return await prisma.roadmap.delete({
        where: { id: roadmapId },
    })
}

// ============================================
// VIDEO PROGRESS OPERATIONS
// ============================================

export async function updateVideoProgress(data: {
    userId: string
    videoId: string
    videoTitle?: string
    playlistId?: string
    currentTime: number
    duration: number
    completed?: boolean
    notes?: string
}): Promise<VideoProgress> {
    return await prisma.videoProgress.upsert({
        where: {
            userId_videoId: {
                userId: data.userId,
                videoId: data.videoId,
            },
        },
        update: {
            currentTime: data.currentTime,
            duration: data.duration,
            completed: data.completed,
            notes: data.notes,
            updatedAt: new Date(),
        },
        create: data,
    })
}

export async function getVideoProgress(
    userId: string,
    videoId: string
): Promise<VideoProgress | null> {
    return await prisma.videoProgress.findUnique({
        where: {
            userId_videoId: {
                userId,
                videoId,
            },
        },
    })
}

export async function getUserVideoHistory(
    userId: string,
    limit: number = 20
): Promise<VideoProgress[]> {
    return await prisma.videoProgress.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: limit,
    })
}

// ============================================
// LEARNING HISTORY OPERATIONS
// ============================================

export async function saveLearningHistory(data: {
    userId: string
    activityType: string
    topic?: string
    score?: number
    metadata: any
}): Promise<LearningHistory> {
    return await prisma.learningHistory.create({
        data,
    })
}

export async function getUserLearningHistory(
    userId: string,
    limit: number = 50
): Promise<LearningHistory[]> {
    return await prisma.learningHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
    })
}

export async function getLearningHistoryByType(
    userId: string,
    activityType: string,
    limit: number = 20
): Promise<LearningHistory[]> {
    return await prisma.learningHistory.findMany({
        where: {
            userId,
            activityType,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
    })
}

// ============================================
// ANALYTICS
// ============================================

export async function getUserStats(userId: string) {
    const [quizStats, videoCount, roadmapCount, activityCount] = await Promise.all([
        getQuizStatsByUser(userId),
        prisma.videoProgress.count({ where: { userId } }),
        prisma.roadmap.count({ where: { userId } }),
        prisma.learningHistory.count({ where: { userId } }),
    ])

    const recentActivity = await getUserLearningHistory(userId, 10)

    return {
        quizzes: quizStats,
        videosWatched: videoCount,
        roadmapsCreated: roadmapCount,
        totalActivities: activityCount,
        recentActivity,
    }
}
