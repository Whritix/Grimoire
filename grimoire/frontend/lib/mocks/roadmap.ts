import type { RoadmapModule } from "@/lib/types"

export const mockRoadmap: RoadmapModule[] = [
  {
    moduleId: "m1",
    title: "JavaScript Fundamentals",
    outcome: "Master core JavaScript concepts including ES6+ features, async programming, and the event loop.",
    lessons: [
      { id: "l1", title: "Variables & Data Types", type: "video", estMin: 15 },
      { id: "l2", title: "Functions & Closures", type: "video", estMin: 20 },
      { id: "l3", title: "Promises & Async/Await", type: "video", estMin: 25 },
      { id: "l4", title: "Module Quiz", type: "quiz", estMin: 10 },
    ],
  },
  {
    moduleId: "m2",
    title: "React Essentials",
    outcome: "Build interactive UIs with React, understand component lifecycle, and manage state effectively.",
    lessons: [
      { id: "l5", title: "Components & JSX", type: "video", estMin: 20 },
      { id: "l6", title: "Hooks Deep Dive", type: "video", estMin: 30 },
      { id: "l7", title: "State Management", type: "video", estMin: 25 },
      { id: "l8", title: "Performance Optimization", type: "article", estMin: 15 },
    ],
  },
  {
    moduleId: "m3",
    title: "Backend Development",
    outcome: "Create RESTful APIs, work with databases, and implement authentication.",
    lessons: [
      { id: "l9", title: "Node.js Basics", type: "video", estMin: 25 },
      { id: "l10", title: "Express.js Framework", type: "video", estMin: 20 },
      { id: "l11", title: "Database Integration", type: "video", estMin: 30 },
      { id: "l12", title: "Authentication & Security", type: "video", estMin: 25 },
    ],
  },
  {
    moduleId: "m4",
    title: "System Design",
    outcome: "Design scalable systems, understand distributed architectures, and make informed trade-offs.",
    lessons: [
      { id: "l13", title: "Scalability Concepts", type: "video", estMin: 30 },
      { id: "l14", title: "Database Design", type: "video", estMin: 25 },
      { id: "l15", title: "Caching Strategies", type: "article", estMin: 20 },
      { id: "l16", title: "System Design Interview", type: "quiz", estMin: 45 },
    ],
  },
]
