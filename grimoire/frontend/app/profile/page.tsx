"use client"

import { redirect } from "next/navigation"

export default function ProfilePage() {
    // Profile content has been merged into Dashboard
    redirect("/dashboard")
}
