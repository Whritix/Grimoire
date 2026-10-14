import type { LessonContent } from "@/lib/types"

export const mockLessonContent: LessonContent = {
  title: "Variables & Data Types in JavaScript",
  videoId: "dQw4w9WgXcQ",
  aiNotes: `## Key Concepts

### Variables
JavaScript has three ways to declare variables:
- **var**: Function-scoped, hoisted (legacy)
- **let**: Block-scoped, can be reassigned
- **const**: Block-scoped, cannot be reassigned

### Data Types
1. **Primitive Types**
   - String, Number, Boolean
   - null, undefined
   - Symbol, BigInt

2. **Reference Types**
   - Objects, Arrays
   - Functions

### Best Practices
- Prefer const by default
- Use let when reassignment is needed
- Avoid var in modern code
- Use meaningful variable names`,
  resources: [
    {
      url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Grammar_and_Types",
      title: "MDN: JavaScript Data Types",
      sourceType: "article",
    },
    { url: "https://javascript.info/variables", title: "JavaScript.info: Variables", sourceType: "article" },
    { url: "https://www.youtube.com/watch?v=example", title: "Advanced Variable Patterns", sourceType: "video" },
  ],
}
