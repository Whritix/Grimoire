"use client"

import * as React from "react"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Upload, FileText, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface NotesInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  placeholder?: string
}

export function NotesInput({ value, onChange, disabled, className, placeholder }: NotesInputProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [fileName, setFileName] = React.useState<string | null>(null)

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('/api/extract-pdf', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Failed to extract PDF text')
    }

    const data = await response.json()
    return data.text.trim()
  }

  const extractTextFromDOCX = async (file: File): Promise<string> => {
    // Dynamically import mammoth
    const mammoth = await import('mammoth')
    
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    
    return result.value.trim()
  }

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true)
    setFileName(file.name)
    
    try {
      let text = ''
      
      if (file.type === "text/plain" || file.name.endsWith(".md") || file.name.endsWith(".txt")) {
        // Plain text files
        text = await file.text()
      } else if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        // PDF files
        text = await extractTextFromPDF(file)
      } else if (
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.name.endsWith(".docx")
      ) {
        // DOCX files
        text = await extractTextFromDOCX(file)
      } else {
        alert("Unsupported file format. Please upload .txt, .md, .pdf, or .docx files.")
        setFileName(null)
        return
      }
      
      onChange(text)
    } catch (error) {
      console.error("Error processing file:", error)
      alert("Failed to process file. Please try a different file or paste your notes manually.")
      setFileName(null)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleClear = () => {
    onChange("")
    setFileName(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const charCount = value.length
  const minChars = 50
  const isValid = charCount >= minChars

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor="notes-input" className="text-base font-medium">
            Your Notes
          </Label>
          {fileName && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
              {fileName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.pdf,.docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileUpload(file)
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isProcessing}
            className="gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload File
              </>
            )}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={disabled || isProcessing}
              className="gap-2 text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </div>

      <div
        className={cn(
          "relative rounded-xl border-2 border-dashed transition-all",
          isDragging ? "border-primary bg-primary/5" : "border-border",
          (disabled || isProcessing) && "opacity-50 cursor-not-allowed"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Textarea
          id="notes-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || isProcessing}
          placeholder={placeholder || "Paste your notes here, or drag and drop a file to start analyzing..."}
          className="h-[600px] field-sizing-fixed overflow-y-auto resize-none border-0 focus-visible:ring-0 bg-transparent text-base leading-relaxed"
        />

        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/10 rounded-xl">
            <div className="flex flex-col items-center gap-2 text-primary">
              <FileText className="h-10 w-10" />
              <span className="font-medium">Drop your file here</span>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-xl">
            <div className="flex flex-col items-center gap-3 text-primary">
              <Loader2 className="h-10 w-10 animate-spin" />
              <span className="font-medium">Extracting text from file...</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className={cn(
          "transition-colors",
          isValid ? "text-muted-foreground" : "text-orange-500"
        )}>
          {charCount} characters {!isValid && `(minimum ${minChars})`}
        </span>
        <span className="text-muted-foreground">
          Supports .txt, .md, .pdf, .docx
        </span>
      </div>
    </div>
  )
}

