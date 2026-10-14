"use client"

import { motion } from "framer-motion"
import { ExternalLink, FileText, Video, LinkIcon } from "lucide-react"

interface Resource {
  url: string
  title: string
  sourceType: string
}

// Accept className to layout easier
interface ResourceListProps {
  resources: Resource[]
  className?: string
}

const iconMap: Record<string, typeof FileText> = {
  article: FileText,
  video: Video,
  link: LinkIcon,
}

export function ResourceList({ resources, className = "" }: ResourceListProps) {
  // If no resources, show a nice empty state or return null?
  // We'll show a comprehensive empty state to balance the UI
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className={`h-full flex flex-col ${className}`}
    >
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        Additional Resources
        <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {resources.length}
        </span>
      </h3>

      {resources.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-white/10 rounded-xl bg-white/5">
              <div className="p-3 rounded-full bg-muted/50 mb-3">
                  <LinkIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No additional resources available for this lesson.</p>
          </div>
      ) : (
          <div className="space-y-3">
            {resources.map((resource, index) => {
              const Icon = iconMap[resource.sourceType] || LinkIcon
              const displayTitle = resource.title || resource.url.substring(0, 50) + "..."
              return (
                <motion.a
                  key={resource.url}
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card/50 hover:bg-primary/5 border border-white/5 hover:border-primary/20 transition-all group"
                >
                  <div className="p-2 rounded-lg bg-background group-hover:bg-white transition-colors shadow-sm">
                    <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <span className="flex-1 text-sm text-foreground line-clamp-1">{displayTitle}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.a>
              )
            })}
          </div>
      )}
    </motion.div>
  )
}
