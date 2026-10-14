"use client"

import { useRef } from "react"
import Editor from "@monaco-editor/react"
import { motion } from "framer-motion"
import { Play, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface CodePlaygroundProps {
    initialCode?: string
    language?: string
    onChange?: (code: string) => void
}

export function CodePlayground({
    initialCode = "",
    language = "javascript",
    onChange,
}: CodePlaygroundProps) {
    const editorRef = useRef<any>(null)

    function handleEditorDidMount(editor: any) {
        editorRef.current = editor
    }

    const handleRun = () => {
        const code = editorRef.current?.getValue()
        console.log("Running code:", code)
        // TODO: Execute code in sandbox
        alert("Code execution feature coming soon!")
    }

    const handleReset = () => {
        editorRef.current?.setValue(initialCode)
    }

    const handleEditorChange = (value: string | undefined) => {
        if (value && onChange) {
            onChange(value)
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full flex flex-col"
        >
            <Card className="flex-1 flex flex-col overflow-hidden">
                {/* Editor controls */}
                <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Code Editor</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{language}</span>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={handleReset}>
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Reset
                        </Button>
                        <Button size="sm" onClick={handleRun} className="bg-primary text-primary-foreground hover:bg-primary/90">
                            <Play className="h-4 w-4 mr-1" />
                            Run
                        </Button>
                    </div>
                </div>

                {/* Monaco Editor */}
                <div className="flex-1">
                    <Editor
                        height="100%"
                        defaultLanguage={language}
                        defaultValue={initialCode}
                        onMount={handleEditorDidMount}
                        onChange={handleEditorChange}
                        theme="vs-dark"
                        options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            lineNumbers: "on",
                            roundedSelection: true,
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            tabSize: 2,
                        }}
                    />
                </div>

                {/* Output panel */}
                <div className="h-32 border-t border-border p-4 bg-black/40 font-mono text-sm">
                    <div className="text-muted-foreground">Output will appear here...</div>
                </div>
            </Card>
        </motion.div>
    )
}
