"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Loader2, GitBranch, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface MindmapNode {
  id: string
  type: string
  data: { label: string; description?: string }
}

interface MindmapEdge {
  id: string
  source: string
  target: string
}

interface TreeNode {
  id: string
  label: string
  type: string
  x: number
  y: number
  children: TreeNode[]
  expanded: boolean
  depth: number
  description?: string
}

interface MindmapVisualizationProps {
  nodes: MindmapNode[]
  edges: MindmapEdge[]
  centerTopic: string
  isLoading?: boolean
  className?: string
}

// Build tree structure from flat nodes/edges
function buildTree(
  nodes: MindmapNode[],
  edges: MindmapEdge[]
): TreeNode | null {
  const nodeMap: Record<string, MindmapNode> = {}
  const childrenMap: Record<string, string[]> = {}
  const hasParent = new Set<string>()

  nodes.forEach((n) => (nodeMap[n.id] = n))
  edges.forEach((e) => {
    if (!childrenMap[e.source]) childrenMap[e.source] = []
    childrenMap[e.source].push(e.target)
    hasParent.add(e.target)
  })

  // Find root (center node or node without parent)
  const centerNode = nodes.find((n) => n.type === "center")
  const rootId = centerNode?.id || nodes.find((n) => !hasParent.has(n.id))?.id
  if (!rootId || !nodeMap[rootId]) return null

  function buildNode(id: string, depth: number): TreeNode {
    const node = nodeMap[id]
    if (!node) {
      return {
        id,
        label: "Unknown",
        type: "leaf",
        x: 0,
        y: 0,
        children: [],
        expanded: false,
        depth,
      }
    }
    const children = (childrenMap[id] || []).map((childId) => buildNode(childId, depth + 1))
    return {
      id,
      label: node.data.label,
      description: node.data.description,
      type: node.type,
      x: 0,
      y: 0,
      children,
      expanded: false, // Start collapsed
      depth,
    }
  }

  const root = buildNode(rootId, 0)
  root.expanded = true // Only root is expanded initially
  return root
}

// Layout constants
const NODE_WIDTH = 150
const NODE_HEIGHT = 32
const H_GAP = 50
const V_GAP = 6

// Calculate visible height
function calcVisibleHeight(node: TreeNode): number {
  if (!node.expanded || node.children.length === 0) {
    return NODE_HEIGHT
  }
  const childrenHeight = node.children.reduce(
    (sum, child) => sum + calcVisibleHeight(child) + V_GAP, 
    -V_GAP
  )
  return Math.max(NODE_HEIGHT, childrenHeight)
}

// Count total visible nodes
function countVisibleNodes(node: TreeNode): number {
  if (!node.expanded) return 1
  return 1 + node.children.reduce((sum, child) => sum + countVisibleNodes(child), 0)
}

// Count total nodes
function countTotalNodes(node: TreeNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countTotalNodes(child), 0)
}

// Get max depth of visible tree
function getMaxDepth(node: TreeNode): number {
  if (!node.expanded || node.children.length === 0) return node.depth
  return Math.max(...node.children.map(getMaxDepth))
}

// Get total max depth
function getTotalMaxDepth(node: TreeNode): number {
  if (node.children.length === 0) return node.depth
  return Math.max(...node.children.map(getTotalMaxDepth))
}

// Position nodes left-to-right
function layoutLeftToRight(root: TreeNode): { width: number; height: number } {
  const startX = 40
  const startY = 40

  function positionNode(node: TreeNode, x: number, y: number): number {
    node.x = x
    node.y = y

    if (!node.expanded || node.children.length === 0) {
      return NODE_HEIGHT
    }

    const childX = x + NODE_WIDTH + H_GAP
    let currentY = y

    node.children.forEach((child) => {
      positionNode(child, childX, currentY)
      const childHeight = calcVisibleHeight(child)
      currentY += childHeight + V_GAP
    })

    return calcVisibleHeight(node)
  }

  positionNode(root, startX, startY)
  
  let maxX = startX
  let maxY = startY
  
  function findBounds(node: TreeNode) {
    maxX = Math.max(maxX, node.x + NODE_WIDTH)
    maxY = Math.max(maxY, node.y + NODE_HEIGHT)
    if (node.expanded) {
      node.children.forEach(findBounds)
    }
  }
  
  findBounds(root)
  
  return { width: maxX + 300, height: maxY + 150 }
}

// Curved path
function getCurvePath(parentX: number, parentY: number, childX: number, childY: number): string {
  const startX = parentX + NODE_WIDTH
  const startY = parentY + NODE_HEIGHT / 2
  const endX = childX
  const endY = childY + NODE_HEIGHT / 2
  const controlPointOffset = (endX - startX) * 0.5
  return `M ${startX} ${startY} C ${startX + controlPointOffset} ${startY}, ${endX - controlPointOffset} ${endY}, ${endX} ${endY}`
}

// Depth-based colors
function getNodeColors(depth: number, isCenter: boolean) {
  if (isCenter) {
    return { bg: "bg-[#FF6B35]", border: "border-[#FF6B35]", text: "text-white", hoverBg: "hover:bg-[#e55a2b]" }
  }
  const colors = [
    { bg: "bg-white", border: "border-[#FFB088]", text: "text-gray-800", hoverBg: "hover:bg-orange-50" },
    { bg: "bg-orange-50", border: "border-orange-200", text: "text-gray-700", hoverBg: "hover:bg-orange-100" },
    { bg: "bg-amber-50", border: "border-amber-200", text: "text-gray-700", hoverBg: "hover:bg-amber-100" },
    { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-gray-600", hoverBg: "hover:bg-yellow-100" },
    { bg: "bg-lime-50", border: "border-lime-200", text: "text-gray-600", hoverBg: "hover:bg-lime-100" },
    { bg: "bg-green-50", border: "border-green-200", text: "text-gray-600", hoverBg: "hover:bg-green-100" },
    { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-500", hoverBg: "hover:bg-gray-100" },
  ]
  return colors[Math.min(depth - 1, colors.length - 1)]
}

// Node component with hover expand and tooltip for final leaves
// Node component
function NodeComponent({ 
  node, 
  onToggle,
  onHover 
}: { 
  node: TreeNode; 
  onToggle: (id: string) => void;
  onHover: (node: TreeNode | null) => void;
}) {
  const [isHovered, setIsHovered] = React.useState(false)
  const hasChildren = node.children.length > 0
  const isCenter = node.type === "center"
  const isFinalLeaf = !hasChildren && node.depth > 1
  const colors = getNodeColors(node.depth, isCenter)

  // Notify parent on hover
  React.useEffect(() => {
    if (isHovered && isFinalLeaf) {
      const timer = setTimeout(() => onHover(node), 600)
      return () => clearTimeout(timer)
    } else {
      onHover(null)
    }
  }, [isHovered, isFinalLeaf, node, onHover])

  return (
    <g>
      <foreignObject
        x={node.x}
        y={node.y}
        width={isHovered ? Math.max(NODE_WIDTH, node.label.length * 6 + 40) : NODE_WIDTH}
        height={NODE_HEIGHT + 20}
        style={{ overflow: "visible", zIndex: isHovered ? 50 : 1 }}
      >
        <motion.div
          initial={{ opacity: 0, x: -5 }}
          animate={{ opacity: 1, x: 0, width: isHovered ? "auto" : NODE_WIDTH }}
          transition={{ duration: 0.1 }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => hasChildren && onToggle(node.id)}
          className={cn(
            "flex items-center justify-between gap-1 h-8 px-2.5 rounded-md transition-all duration-150 select-none",
            "border shadow-sm whitespace-nowrap",
            hasChildren && "cursor-pointer hover:shadow-md",
            colors.bg, colors.border, colors.text, colors.hoverBg,
            isHovered && "shadow-md ring-1 ring-orange-200"
          )}
          style={{ minWidth: NODE_WIDTH, maxWidth: isHovered ? "none" : NODE_WIDTH }}
        >
          <span className={cn("text-xs leading-tight font-medium", isHovered ? "" : "truncate")}>{node.label}</span>
          {hasChildren && (
            <motion.span 
              className={cn("shrink-0 ml-1", isCenter ? "text-white/80" : "text-gray-400")}
              animate={{ rotate: node.expanded ? 90 : 0 }}
              transition={{ duration: 0.15 }}
            >
              <ChevronRight className="h-3 w-3" />
            </motion.span>
          )}
        </motion.div>
      </foreignObject>
    </g>
  )
}

// Render edges
function renderEdges(node: TreeNode): React.ReactNode[] {
  const edges: React.ReactNode[] = []
  if (!node.expanded) return edges
  node.children.forEach((child) => {
    edges.push(
      <motion.path
        key={`edge-${node.id}-${child.id}`}
        d={getCurvePath(node.x, node.y, child.x, child.y)}
        fill="none"
        stroke="#FFB088"
        strokeWidth={1.5}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.7 }}
        transition={{ duration: 0.25 }}
      />
    )
    edges.push(...renderEdges(child))
  })
  return edges
}

// Render nodes
function renderNodes(
  node: TreeNode, 
  onToggle: (id: string) => void,
  onHover: (node: TreeNode | null) => void
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [
    <NodeComponent key={node.id} node={node} onToggle={onToggle} onHover={onHover} />
  ]
  if (node.expanded) {
    node.children.forEach((child) => nodes.push(...renderNodes(child, onToggle, onHover)))
  }
  return nodes
}

export function MindmapVisualization({
  nodes: rawNodes,
  edges: rawEdges,
  centerTopic,
  isLoading,
  className,
}: MindmapVisualizationProps) {
  const [tree, setTree] = React.useState<TreeNode | null>(null)
  const [dimensions, setDimensions] = React.useState({ width: 1200, height: 600 })
  const [zoom, setZoom] = React.useState(1)
  const [hoveredNode, setHoveredNode] = React.useState<TreeNode | null>(null)
  const svgRef = React.useRef<SVGSVGElement>(null)

  // Build tree when data changes
  React.useEffect(() => {
    if (rawNodes.length === 0) {
      setTree(null)
      return
    }
    const rootTree = buildTree(rawNodes, rawEdges)
    if (rootTree) {
      const dims = layoutLeftToRight(rootTree)
      setDimensions(dims)
      setTree({ ...rootTree })
    }
  }, [rawNodes, rawEdges])

  // Toggle single node
  const handleToggle = React.useCallback((id: string) => {
    if (!tree) return
    function toggle(node: TreeNode): TreeNode {
      if (node.id === id) return { ...node, expanded: !node.expanded }
      return { ...node, children: node.children.map(toggle) }
    }
    const newTree = toggle(tree)
    const dims = layoutLeftToRight(newTree)
    setDimensions(dims)
    setTree({ ...newTree })
  }, [tree])

  // Collapse all nodes except root
  const handleCollapseAll = React.useCallback(() => {
    if (!tree) return
    function collapse(node: TreeNode, isRoot: boolean): TreeNode {
      return {
        ...node,
        expanded: isRoot, // Only root stays expanded
        children: node.children.map((c) => collapse(c, false))
      }
    }
    const newTree = collapse(tree, true)
    const dims = layoutLeftToRight(newTree)
    setDimensions(dims)
    setTree({ ...newTree })
  }, [tree])

  // Expand all nodes
  const handleExpandAll = React.useCallback(() => {
    if (!tree) return
    function expand(node: TreeNode): TreeNode {
      return { ...node, expanded: true, children: node.children.map(expand) }
    }
    const newTree = expand(tree)
    const dims = layoutLeftToRight(newTree)
    setDimensions(dims)
    setTree({ ...newTree })
  }, [tree])

  // Handle hover
  const handleNodeHover = React.useCallback((node: TreeNode | null) => {
    setHoveredNode(node)
  }, [])

  if (isLoading) {
    return (
      <div className={cn("w-full h-[600px] bg-linear-to-br from-orange-50 to-amber-50 rounded-xl flex items-center justify-center border border-orange-100", className)}>
        <div className="flex flex-col items-center gap-4 text-orange-600">
          <Loader2 className="h-10 w-10 animate-spin" />
          <span className="font-medium">Generating mindmap...</span>
        </div>
      </div>
    )
  }

  if (!tree) {
    return (
      <div className={cn("w-full h-[600px] bg-linear-to-br from-gray-50 to-slate-50 rounded-xl flex items-center justify-center border border-gray-200", className)}>
        <div className="flex flex-col items-center gap-4 text-gray-400">
          <GitBranch className="h-10 w-10" />
          <span className="font-medium">No mindmap generated yet</span>
          <span className="text-sm">Click "Generate Mindmap" to visualize your content</span>
        </div>
      </div>
    )
  }

  const visibleNodes = countVisibleNodes(tree)
  const totalNodes = countTotalNodes(tree)
  const maxDepth = getTotalMaxDepth(tree) + 1

  return (
    <div className={cn("relative w-full h-[600px] bg-white rounded-xl border border-gray-200 overflow-hidden", className)}>


      {/* Controls - Top Right */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleExpandAll} className="bg-white shadow-sm h-7 text-xs px-3">
          Expand All
        </Button>
        <Button variant="outline" size="sm" onClick={handleCollapseAll} className="bg-white shadow-sm h-7 text-xs px-3">
          Collapse All
        </Button>
        <div className="bg-white/90 backdrop-blur-sm rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-500">
          {visibleNodes}/{totalNodes} nodes • {maxDepth} levels
        </div>
      </div>

      {/* SVG */}
      <div className="w-full h-full overflow-auto">
        <div 
          style={{ 
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            width: dimensions.width,
            height: dimensions.height,
          }}
        >
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          >
            <defs>
              <pattern id="mindmap-dots" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="0.8" fill="#e5e7eb" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#mindmap-dots)" />
            <g className="edges">{renderEdges(tree)}</g>
            <g className="nodes">{renderNodes(tree, handleToggle, handleNodeHover)}</g>
            
            {/* Overlay Layer for Tooltips */}
            <g className="overlay" style={{ pointerEvents: 'none' }}>
              <AnimatePresence>
                {hoveredNode && (
                  <foreignObject
                    key="tooltip"
                    x={hoveredNode.x + NODE_WIDTH / 2 - 120} // Center horizontally relative to node
                    y={hoveredNode.y - 95} // Position above node
                    width={240}
                    height={100}
                    style={{ overflow: 'visible', zIndex: 100 }}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 5, scale: 0.95 }}
                      className={cn(
                        "bg-slate-800 text-white p-3 rounded-lg shadow-xl border border-slate-700 w-full",
                        "flex flex-col gap-1 relative pointer-events-auto"
                      )}
                    >
                       <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-800 rotate-45 border-b border-r border-slate-700" />
                       <div className="text-xs font-semibold text-slate-100 flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                         <span className="truncate">{hoveredNode.label}</span>
                       </div>
                       <div className="text-[11px] text-slate-300 leading-relaxed line-clamp-3">
                         {hoveredNode.description || `Key concept in ${hoveredNode.depth === 1 ? 'Main Topic' : 'this branch'}. Connects to parent structure.`}
                       </div>
                    </motion.div>
                  </foreignObject>
                )}
              </AnimatePresence>
            </g>
          </svg>
        </div>
      </div>
    </div>
  )
}
