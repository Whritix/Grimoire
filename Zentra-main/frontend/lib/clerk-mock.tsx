"use client"

import React, { createContext, useContext } from "react"

export interface MockUser {
  id: string
  fullName: string
  firstName: string
  lastName: string
  primaryEmailAddress?: { emailAddress: string }
  emailAddresses: Array<{ emailAddress: string }>
  imageUrl: string
  publicMetadata: Record<string, any>
  createdAt: string
}

const mockUser: MockUser = {
  id: "user_demo123",
  fullName: "Demo Learner",
  firstName: "Demo",
  lastName: "Learner",
  primaryEmailAddress: { emailAddress: "demo@zentra.app" },
  emailAddresses: [{ emailAddress: "demo@zentra.app" }],
  imageUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=zentra",
  publicMetadata: {},
  createdAt: new Date().toISOString(),
}

const MockAuthContext = createContext<{
  user: MockUser | null
  isSignedIn: boolean
  isLoaded: boolean
}>({
  user: mockUser,
  isSignedIn: true,
  isLoaded: true,
})

export function ClerkProvider({ children }: { children: React.ReactNode }) {
  return (
    <MockAuthContext.Provider
      value={{
        user: mockUser,
        isSignedIn: true,
        isLoaded: true,
      }}
    >
      {children}
    </MockAuthContext.Provider>
  )
}

export function useUser() {
  const ctx = useContext(MockAuthContext)
  return {
    isSignedIn: ctx.isSignedIn,
    isLoaded: ctx.isLoaded,
    user: ctx.user,
  }
}

export function useAuth() {
  const ctx = useContext(MockAuthContext)
  return {
    isSignedIn: ctx.isSignedIn,
    isLoaded: ctx.isLoaded,
    userId: ctx.user?.id || "user_demo123",
    sessionId: "sess_demo123",
    getToken: async () => "mock_token_demo",
    signOut: async () => {},
  }
}

export function SignedIn({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useUser()
  return isSignedIn ? <>{children}</> : null
}

export function SignedOut({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useUser()
  return !isSignedIn ? <>{children}</> : null
}

export function UserButton({ appearance }: any) {
  const { user } = useUser()
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-foreground cursor-pointer hover:bg-primary/20 transition-all">
      <img
        src={user?.imageUrl}
        alt="Avatar"
        className="w-6 h-6 rounded-full object-cover bg-primary/20"
      />
      <span className="font-semibold text-primary">{user?.firstName}</span>
    </div>
  )
}

export function SignIn(props: any) {
  return (
    <div className="max-w-md mx-auto my-12 p-8 text-center bg-card rounded-2xl border border-border shadow-lg">
      <h2 className="text-2xl font-bold mb-2">Local Demo Mode Active</h2>
      <p className="text-sm text-muted-foreground mb-6">
        You are automatically authenticated as <strong>Demo Learner</strong>.
      </p>
      <a
        href="/dashboard"
        className="inline-block w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-all"
      >
        Go to Dashboard
      </a>
    </div>
  )
}

export function SignUp(props: any) {
  return <SignIn {...props} />
}

export function SignInButton({ children, mode }: any) {
  return <a href="/dashboard">{children || <button>Sign In</button>}</a>
}

export function SignUpButton({ children, mode }: any) {
  return <a href="/dashboard">{children || <button>Sign Up</button>}</a>
}
