import { useCallback } from "react";
import { useUser } from "@clerk/nextjs";

/**
 * Hook for logging user activities to the backend.
 * Provides a standardized way to track page views and UI actions.
 */
export function useActivity() {
  const { user } = useUser();

  const logActivity = useCallback(
    async (
      activityType: string,
      data: Record<string, any> = {},
      metadata: Record<string, any> = {}
    ) => {
      try {
        const userId = user?.id;
        if (!userId) {
          // Skip logging if user is not authenticated
          return;
        }

        const response = await fetch("/api/v1/user/activity", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userId,
            activity_type: activityType,
            data,
            metadata: {
              url: typeof window !== "undefined" ? window.location.href : "",
              ...metadata,
            },
          }),
        });

        if (!response.ok) {
          console.warn("Failed to log activity:", await response.text());
        }
      } catch (error) {
        console.error("Error logging activity:", error);
      }
    },
    []
  );

  const trackPageView = useCallback(
    (panel: string) => {
      return logActivity("page_view", { panel });
    },
    [logActivity]
  );

  const trackUIAction = useCallback(
    (element: string, action: string = "click", details: any = {}) => {
      return logActivity("ui_action", { element, action, ...details });
    },
    [logActivity]
  );

  const trackInterviewStart = useCallback(
    (role: string, level: string) => {
      return logActivity("interview_started", { role, level });
    },
    [logActivity]
  );

  const trackInterviewScore = useCallback(
    (score: number, role: string) => {
      return logActivity("interview_scored", { overall: score, role });
    },
    [logActivity]
  );

  return {
    logActivity,
    trackPageView,
    trackUIAction,
    trackInterviewStart,
    trackInterviewScore,
  };
}
