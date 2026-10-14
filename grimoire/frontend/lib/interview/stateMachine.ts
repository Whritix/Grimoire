import { InterviewSession, InterviewState, TranscriptEntry, ChatMessage } from './types';

// Event types for the state machine
export type InterviewEvent =
    | { type: 'CONSENT' }
    | { type: 'START' }
    | { type: 'ANSWER'; transcript: string; confidence?: number }
    | { type: 'ASK_QUESTION'; question: string }
    | { type: 'COMPLETE' }
    | { type: 'SCORE' };

// State transition map
const transitions: Record<InterviewState, Partial<Record<InterviewEvent['type'], InterviewState>>> = {
    created: { CONSENT: 'consented' },
    consented: { START: 'started' },
    started: { ASK_QUESTION: 'in_progress' },
    in_progress: {
        ANSWER: 'in_progress',
        ASK_QUESTION: 'in_progress',
        COMPLETE: 'completed'
    },
    completed: { SCORE: 'scored' },
    scored: {}
};

export class InterviewStateMachine {
    private session: InterviewSession;
    private transcript: TranscriptEntry[] = [];
    private questionCount: number = 0;
    private maxQuestions: number = 10;

    constructor(
        jobRole: string,
        skills: string[],
        level: 'junior' | 'mid' | 'senior' = 'mid',
        candidateLanguage: string = 'en',
        resumeText?: string,
        companyId?: string
    ) {
        this.session = {
            id: `sess_${crypto.randomUUID()}`,
            state: 'created',
            jobRole,
            skills,
            level,
            candidateLanguage,
            resumeText,
            companyId,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    getSession(): InterviewSession {
        return { ...this.session };
    }

    getState(): InterviewState {
        return this.session.state;
    }

    getSessionId(): string {
        return this.session.id;
    }

    getTranscript(): TranscriptEntry[] {
        return [...this.transcript];
    }

    getConversationHistory(): ChatMessage[] {
        return this.transcript.map(entry => ({
            role: entry.role,
            content: entry.content
        }));
    }

    getQuestionCount(): number {
        return this.questionCount;
    }

    shouldEndInterview(): boolean {
        return this.questionCount >= this.maxQuestions;
    }

    canTransition(event: InterviewEvent['type']): boolean {
        const allowedTransitions = transitions[this.session.state];
        return !!allowedTransitions && event in allowedTransitions;
    }

    dispatch(event: InterviewEvent): boolean {
        if (!this.canTransition(event.type)) {
            console.warn(`Invalid transition: ${this.session.state} + ${event.type}`);
            return false;
        }

        const newState = transitions[this.session.state][event.type];
        if (!newState) return false;

        // Update state
        this.session.state = newState;
        this.session.updatedAt = new Date();

        // Handle event-specific logic
        switch (event.type) {
            case 'CONSENT':
                this.session.consentedAt = new Date();
                break;

            case 'START':
                this.session.startedAt = new Date();
                break;

            case 'ANSWER':
                this.transcript.push({
                    id: crypto.randomUUID(),
                    sessionId: this.session.id,
                    role: 'user',
                    content: event.transcript,
                    timestamp: new Date(),
                    confidence: event.confidence
                });
                break;

            case 'ASK_QUESTION':
                this.transcript.push({
                    id: crypto.randomUUID(),
                    sessionId: this.session.id,
                    role: 'assistant',
                    content: event.question,
                    timestamp: new Date()
                });
                this.questionCount++;
                break;

            case 'COMPLETE':
                this.session.completedAt = new Date();
                break;

            case 'SCORE':
                this.session.scoredAt = new Date();
                break;
        }

        return true;
    }

    addSystemMessage(content: string): void {
        this.transcript.push({
            id: crypto.randomUUID(),
            sessionId: this.session.id,
            role: 'system',
            content,
            timestamp: new Date()
        });
    }

    getTranscriptText(): string {
        return this.transcript
            .filter(e => e.role !== 'system')
            .map(e => `${e.role.toUpperCase()}: ${e.content}`)
            .join('\n\n');
    }

    getDurationMinutes(): number {
        if (!this.session.startedAt) return 0;
        const endTime = this.session.completedAt || new Date();
        return Math.round((endTime.getTime() - this.session.startedAt.getTime()) / 60000);
    }

    setResumeText(text: string) {
        this.session.resumeText = text;
    }
}

// Store active sessions in memory (global to survive file reloads in dev)
declare global {
    var interviewActiveSessions: Map<string, InterviewStateMachine> | undefined;
}

const activeSessions = global.interviewActiveSessions || new Map<string, InterviewStateMachine>();
if (process.env.NODE_ENV !== 'production') {
    global.interviewActiveSessions = activeSessions;
}

export const sessionManager = {
    create(
        jobRole: string,
        skills: string[],
        level: 'junior' | 'mid' | 'senior' = 'mid',
        candidateLanguage: string = 'en',
        resumeText?: string,
        companyId?: string
    ): InterviewStateMachine {
        const machine = new InterviewStateMachine(jobRole, skills, level, candidateLanguage, resumeText, companyId);
        activeSessions.set(machine.getSessionId(), machine);
        return machine;
    },

    get(sessionId: string): InterviewStateMachine | undefined {
        return activeSessions.get(sessionId);
    },

    delete(sessionId: string): boolean {
        return activeSessions.delete(sessionId);
    },

    getAllSessions(): InterviewSession[] {
        return Array.from(activeSessions.values()).map(m => m.getSession());
    }
};
