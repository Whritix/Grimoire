"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Check, Shield, Server, Box, Users, Code, Activity } from "lucide-react"
import { cn } from "@/lib/utils"

interface AgentSelectorProps {
  selectedAgents: string[]
  onSelectionChange: (agents: string[]) => void
}

const AGENTS = [
  {
    id: "Security Expert",
    name: "Security Expert",
    icon: Shield,
    color: "text-red-500",
    bg: "bg-red-500/10",
    desc: "Vulnerabilities & Auth"
  },
  {
    id: "System Architect",
    name: "System Architect",
    icon: Server,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    desc: "Scale & Design"
  },
  {
    id: "DevOps Engineer",
    name: "DevOps Engineer",
    icon: Box,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    desc: "Deploy & Infra"
  },
  {
    id: "Product Manager",
    name: "Product Manager",
    icon: Users,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    desc: "UX & Strategy"
  },
  {
    id: "Senior Developer",
    name: "Senior Developer",
    icon: Code,
    color: "text-green-500",
    bg: "bg-green-500/10",
    desc: "Clean Code & Impl"
  }
]

export function AgentSelector({ selectedAgents, onSelectionChange }: AgentSelectorProps) {
  
  const toggleAgent = (agentId: string) => {
    if (selectedAgents.includes(agentId)) {
      onSelectionChange(selectedAgents.filter(id => id !== agentId))
    } else {
      if (selectedAgents.length >= 3) return // Max 3 for performance? Or let them pick all. Let's limit to 3 for now to guide user.
      onSelectionChange([...selectedAgents, agentId])
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-foreground">Study Group (Max 3)</span>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {AGENTS.map((agent) => {
          const isSelected = selectedAgents.includes(agent.id)
          const Icon = agent.icon
          
          return (
            <motion.button
              key={agent.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => toggleAgent(agent.id)}
              className={cn(
                "relative flex items-center p-3 rounded-xl border text-left transition-all",
                isSelected 
                  ? "border-primary/50 bg-primary/5 shadow-sm" 
                  : "border-border/40 bg-card hover:bg-accent/50 hover:border-primary/20"
              )}
            >
              <div className={cn("p-2 rounded-lg mr-3", agent.bg)}>
                <Icon className={cn("w-4 h-4", agent.color)} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium leading-none mb-1">{agent.name}</div>
                <div className="text-xs text-muted-foreground truncate">{agent.desc}</div>
              </div>

              {isSelected && (
                <div className="absolute top-2 right-2">
                  <div className="bg-primary text-primary-foreground rounded-full p-0.5">
                    <Check className="w-3 h-3" />
                  </div>
                </div>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
