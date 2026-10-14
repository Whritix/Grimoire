/**
 * Comprehensive mock data for all backend endpoints
 * Used when USE_MOCK=true to enable development without external services
 */

import type { RoadmapModule, Resource, Question, LessonContent } from '@/lib/types';
import type {
    PlannerResponse,
    RetrieverResponse,
    ComposerResponse,
    AssessmentGenerateResponse,
    AssessmentGradeResponse,
    DoubtAssistantResponse,
    RLControllerResponse,
    BadgeResponse,
} from './types';

// ============================================
// ROADMAP MOCK DATA
// ============================================

export function getMockRoadmap(goal?: string, score?: number): PlannerResponse {
    const goalLower = (goal || 'full-stack').toLowerCase();
    let difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate';

    if (score && score < 50) {
        difficulty = 'beginner';
    } else if (score && score > 75) {
        difficulty = 'advanced';
    }

    const roadmapsByGoal: Record<string, RoadmapModule[]> = {
        'full-stack': [
            {
                moduleId: 'm1',
                title: 'JavaScript Fundamentals',
                outcome: 'Master core JavaScript concepts including ES6+ features, async programming, and the event loop.',
                lessons: [
                    { id: 'l1', title: 'Variables & Data Types', type: 'video', estMin: 15 },
                    { id: 'l2', title: 'Functions & Closures', type: 'video', estMin: 20 },
                    { id: 'l3', title: 'Promises & Async/Await', type: 'video', estMin: 25 },
                    { id: 'l4', title: 'Module Quiz', type: 'quiz', estMin: 10 },
                ],
            },
            {
                moduleId: 'm2',
                title: 'React Essentials',
                outcome: 'Build interactive UIs with React, understand component lifecycle, and manage state effectively.',
                lessons: [
                    { id: 'l5', title: 'Components & JSX', type: 'video', estMin: 20 },
                    { id: 'l6', title: 'Hooks Deep Dive', type: 'video', estMin: 30 },
                    { id: 'l7', title: 'State Management', type: 'video', estMin: 25 },
                    { id: 'l8', title: 'Performance Optimization', type: 'article', estMin: 15 },
                ],
            },
            {
                moduleId: 'm3',
                title: 'Backend Development',
                outcome: 'Create RESTful APIs, work with databases, and implement authentication.',
                lessons: [
                    { id: 'l9', title: 'Node.js Basics', type: 'video', estMin: 25 },
                    { id: 'l10', title: 'Express.js Framework', type: 'video', estMin: 20 },
                    { id: 'l11', title: 'Database Integration', type: 'video', estMin: 30 },
                    { id: 'l12', title: 'Authentication & Security', type: 'video', estMin: 25 },
                ],
            },
        ],
        frontend: [
            {
                moduleId: 'm1',
                title: 'HTML & CSS Mastery',
                outcome: 'Create semantic, responsive layouts with modern CSS techniques.',
                lessons: [
                    { id: 'l1', title: 'Semantic HTML5', type: 'video', estMin: 20 },
                    { id: 'l2', title: 'Flexbox & Grid', type: 'video', estMin: 25 },
                    { id: 'l3', title: 'CSS Variables & Animations', type: 'video', estMin: 20 },
                ],
            },
            {
                moduleId: 'm2',
                title: 'Modern JavaScript',
                outcome: 'Write clean, modern JavaScript for interactive web applications.',
                lessons: [
                    { id: 'l4', title: 'ES6+ Features', type: 'video', estMin: 30 },
                    { id: 'l5', title: 'DOM Manipulation', type: 'video', estMin: 20 },
                    { id: 'l6', title: 'Async JavaScript', type: 'video', estMin: 25 },
                ],
            },
        ],
        backend: [
            {
                moduleId: 'm1',
                title: 'Server-Side Programming',
                outcome: 'Build scalable server applications with Node.js and Express.',
                lessons: [
                    { id: 'l1', title: 'Node.js Core Concepts', type: 'video', estMin: 25 },
                    { id: 'l2', title: 'RESTful API Design', type: 'video', estMin: 30 },
                    { id: 'l3', title: 'Middleware & Error Handling', type: 'video', estMin: 20 },
                ],
            },
            {
                moduleId: 'm2',
                title: 'Database Design',
                outcome: 'Design and implement efficient database schemas.',
                lessons: [
                    { id: 'l4', title: 'SQL Fundamentals', type: 'video', estMin: 30 },
                    { id: 'l5', title: 'MongoDB & NoSQL', type: 'video', estMin: 25 },
                    { id: 'l6', title: 'Query Optimization', type: 'video', estMin: 20 },
                ],
            },
        ],
    };

    // Select roadmap based on goal
    let roadmap = roadmapsByGoal['full-stack'];
    for (const key of Object.keys(roadmapsByGoal)) {
        if (goalLower.includes(key)) {
            roadmap = roadmapsByGoal[key];
            break;
        }
    }

    // Calculate estimated hours
    const estimatedHours = roadmap.reduce((total, module) => {
        const moduleMinutes = module.lessons.reduce((sum, lesson) => sum + lesson.estMin, 0);
        return total + moduleMinutes;
    }, 0) / 60;

    return {
        roadmap,
        metadata: {
            goal: goal || 'full-stack',
            estimatedHours: Math.ceil(estimatedHours),
            difficulty,
        },
    };
}

// ============================================
// RETRIEVER MOCK DATA
// ============================================

export function getMockResources(query: string, limit: number = 10): RetrieverResponse {
    const resources: Resource[] = [
        {
            url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
            title: `${query} - MDN Web Docs`,
            sourceType: 'documentation',
        },
        {
            url: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`,
            title: `Learn ${query} - Complete Tutorial`,
            sourceType: 'video',
        },
        {
            url: `https://dev.to/search?q=${encodeURIComponent(query)}`,
            title: `${query} Articles on Dev.to`,
            sourceType: 'article',
        },
        {
            url: 'https://github.com/topics/javascript',
            title: `${query} Open Source Projects`,
            sourceType: 'github',
        },
        {
            url: `https://stackoverflow.com/questions/tagged/${query.toLowerCase()}`,
            title: `${query} Questions on Stack Overflow`,
            sourceType: 'forum',
        },
    ];

    return {
        resources: resources.slice(0, limit),
        metadata: {
            totalFound: resources.length,
            query,
        },
    };
}

// ============================================
// COMPOSER MOCK DATA
// ============================================

export function getMockLessonContent(lessonTitle?: string): ComposerResponse {
    const title = lessonTitle || 'Introduction to React Hooks';

    const content = `# ${title}

## Overview
This lesson covers the fundamental concepts and practical applications of modern development techniques.

## Key Concepts

### 1. Understanding the Basics
The foundation of this topic relies on understanding how components interact and how state flows through your application.

### 2. Best Practices
- Always consider performance implications
- Follow the principle of separation of concerns
- Write clean, maintainable code
- Test your implementations thoroughly

### 3. Common Patterns
There are several patterns you'll encounter frequently in real-world applications:

\`\`\`javascript
function ExampleComponent() {
  const [state, setState] = useState(initialValue);
  
  useEffect(() => {
    // Side effect logic here
  }, [dependencies]);
  
  return <div>{state}</div>;
}
\`\`\`

## Practical Application
When implementing these concepts, consider the following workflow:
1. Plan your component structure
2. Implement core functionality
3. Add error handling
4. Optimize for performance
5. Write tests

## Summary
By understanding and applying these concepts, you'll be able to build robust, scalable applications. Remember to practice regularly and review core principles.
`;

    return {
        content,
        resources: [
            {
                url: 'https://react.dev/reference/react',
                title: 'React Official Documentation',
                sourceType: 'documentation',
            },
            {
                url: 'https://www.youtube.com/watch?v=reactHooks',
                title: 'React Hooks Explained',
                sourceType: 'video',
            },
        ],
        metadata: {
            wordCount: content.split(/\s+/).length,
            readTimeMinutes: Math.ceil(content.split(/\s+/).length / 200),
        },
    };
}

// ============================================
// ASSESSMENT MOCK DATA
// ============================================

export function getMockAssessmentQuestions(
    difficulty: 'easy' | 'medium' | 'hard' = 'medium',
    topic?: string,
    count: number = 5
): AssessmentGenerateResponse {
    const questions: Question[] = [
        {
            id: 'q1',
            text: 'What is the time complexity of searching in a balanced binary search tree?',
            choices: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'],
            category: 'Data Structures',
        },
        {
            id: 'q2',
            text: 'Which hook is used for managing side effects in React?',
            choices: ['useState', 'useEffect', 'useContext', 'useReducer'],
            category: 'React',
        },
        {
            id: 'q3',
            text: 'What does REST stand for?',
            choices: [
                'Representational State Transfer',
                'Remote Execution Service Technology',
                'Reliable Endpoint Service Type',
                'Request State Transformer',
            ],
            category: 'Web Development',
        },
        {
            id: 'q4',
            text: 'Which principle states that software entities should be open for extension but closed for modification?',
            choices: ['Single Responsibility', 'Open/Closed', 'Liskov Substitution', 'Interface Segregation'],
            category: 'Software Design',
        },
        {
            id: 'q5',
            text: 'What is the purpose of a foreign key in a relational database?',
            choices: [
                'To uniquely identify each row',
                'To establish relationships between tables',
                'To encrypt sensitive data',
                'To improve query performance',
            ],
            category: 'Databases',
        },
        {
            id: 'q6',
            text: 'Which HTTP method is idempotent?',
            choices: ['POST', 'PATCH', 'PUT', 'None of the above'],
            category: 'Web Development',
        },
        {
            id: 'q7',
            text: 'What is the main advantage of using TypeScript over JavaScript?',
            choices: ['Faster runtime', 'Static type checking', 'Smaller bundle size', 'Better browser support'],
            category: 'TypeScript',
        },
        {
            id: 'q8',
            text: 'Which sorting algorithm has the best average-case time complexity?',
            choices: ['Bubble Sort', 'Selection Sort', 'Merge Sort', 'Insertion Sort'],
            category: 'Algorithms',
        },
        {
            id: 'q9',
            text: 'What is the purpose of the virtual DOM in React?',
            choices: [
                'To store application state',
                'To minimize direct DOM manipulation',
                'To handle routing',
                'To manage API calls',
            ],
            category: 'React',
        },
        {
            id: 'q10',
            text: 'Which design pattern is used for creating a single instance of a class?',
            choices: ['Factory', 'Observer', 'Singleton', 'Decorator'],
            category: 'Design Patterns',
        },
        {
            id: 'q11',
            text: 'What is the purpose of an index in a database?',
            choices: [
                'To validate data integrity',
                'To speed up data retrieval',
                'To encrypt data at rest',
                'To compress storage',
            ],
            category: 'Databases',
        },
        {
            id: 'q12',
            text: 'Which React hook would you use for expensive calculations that should be memoized?',
            choices: ['useCallback', 'useMemo', 'useRef', 'useEffect'],
            category: 'React',
        },
        {
            id: 'q13',
            text: 'What is the main purpose of load balancing?',
            choices: [
                'To encrypt traffic',
                'To distribute traffic across servers',
                'To cache responses',
                'To validate requests',
            ],
            category: 'System Design',
        },
        {
            id: 'q14',
            text: 'Which git command is used to temporarily store uncommitted changes?',
            choices: ['git save', 'git stash', 'git store', 'git hold'],
            category: 'Version Control',
        },
        {
            id: 'q15',
            text: 'What is the purpose of CORS in web development?',
            choices: ['To compress resources', 'To cache responses', 'To control cross-origin requests', 'To encrypt data'],
            category: 'Web Security',
        },
        {
            id: 'q16',
            text: 'In React, what is the primary difference between useEffect and useLayoutEffect?',
            choices: [
                'useLayoutEffect runs synchronously after DOM mutations',
                'useEffect runs before DOM mutations',
                'useLayoutEffect cannot update state',
                'useEffect is only for server-side rendering',
            ],
            category: 'React',
        },
        {
            id: 'q17',
            text: 'What is the time complexity of looking up a key in a well-distributed Hash Table?',
            choices: ['O(log n)', 'O(1)', 'O(n)', 'O(n log n)'],
            category: 'Data Structures',
        },
        {
            id: 'q18',
            text: 'Which of the following is true about JavaScript event bubbling?',
            choices: [
                'Events travel from the target element upwards to ancestors',
                'Events travel from window downwards to target element',
                'Events only trigger on the element clicked',
                'Event bubbling only occurs for keyboard events',
            ],
            category: 'JavaScript',
        },
        {
            id: 'q19',
            text: "What does the SQL 'GROUP BY' clause do?",
            choices: [
                'Groups rows with the same values into summary rows',
                'Sorts the final output rows alphabetically',
                'Filters out NULL rows before execution',
                'Joins two unrelated database tables',
            ],
            category: 'Databases',
        },
        {
            id: 'q20',
            text: 'What is a pure function in functional programming?',
            choices: [
                'A function that always returns the same output for same inputs and has no side effects',
                'A function that has no return value',
                'A function that modifies global variables directly',
                'A function written entirely in TypeScript',
            ],
            category: 'Software Design',
        },
        {
            id: 'q21',
            text: 'What is the primary function of a reverse proxy like Nginx?',
            choices: [
                'Distribute incoming requests, handle SSL termination, and protect backend servers',
                'Store relational database tables',
                'Compile client-side TypeScript code',
                'Manage browser local storage',
            ],
            category: 'System Design',
        },
        {
            id: 'q22',
            text: "In CSS, what does 'box-sizing: border-box' mean?",
            choices: [
                'Width and height include padding and border',
                'Width and height exclude padding and border',
                'Borders are automatically rounded',
                'Margins are included in element dimensions',
            ],
            category: 'Web Development',
        },
        {
            id: 'q23',
            text: 'What does ACID stand for in database management systems?',
            choices: [
                'Atomicity, Consistency, Isolation, Durability',
                'Accuracy, Cohesion, Inheritance, Delivery',
                'Access, Control, Identification, Data',
                'Action, Cascade, Isolation, Distribution',
            ],
            category: 'Databases',
        },
        {
            id: 'q24',
            text: "What is the purpose of the 'git rebase' command?",
            choices: [
                'Move or combine a sequence of commits to a new base commit',
                'Delete a branch from remote repository',
                'Revert uncommitted local changes',
                'Download files from GitHub repository',
            ],
            category: 'Version Control',
        },
        {
            id: 'q25',
            text: 'Which of the following headers protects against Cross-Site Scripting (XSS)?',
            choices: [
                'Content-Security-Policy',
                'Access-Control-Allow-Origin',
                'Cache-Control',
                'Accept-Encoding',
            ],
            category: 'Web Security',
        },
    ];

    const finalCount = count > 0 ? count : 5;
    const sliced = questions.slice(0, Math.min(finalCount, questions.length));

    return {
        questions: sliced,
        metadata: {
            difficulty,
            topic: topic || 'General Programming',
            timeLimit: Math.max(10, sliced.length * 2),
        },
    };
}

export function getMockAssessmentGrade(
    answers: Array<{ qId: string; choice: string }>
): AssessmentGradeResponse {
    // Simulate grading - random score between 60-95
    const score = Math.floor(Math.random() * 35) + 60;

    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (score >= 80) {
        strengths.push('Strong understanding of core concepts');
        strengths.push('Good problem-solving skills');
        weaknesses.push('Could improve on advanced topics');
    } else if (score >= 70) {
        strengths.push('Solid foundation in fundamentals');
        weaknesses.push('Need more practice with complex scenarios');
        weaknesses.push('Consider reviewing advanced patterns');
    } else {
        strengths.push('Shows potential in basic concepts');
        weaknesses.push('Requires more practice with fundamentals');
        weaknesses.push('Recommend additional study materials');
    }

    const feedback = score >= 80
        ? 'Excellent work! You demonstrate strong knowledge in this area.'
        : score >= 70
            ? 'Good effort! Continue practicing to solidify your understanding.'
            : 'Keep studying! Focus on the fundamentals before moving to advanced topics.';

    return {
        score,
        strengths,
        weaknesses,
        feedback,
        suggestedGoal: score >= 80 ? 'advanced' : score >= 70 ? 'intermediate' : 'beginner',
    };
}

// ============================================
// DOUBT ASSISTANT MOCK DATA
// ============================================

export function getMockDoubtResponse(query: string): DoubtAssistantResponse {
    const responses = [
        {
            reply: 'Great question! This concept works by breaking down the problem into smaller, manageable parts. Each component handles a specific responsibility, which makes the code more maintainable and easier to test. Think of it as a modular system where each piece can be developed and updated independently.',
            sources: [
                {
                    url: 'https://developer.mozilla.org/en-US/docs/Web',
                    title: 'MDN Web Docs - Comprehensive Guide',
                    sourceType: 'documentation',
                },
                {
                    url: 'https://react.dev/learn',
                    title: 'React Official Documentation',
                    sourceType: 'documentation',
                },
            ],
        },
        {
            reply: 'Let me explain this step by step. First, you need to understand the underlying principles. The key is to ensure that your implementation follows best practices and considers edge cases. Start with the simplest solution and optimize as needed.',
            sources: [
                {
                    url: 'https://stackoverflow.com/questions/popular',
                    title: 'Stack Overflow - Related Discussions',
                    sourceType: 'forum',
                },
            ],
        },
    ];

    return responses[Math.floor(Math.random() * responses.length)];
}

// ============================================
// RL CONTROLLER MOCK DATA
// ============================================

export function getMockRLSuggestion(performanceMetrics: {
    recentScores: number[];
    timeSpent: number;
    attemptsCount: number;
}): RLControllerResponse {
    const avgScore = performanceMetrics.recentScores.reduce((a, b) => a + b, 0) / performanceMetrics.recentScores.length;

    let difficulty: 'easy' | 'medium' | 'hard';
    let nextActions: string[];

    if (avgScore >= 85) {
        difficulty = 'hard';
        nextActions = [
            'Challenge yourself with advanced topics',
            'Try implementing a complex project',
            'Explore system design patterns',
        ];
    } else if (avgScore >= 65) {
        difficulty = 'medium';
        nextActions = [
            'Continue with current difficulty level',
            'Review challenging concepts',
            'Practice with real-world scenarios',
        ];
    } else {
        difficulty = 'easy';
        nextActions = [
            'Focus on fundamentals',
            'Review basic concepts',
            'Take your time with each lesson',
            'Try the easier practice problems first',
        ];
    }

    return {
        difficulty,
        nextActions,
        reasoning: `Based on your average score of ${avgScore.toFixed(1)}%, ${difficulty} difficulty is recommended.`,
    };
}

// ============================================
// BADGE MOCK DATA
// ============================================

export const mockBadges = [
    {
        id: 'badge_first_lesson',
        achievement: 'First Lesson Completed',
        description: 'Completed your first lesson',
        iconUrl: '/badges/first-lesson.svg',
    },
    {
        id: 'badge_module_complete',
        achievement: 'Module Master',
        description: 'Completed an entire module',
        iconUrl: '/badges/module-complete.svg',
    },
    {
        id: 'badge_perfect_score',
        achievement: 'Perfect Score',
        description: 'Achieved 100% on an assessment',
        iconUrl: '/badges/perfect-score.svg',
    },
];
