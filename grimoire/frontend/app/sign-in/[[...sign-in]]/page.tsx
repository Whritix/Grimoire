"use client"

import { SignIn } from "@clerk/nextjs"
import { motion } from "framer-motion"

export default function SignInPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md p-8"
            >
                {/* Branding */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold font-display mb-3 text-primary">
                        GRIMOIRE
                    </h1>
                    <p className="text-muted-foreground">
                        Sign in to continue your learning journey
                    </p>
                </div>

                {/* Clerk Sign In Component */}
                <div className="flex justify-center">
                    <SignIn
                        appearance={{
                            elements: {
                                rootBox: "w-full",
                                card: "shadow-2xl",
                            },
                        }}
                    />
                </div>
            </motion.div>
        </div>
    )
}
