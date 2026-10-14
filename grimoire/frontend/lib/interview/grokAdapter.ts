import { ChatMessage } from "./types";
import { backendRequest } from "../server/api-client";

interface GenerateQuestionParams {
  jobRole: string;
  skills: string[];
  level: string;
  candidateLanguage: string;
  messages: ChatMessage[];
  resume_text?: string;
  company_id?: string;
}

/**
 * Groq LLM Adapter for Interview Question Generation
 * Provides a lightweight interface for generating interview questions
 * by calling the backend API.
 */
class GrokAdapter {
  /**
   * Generate an interview question based on role, skills and conversation history
   */
  async generateInterviewQuestion(params: GenerateQuestionParams): Promise<string> {
    try {
      const response = await backendRequest("/v1/agents/interview/generate-question", {
        method: "POST",
        body: {
          job_role: params.jobRole,
          skills: params.skills,
          level: params.level,
          candidate_language: params.candidateLanguage,
          messages: params.messages,
          resume_text: params.resume_text,
          company_id: params.company_id
        },
      });

      return response.question || response.payload?.question || "";
    } catch (error) {
      console.error("GrokAdapter error:", error);
      // Fallback question if backend is unavailable
      return this.getFallbackQuestion(params.messages.length);
    }
  }

  /**
   * Evaluate an interview based on transcript
   */
  async evaluateInterview(transcript: string): Promise<any> {
    try {
      const response = await backendRequest("/v1/agents/interview/score", {
        method: "POST",
        body: { transcript },
      });

      return response;
    } catch (error) {
      console.error("GrokAdapter evaluation error:", error);
      // Fallback scores
      return {
        scores: {
          technicalKnowledge: 3,
          communicationClarity: 3,
          problemSolving: 3,
          softSkills: 3,
          toneAndSentiment: 3,
          structureAndCoherence: 3,
        },
        overall: 3.0,
        confidence: 0.5,
        rationale: "Scoring service temporarily unavailable. Manual review recommended.",
        strengths: ["Completed the interview"],
        weaknesses: ["N/A"],
        recommendations: {
          growthAreas: "Review answers after service is restored",
        },
      };
    }
  }

  /**
   * Generate a fallback question when backend is unavailable
   */
  private getFallbackQuestion(questionIndex: number): string {
    const fallbackQuestions = [
      "Can you tell me about yourself and your experience in this field?",
      "What projects have you worked on that you're most proud of?",
      "Describe a challenging technical problem you've solved recently.",
      "How do you approach learning new technologies?",
      "Can you walk me through your problem-solving process?",
      "Tell me about a time you had to work with a difficult team member.",
      "What are your thoughts on code quality and testing?",
      "How do you stay updated with the latest industry trends?",
      "Where do you see yourself in the next few years?",
      "Do you have any questions for me about the role or company?",
    ];

    return fallbackQuestions[questionIndex % fallbackQuestions.length];
  }
}

// Export singleton instance
export const grokAdapter = new GrokAdapter();
