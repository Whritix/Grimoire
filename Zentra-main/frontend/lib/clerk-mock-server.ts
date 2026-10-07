import { NextResponse } from "next/server"

export function clerkMiddleware(handler?: any) {
  return async (req: any, evt: any) => {
    return NextResponse.next()
  }
}

export function createRouteMatcher(routes: any[]) {
  return (req: any) => true
}

export async function auth() {
  return {
    userId: "user_demo123",
    sessionId: "sess_demo123",
    getToken: async () => "mock_token_demo",
    claims: {},
    protect: () => {},
    redirectToSignIn: () => NextResponse.redirect(new URL("/dashboard", "http://localhost:3000")),
  }
}

export async function currentUser() {
  return {
    id: "user_demo123",
    fullName: "Demo Learner",
    firstName: "Demo",
    lastName: "Learner",
    primaryEmailAddress: { emailAddress: "demo@zentra.app" },
    imageUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=zentra",
  }
}
