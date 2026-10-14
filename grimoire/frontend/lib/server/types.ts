/**
 * Server-side TypeScript types for backend API layer
 */

import type { RoadmapModule, Resource, Question } from '@/lib/types';

// ============================================
// AUTHENTICATION & TENANT
// ============================================

export interface TenantInfo {
    tenantId: string;
    plan: 'free' | 'pro' | 'enterprise';
    quota: {
        requestsPerHour: number;
        requestsUsed: number;
    };
    metadata?: Record<string, unknown>;
}

export interface AuthContext {
    tenant: TenantInfo;
    userId?: string;
    apiKey?: string;
}

// ============================================
// API REQUEST/RESPONSE SHAPES
// ============================================

// Planner - matches Teaching-assistant PlannerRequest
export interface PlannerRequest {
    model?: string;
    messages?: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
    tenant_id?: string;
    diagnostic_results?: any;
    user_goal?: string;
    availability_hours_per_week?: number;
    plan_type?: 'curriculum' | 'schedule';
    time_horizon_weeks?: number;
}

export interface PlannerResponse {
    roadmap: RoadmapModule[];
    metadata: {
        goal: string;
        estimatedHours: number;
        difficulty: 'beginner' | 'intermediate' | 'advanced';
    };
}

// Retriever
export interface RetrieverRequest {
    query: string;
    limit?: number;
    tenant_id?: string;
}

export interface RetrieverResponse {
    resources: Resource[];
    metadata?: {
        totalFound: number;
        query: string;
    };
}

// Composer
export interface ComposerRequest {
    contextIds?: string[];
    documents?: Array<{ id: string; text: string; title?: string; url?: string; source_type?: string }>;
    lessonMeta?: {
        title: string;
        moduleId: string;
        context?: string;
    };
    tenant_id?: string;
}

export interface ComposerResponse {
    content: string;
    resources: Resource[];
    metadata?: {
        wordCount: number;
        readTimeMinutes: number;
    };
}

// Assessment - matches Teaching-assistant GenerateRequest and GradeRequest
export interface AssessmentRequest {
    mode: 'generate' | 'grade' | 'flashcards';
    // Generate mode fields
    lesson_content?: string;
    question_count?: number;
    difficulty_level?: 'Beginner' | 'Intermediate' | 'Advanced';
    difficulty_distribution?: { easy: number; medium: number; hard: number };
    // Grade mode fields
    question_text?: string;
    correct_answer?: string;
    user_answer?: string;
    rubric?: string;
    // Common fields
    model?: string;
    temperature?: number;
    max_tokens?: number;
}

export interface AssessmentGenerateResponse {
    questions: Question[];
    metadata: {
        difficulty: string;
        topic: string;
        timeLimit?: number;
    };
}

export interface AssessmentGradeResponse {
    score: number;
    strengths: string[];
    weaknesses: string[];
    feedback: string;
    suggestedGoal?: string;
}

// Doubt Assistant - matches Teaching-assistant DoubtRequest
export interface DoubtAssistantRequest {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    documents?: Array<{ id?: string; text: string; title?: string; url?: string }>;
    images?: string[];
    current_lesson?: string;
    user_profile?: any;
    user_id?: string;
    temperature?: number;
    max_tokens?: number; // Up to 8192
    use_general_knowledge?: boolean;
    tenant_id?: string;
}

export interface DoubtAssistantResponse {
    reply: string;
    sources?: Resource[];
}

// RL Controller
export interface RLControllerRequest {
    performanceMetrics: {
        recentScores: number[];
        timeSpent: number;
        attemptsCount: number;
    };
}

export interface RLControllerResponse {
    difficulty: 'easy' | 'medium' | 'hard';
    nextActions: string[];
    reasoning?: string;
}

// Badge
export interface BadgeRequest {
    userId: string;
    achievement: string;
    metadata?: Record<string, unknown>;
}

export interface BadgeResponse {
    badgeId: string;
    signature: string;
    badgeUrl: string;
    metadata: {
        userId: string;
        achievement: string;
        timestamp: string;
        [key: string]: unknown;
    };
}

// Summarize
export interface SummarizeRequest {
    text: string;
    length?: 'short' | 'medium' | 'long';
}

export interface SummarizeResponse {
    summary: string;
    metadata?: {
        originalLength: number;
        summaryLength: number;
    };
}

// YouTube Proxy
export interface YouTubeVideo {
    id: string;
    title: string;
    channelTitle: string;
    duration: string; // ISO 8601 duration (e.g., "PT10M30S")
    thumbnail: string;
    url: string;
}

export interface YouTubeProxyResponse {
    videos: YouTubeVideo[];
    metadata?: {
        query: string;
        totalResults: number;
    };
}

// ============================================
// CACHING
// ============================================

export interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

// ============================================
// JOBS
// ============================================

export interface Job {
    id: string;
    type: 'pdf' | 'export' | 'other';
    status: 'pending' | 'processing' | 'completed' | 'failed';
    data: Record<string, unknown>;
    result?: unknown;
    error?: string;
    createdAt: number;
    updatedAt: number;
}

// ============================================
// SSE STREAMING
// ============================================

export type SSEEvent =
    | { type: 'token'; token: string }
    | { type: 'done'; sources?: Resource[] }
    | { type: 'error'; error: string };

// ============================================
// METRICS
// ============================================

export interface Metrics {
    requests: Record<string, { count: number; success: number; failure: number }>;
    uptime: number;
    timestamp: string;
}

// ============================================
// HEALTH CHECK
// ============================================

export interface HealthCheck {
    status: 'ok' | 'degraded' | 'down';
    services: {
        redis?: 'ok' | 'down';
        [key: string]: string | undefined;
    };
    timestamp: string;
    uptime: number;
}
