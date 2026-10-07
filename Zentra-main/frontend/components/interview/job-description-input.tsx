"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Upload, FileText, Briefcase } from "lucide-react"

interface JobDescriptionInputProps {
    onSubmit: (role: string, description: string) => void
}

export function JobDescriptionInput({ onSubmit }: JobDescriptionInputProps) {
    const [role, setRole] = useState("")
    const [description, setDescription] = useState("")
    const [company, setCompany] = useState("")

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // In production, parse PDF/DOCX files
        // For now, just set a mock description
        const reader = new FileReader()
        reader.onload = (event) => {
            const text = event.target?.result as string
            setDescription(text || "Sample job description from uploaded file")
        }
        reader.readAsText(file)
    }

    const handleSubmit = () => {
        if (!role || !description) return
        onSubmit(role, description)
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-3xl mx-auto"
        >
            <div className="p-8 rounded-2xl bg-card border border-border">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
                        <Briefcase className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">Interview Setup</h2>
                        <p className="text-sm text-muted-foreground">
                            Tell us about the role you're preparing for
                        </p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <Label htmlFor="role">Target Role *</Label>
                        <Input
                            id="role"
                            placeholder="e.g., Senior Full Stack Developer"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="mt-2"
                        />
                    </div>

                    <div>
                        <Label htmlFor="company">Company (Optional)</Label>
                        <Input
                            id="company"
                            placeholder="e.g., Google, Microsoft, Startup"
                            value={company}
                            onChange={(e) => setCompany(e.target.value)}
                            className="mt-2"
                        />
                    </div>

                    <div>
                        <Label htmlFor="description">Job Description *</Label>
                        <Textarea
                            id="description"
                            placeholder="Paste the job description here or upload a file below..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={8}
                            className="mt-2"
                        />
                    </div>

                    <div className="flex items-center justify-center p-6 border-2 border-dashed border-border rounded-xl hover:border-primary/50 transition-colors">
                        <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                <Upload className="h-5 w-5 text-primary" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-medium">Upload Job Description</p>
                                <p className="text-xs text-muted-foreground">PDF, DOCX, or TXT</p>
                            </div>
                            <input
                                id="file-upload"
                                type="file"
                                accept=".pdf,.docx,.txt"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                        </label>
                    </div>

                    <Button
                        onClick={handleSubmit}
                        disabled={!role || !description}
                        size="lg"
                        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                        <FileText className="mr-2 h-4 w-4" />
                        Continue to Camera Setup
                    </Button>
                </div>
            </div>
        </motion.div >
    )
}
