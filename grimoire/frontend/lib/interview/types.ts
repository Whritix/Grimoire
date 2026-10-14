export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export type InterviewState =
  | "created"
  | "consented"
  | "started"
  | "in_progress"
  | "completed"
  | "scored";

export interface InterviewSession {
  id: string;
  state: InterviewState;
  jobRole: string;
  skills: string[];
  level: "junior" | "mid" | "senior";
  candidateLanguage: string;
  createdAt: Date;
  updatedAt: Date;
  consentedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  scoredAt?: Date;
  resumeText?: string;
  companyId?: string;
}

export interface TranscriptEntry {
  id: string;
  sessionId: string;
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: Date;
  confidence?: number;
}
