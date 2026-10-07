"""
Deterministic Prerequisite Rules for Roadmap Generation.
This file contains hardcoded dependency logic to ensure strict progression for specific fields.
"""

from typing import List, Dict, Any, Optional

# Constants for topics
AI_ENGINEER = "ai engineer"
DATA_SCIENTIST = "data scientist"
FULL_STACK = "full stack"

# Data Structure for a Prerequisite Question
# {
#     "id": "python_check",
#     "text": "Do you have working knowledge of Python?",
#     "level": "functional", # vs "conceptual"
#     "options": [
#         {"id": "yes", "text": "Yes, I am comfortable"},
#         {"id": "no", "text": "No, I am new to Python"}
#     ],
#     "topics_if_no": ["Python Programming", "Pandas", "NumPy"],
#     "blocks_next": True # If true, and answer is No, stop asking deeper questions
# }

PREREQUISITE_RULES: Dict[str, List[Dict[str, Any]]] = {
    AI_ENGINEER: [
        {
            "id": "python_proficiency",
            "text": "Are you comfortable programming in Python?",
            "options": [
                {"id": "yes", "text": "Yes, I have built projects"},
                {"id": "basic", "text": "I know the basics"},
                {"id": "no", "text": "No, I need to learn it"}
            ],
            "topics_if_no": ["Python Programming"],
            "blocks_next_if": ["no"], # If answer is 'no', skip subsequent questions
            "tag": "foundational"
        },
        {
            "id": "math_foundations",
            "text": "Are you familiar with Linear Algebra and Calculus basics?",
            "options": [
                {"id": "yes", "text": "Yes, I understand the math"},
                {"id": "no", "text": "No, need a refresher"},
            ],
            "topics_if_no": ["Mathematics for Machine Learning"],
            "blocks_next_if": ["no"],
            "tag": "foundational"
        },
        {
            "id": "ml_experience",
            "text": "Have you built and trained a Machine Learning model before?",
            "options": [
                {"id": "yes", "text": "Yes, using Scikit-Learn or similar"},
                {"id": "no", "text": "No, I am new to ML"}
            ],
            "topics_if_no": ["Machine Learning Foundations"],
            "blocks_next_if": ["no"],
            "tag": "core"
        },
        {
            "id": "dl_experience",
            "text": "Have you worked with Neural Networks (PyTorch/TensorFlow)?",
            "options": [
                {"id": "yes", "text": "Yes, I have built distinct networks"},
                {"id": "no", "text": "No, I want to learn Deep Learning"}
            ],
            "topics_if_no": ["Deep Learning"],
            "blocks_next_if": ["no"],
            "tag": "advanced"
        },
        {
            "id": "llm_familiarity",
            "text": "Have you built applications using LLMs or Transformers?",
            "options": [
                {"id": "yes", "text": "Yes, I have used OpenAI API / HuggingFace"},
                {"id": "no", "text": "No, this is my goal"}
            ],
            "topics_if_no": ["Large Language Models"],
            "blocks_next_if": [],
            "tag": "specialization"
        }
    ],
    FULL_STACK: [
         {
            "id": "js_proficiency",
            "text": "Are you comfortable with JavaScript (ES6+)?",
            "options": [
                {"id": "yes", "text": "Yes, I use it daily"},
                {"id": "no", "text": "No, I need to learn it"}
            ],
            "topics_if_no": ["JavaScript Foundations"],
            "blocks_next_if": ["no"],
            "tag": "foundational"
        },
        {
            "id": "react_proficiency",
            "text": "Have you built apps with React?",
            "options": [
                {"id": "yes", "text": "Yes, I know Hooks & Context"},
                {"id": "no", "text": "No, I want to learn React"}
            ],
            "topics_if_no": ["React Development"],
            "blocks_next_if": ["no"],
            "tag": "core"
        },
        {
            "id": "backend_proficiency",
            "text": "Have you built a backend API (Node/Python)?",
            "options": [
                {"id": "yes", "text": "Yes, I have built REST/GraphQL APIs"},
                {"id": "no", "text": "No, I focus on frontend"}
            ],
            "topics_if_no": ["Backend Development"],
            "tag": "core"
        }
    ]
}

def get_deterministic_prerequisites(topic: str) -> Optional[List[Dict[str, Any]]]:
    """
    Returns a list of prerequisite questions if a deterministic rule exists for the topic.
    Content is case-insensitive normalized.
    """
    normalized_topic = topic.lower().strip()
    
    # Simple substring matching for robustness
    if "ai engineer" in normalized_topic or "artificial intelligence" in normalized_topic:
        return PREREQUISITE_RULES[AI_ENGINEER]
    
    if "full stack" in normalized_topic or "web dev" in normalized_topic:
        return PREREQUISITE_RULES[FULL_STACK]
        
    return None

def get_dependent_gaps(missing_topics: List[str]) -> List[str]:
    """
    Infers additional missing topics based on dependencies.
    Example: If 'Python Programming' is missing, then 'Machine Learning' is also strictly missing.
    """
    inferred = set(missing_topics)
    
    # AI Engineer Dependency Chain
    # Python -> Math -> ML -> DL -> LLMs
    
    if "Python Programming" in inferred:
        inferred.add("Machine Learning Foundations")
        inferred.add("Deep Learning")
        inferred.add("Large Language Models")
        
    if "Mathematics for Machine Learning" in inferred:
        inferred.add("Machine Learning Foundations")
        inferred.add("Deep Learning")
        
    if "Machine Learning Foundations" in inferred:
        inferred.add("Deep Learning")
        inferred.add("Large Language Models")
        
    if "Deep Learning" in inferred:
        inferred.add("Large Language Models")
        
    # Full Stack Dependency Chain
    if "JavaScript Foundations" in inferred:
        inferred.add("React Development")
        inferred.add("Backend Development") # Usually needs JS/Python
        
    return list(inferred)
