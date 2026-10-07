"use client"

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'

interface ChatMarkdownProps {
    content: string
    className?: string
}

// Code block with copy button (like ChatGPT)
function CodeBlock({ language, children }: { language: string, children: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        await navigator.clipboard.writeText(children)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="my-3 rounded-lg overflow-hidden border border-zinc-700">
            <div className="flex items-center justify-between bg-zinc-800 text-zinc-300 px-4 py-2 text-xs">
                <span className="font-mono">{language || 'code'}</span>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 hover:text-white transition-colors"
                >
                    {copied ? (
                        <>
                            <Check className="h-3.5 w-3.5" />
                            <span>Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy code</span>
                        </>
                    )}
                </button>
            </div>
            <SyntaxHighlighter
                language={language || 'text'}
                style={oneDark}
                customStyle={{
                    margin: 0,
                    padding: '1rem',
                    fontSize: '0.8rem',
                    borderRadius: 0,
                }}
                wrapLongLines
            >
                {children}
            </SyntaxHighlighter>
        </div>
    )
}

export function ChatMarkdown({ content, className = '' }: ChatMarkdownProps) {
    if (!content) return null

    return (
        <div className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    // Code blocks
                    code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '')
                        const language = match ? match[1] : ''
                        const codeString = String(children).replace(/\n$/, '')

                        if (!inline && (language || codeString.includes('\n'))) {
                            return <CodeBlock language={language}>{codeString}</CodeBlock>
                        }

                        // Inline code
                        return (
                            <code
                                className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-sm font-mono text-primary"
                                {...props}
                            >
                                {children}
                            </code>
                        )
                    },
                    // Headings
                    h1: ({ children }) => (
                        <h1 className="text-xl font-bold text-foreground mt-6 mb-3">{children}</h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-lg font-bold text-foreground mt-5 mb-2">{children}</h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-base font-semibold text-foreground mt-4 mb-2">{children}</h3>
                    ),
                    // Paragraphs
                    p: ({ children }) => (
                        <p className="text-muted-foreground leading-relaxed mb-3">{children}</p>
                    ),
                    // Lists
                    ul: ({ children }) => (
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground mb-3 ml-2">{children}</ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="list-decimal list-inside space-y-1 text-muted-foreground mb-3 ml-2">{children}</ol>
                    ),
                    li: ({ children }) => (
                        <li className="leading-relaxed">{children}</li>
                    ),
                    // Strong/Bold
                    strong: ({ children }) => (
                        <strong className="font-semibold text-foreground">{children}</strong>
                    ),
                    // Emphasis/Italic
                    em: ({ children }) => (
                        <em className="italic">{children}</em>
                    ),
                    // Links
                    a: ({ href, children }) => (
                        <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                        >
                            {children}
                        </a>
                    ),
                    // Blockquotes
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-primary/50 pl-4 py-1 my-3 text-muted-foreground italic">
                            {children}
                        </blockquote>
                    ),
                    // Tables
                    table: ({ children }) => (
                        <div className="overflow-x-auto my-3">
                            <table className="min-w-full border border-border rounded-lg overflow-hidden">
                                {children}
                            </table>
                        </div>
                    ),
                    thead: ({ children }) => (
                        <thead className="bg-muted">{children}</thead>
                    ),
                    th: ({ children }) => (
                        <th className="px-3 py-2 text-left text-sm font-semibold text-foreground border-b border-border">
                            {children}
                        </th>
                    ),
                    td: ({ children }) => (
                        <td className="px-3 py-2 text-sm text-muted-foreground border-b border-border">
                            {children}
                        </td>
                    ),
                    // Horizontal rule
                    hr: () => <hr className="my-4 border-border" />,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
}

export default ChatMarkdown
