from typing import Dict, List, Optional, Any
from pydantic import BaseModel

class RoleDefinition(BaseModel):
    title: str
    levels: List[str]
    skills: List[str]

class CompanyDefinition(BaseModel):
    id: str
    name: str # The emoji + Name string
    roles: List[RoleDefinition]
    culture_context: str = "" # Optional behavioral context

# Raw Data from PM Directive
# Raw Data from PM Directive
# 🟦 Google, 🟧 Amazon, 🟦 Microsoft, 🟪 Meta, 🟥 Netflix, 🟨 Visa, 🟫 JPMorgan Chase, 🟩 Flipkart, 🟦 Infosys, 🟦 TCS, ⬜ Goldman Sachs

COMPANY_DEFINITIONS: Dict[str, Dict[str, Any]] = {
    "google": {
        "id": "google",
        "name": "🟦 Google",
        "roles": [
            {
                "title": "Software Engineer (SWE)",
                "id": "software_engineer",
                "levels": ["Intern", "Entry", "Mid"], 
                # Mapped manually to standardized levels in code if needed, but we keep PM's strings for display
                # We will validate against these strings.
                "experience_mapping": {
                    "Intern": "junior",
                    "Entry": "junior",
                    "Mid": "mid"
                },
                "skills": [
                    "Data Structures & Algorithms",
                    "Time and Space Complexity",
                    "Graphs, Trees, DP",
                    "Problem decomposition",
                    "Clean, readable code",
                    "Communication of approach"
                ]
            },
            {
                "title": "Backend Engineer",
                "id": "backend_engineer",
                "levels": ["Entry", "Mid"],
                "experience_mapping": {
                    "Entry": "junior",
                    "Mid": "mid"
                },
                "skills": [
                    "APIs and backend architecture",
                    "Databases (SQL basics)",
                    "Scalability fundamentals",
                    "Concurrency basics",
                    "Algorithmic thinking"
                ]
            },
            {
                "title": "Machine Learning Engineer",
                "id": "ml_engineer",
                "levels": ["Entry", "Mid"],
                "experience_mapping": {
                    "Entry": "junior",
                    "Mid": "mid"
                },
                "skills": [
                    "ML fundamentals",
                    "Data preprocessing",
                    "Model evaluation",
                    "Python",
                    "Problem framing"
                ]
            }
        ]
    },
    "amazon": {
        "id": "amazon",
        "name": "🟧 Amazon",
        "roles": [
            {
                "title": "Software Development Engineer (SDE I / II)",
                "id": "sde",
                "levels": ["Entry", "Mid"],
                "experience_mapping": {
                    "Entry": "junior",
                    "Mid": "mid"
                },
                "skills": [
                    "Data Structures",
                    "Coding under constraints",
                    "System basics",
                    "Debugging",
                    "Ownership mindset"
                ]
            },
            {
                "title": "Backend Engineer",
                "id": "backend_engineer",
                "levels": ["Entry", "Mid"],
                "experience_mapping": {
                    "Entry": "junior",
                    "Mid": "mid"
                },
                "skills": [
                    "Distributed systems basics",
                    "APIs",
                    "Databases",
                    "Failure handling"
                ]
            },
            {
                "title": "Data Engineer",
                "id": "data_engineer",
                "levels": ["Entry", "Mid"],
                "experience_mapping": {
                    "Entry": "junior",
                    "Mid": "mid"
                },
                "skills": [
                    "SQL",
                    "Data pipelines",
                    "ETL concepts",
                    "Data validation"
                ]
            }
        ],
        "culture_context": "Focus heavily on Leadership Principles: Ownership, Customer Obsession, Bias for Action."
    },
    "microsoft": {
        "id": "microsoft",
        "name": "🟦 Microsoft",
        "roles": [
            {
                "title": "Software Engineer",
                "id": "software_engineer",
                "levels": ["Entry", "Mid"],
                "experience_mapping": {
                    "Entry": "junior",
                    "Mid": "mid"
                },
                "skills": [
                    "DSA fundamentals",
                    "Object-oriented concepts",
                    "Problem solving",
                    "Communication clarity"
                ]
            },
            {
                "title": "Full Stack Developer",
                "id": "full_stack_developer",
                "levels": ["Entry", "Mid"],
                "experience_mapping": {
                    "Entry": "junior",
                    "Mid": "mid"
                },
                "skills": [
                    "Frontend basics",
                    "Backend APIs",
                    "Data flow",
                    "Code organization"
                ]
            },
            {
                "title": "Cloud Engineer",
                "id": "cloud_engineer",
                "levels": ["Entry", "Mid"],
                "experience_mapping": {
                    "Entry": "junior",
                    "Mid": "mid"
                },
                "skills": [
                    "Cloud concepts",
                    "System reliability",
                    "APIs",
                    "Debugging distributed issues"
                ]
            }
        ]
    },
    "meta": {
        "id": "meta",
        "name": "🟪 Meta",
        "roles": [
            {
                "title": "Software Engineer",
                "id": "software_engineer",
                "levels": ["Entry", "Mid"],
                "experience_mapping": {
                    "Entry": "junior",
                    "Mid": "mid"
                },
                "skills": [
                    "Fast problem solving",
                    "DSA",
                    "Optimization",
                    "Edge-case handling"
                ]
            },
            {
                "title": "Backend Engineer",
                "id": "backend_engineer",
                "levels": ["Entry", "Mid"],
                "experience_mapping": {
                    "Entry": "junior",
                    "Mid": "mid"
                },
                "skills": [
                    "Scalable backend design",
                    "APIs",
                    "Databases",
                    "Performance trade-offs"
                ]
            },
            {
                "title": "Data Engineer",
                "id": "data_engineer",
                "levels": ["Entry", "Mid"],
                "experience_mapping": {
                    "Entry": "junior",
                    "Mid": "mid"
                },
                "skills": [
                    "SQL",
                    "Data modeling",
                    "Large-scale data handling"
                ]
            }
        ],
        "culture_context": "Move fast. Focus on impact and production-readiness."
    },
    "netflix": {
        "id": "netflix",
        "name": "🟥 Netflix",
        "roles": [
            {
                "title": "Backend Engineer",
                "id": "backend_engineer",
                "levels": ["Mid", "Senior"],
                "experience_mapping": {
                    "Mid": "mid",
                    "Senior": "senior"
                },
                "skills": [
                    "System design",
                    "Trade-off analysis",
                    "Scalability",
                    "Clear reasoning"
                ]
            },
            {
                "title": "Platform Engineer",
                "id": "platform_engineer",
                "levels": ["Mid", "Senior"],
                "experience_mapping": {
                    "Mid": "mid",
                    "Senior": "senior"
                },
                "skills": [
                    "Reliability engineering",
                    "APIs",
                    "Observability basics"
                ]
            }
        ],
        "culture_context": "Context, not control. Highly aligned, loosely coupled. Stunning colleagues."
    },
    "visa": {
        "id": "visa",
        "name": "🟨 Visa",
        "roles": [
            {
                "title": "Software Engineer",
                "id": "software_engineer",
                "levels": ["Entry", "Mid"],
                "experience_mapping": {
                    "Entry": "junior",
                    "Mid": "mid"
                },
                "skills": [
                    "DSA fundamentals",
                    "Data handling",
                    "Problem clarity",
                    "Code correctness"
                ]
            },
            {
                "title": "Data Analyst",
                "id": "data_analyst",
                "levels": ["Entry", "Mid"],
                "experience_mapping": {
                    "Entry": "junior",
                    "Mid": "mid"
                },
                "skills": [
                    "SQL",
                    "Data interpretation",
                    "Logical reasoning",
                    "Communication"
                ]
            },
            {
                "title": "Backend Engineer",
                "id": "backend_engineer",
                "levels": ["Entry", "Mid"],
                "experience_mapping": {
                    "Entry": "junior",
                    "Mid": "mid"
                },
                "skills": [
                    "APIs",
                    "Databases",
                    "Secure data handling"
                ]
            }
        ]
    },
    "jpmc": {
        "id": "jpmc",
        "name": "🟫 JPMorgan Chase",
        "roles": [
            {
                "title": "Software Engineer",
                "id": "software_engineer",
                "levels": ["Entry", "Mid"],
                "experience_mapping": {
                    "Entry": "junior",
                    "Mid": "mid"
                },
                "skills": [
                    "Structured problem solving",
                    "DSA",
                    "Clean coding",
                    "Risk awareness"
                ]
            },
            {
                "title": "Data Analyst",
                "id": "data_analyst",
                "levels": ["Entry", "Mid"],
                "experience_mapping": {
                    "Entry": "junior",
                    "Mid": "mid"
                },
                "skills": [
                    "SQL",
                    "Analytical reasoning",
                    "Business logic"
                ]
            },
            {
                "title": "Backend Engineer",
                "id": "backend_engineer",
                "levels": ["Entry", "Mid"],
                "experience_mapping": {
                    "Entry": "junior",
                    "Mid": "mid"
                },
                "skills": [
                    "APIs",
                    "Data consistency",
                    "System reliability"
                ]
            }
        ]
    },
    "flipkart": {
        "id": "flipkart",
        "name": "🟩 Flipkart",
        "roles": [
            {
                "title": "Software Engineer",
                "id": "software_engineer",
                "levels": ["Entry", "Mid"],
                "experience_mapping": {
                    "Entry": "junior",
                    "Mid": "mid"
                },
                "skills": [
                    "DSA",
                    "Practical coding",
                    "Edge-case handling"
                ]
            },
            {
                "title": "Backend Engineer",
                "id": "backend_engineer",
                "levels": ["Entry", "Mid"],
                "experience_mapping": {
                    "Entry": "junior",
                    "Mid": "mid"
                },
                "skills": [
                    "APIs",
                    "Databases",
                    "Scalability basics"
                ]
            },
            {
                "title": "Data Analyst",
                "id": "data_analyst",
                "levels": ["Entry"],
                "experience_mapping": {
                    "Entry": "junior"
                },
                "skills": [
                    "SQL",
                    "Data interpretation"
                ]
            }
        ]
    },
    "infosys": {
        "id": "infosys",
        "name": "🟦 Infosys",
        "roles": [
            {
                "title": "Software Engineer",
                "id": "software_engineer",
                "levels": ["Entry"],
                "experience_mapping": {
                    "Entry": "junior"
                },
                "skills": [
                    "Programming fundamentals",
                    "OOPS basics",
                    "Logical thinking",
                    "Communication"
                ]
            },
            {
                "title": "System Engineer",
                "id": "system_engineer",
                "levels": ["Entry"],
                "experience_mapping": {
                    "Entry": "junior"
                },
                "skills": [
                    "Basic systems knowledge",
                    "Debugging",
                    "Process understanding"
                ]
            },
            {
                "title": "Specialist Programmer",
                "id": "specialist_programmer",
                "levels": ["Entry", "Mid"],
                "experience_mapping": {
                    "Entry": "junior",
                    "Mid": "mid"
                },
                "skills": [
                    "Advanced coding",
                    "Full stack basics",
                    "Algorithm optimization"
                ]
            },
            {
                "title": "Digital Specialist Engineer",
                "id": "digital_specialist_engineer",
                "levels": ["Entry", "Mid"],
                "experience_mapping": {
                    "Entry": "junior",
                    "Mid": "mid"
                },
                "skills": [
                    "Cloud basics",
                    "Modern frameworks",
                    "DevOps awareness"
                ]
            }
        ]
    },
    "tcs": {
        "id": "tcs",
        "name": "🟦 TCS",
        "roles": [
            {
                "title": "Assistant System Engineer",
                "id": "assistant_system_engineer",
                "levels": ["Entry"],
                "experience_mapping": {
                    "Entry": "junior"
                },
                "skills": [
                    "Programming logic",
                    "Aptitude",
                    "Basic coding"
                ]
            },
            {
                "title": "System Engineer",
                "id": "system_engineer",
                "levels": ["Entry", "Mid"],
                "experience_mapping": {
                    "Entry": "junior",
                    "Mid": "mid"
                },
                "skills": [
                    "Application development",
                    "Database basics",
                    "SDLC"
                ]
            },
            {
                "title": "Digital Innovator",
                "id": "digital_innovator",
                "levels": ["Entry", "Mid"],
                "experience_mapping": {
                    "Entry": "junior",
                    "Mid": "mid"
                },
                "skills": [
                    "Innovation mindset",
                    "New technologies (AI/ML/Cloud)",
                    "Prototyping"
                ]
            }
        ]
    },
    "goldman_sachs": {
        "id": "goldman_sachs",
        "name": "⬜ Goldman Sachs",
        "roles": [
            {
                "title": "Analyst",
                "id": "analyst",
                "levels": ["Entry", "Mid"],
                "experience_mapping": {
                    "Entry": "junior",
                    "Mid": "mid"
                },
                "skills": [
                    "Financial domain interest",
                    "Quantitative analysis",
                    "Core Java/C++",
                    "Data structures"
                ]
            },
            {
                "title": "Associate",
                "id": "associate",
                "levels": ["Mid", "Senior"],
                "experience_mapping": {
                    "Mid": "mid",
                    "Senior": "senior"
                },
                "skills": [
                    "System design",
                    "Team leadership",
                    "Complex problem solving",
                    "Risk management"
                ]
            },
            {
                "title": "Vice President (Engineering)",
                "id": "vp_engineering",
                "levels": ["Senior"],
                "experience_mapping": {
                    "Senior": "senior"
                },
                "skills": [
                    "Strategic technical vision",
                    "Global team management",
                    "Architectural oversight",
                    "Regulatory compliance"
                ]
            }
        ],
        "culture_context": "High performance, consensus-driven, client-focused. Excellence and integrity are paramount."
    }
}

def get_all_companies():
    """Return a list of all company definitions for the frontend."""
    return [
        {
            "id": k,
            "name": v["name"],
            "roles": v["roles"]
        }
        for k, v in COMPANY_DEFINITIONS.items()
    ]

def get_company_config(company_id: str) -> Optional[Dict[str, Any]]:
    """Get the configuration for a specific company."""
    return COMPANY_DEFINITIONS.get(company_id)

def validate_company_role(company_id: str, role_id: str) -> Optional[Dict[str, Any]]:
    """
    Validate that a role belongs to a company.
    Returns the role definition if valid, else None.
    """
    company = COMPANY_DEFINITIONS.get(company_id)
    if not company:
        return None
    
    for role in company["roles"]:
        if role["id"] == role_id or role["title"] == role_id: # Allow loose matching on title if needed, but ID preferred
            return role
            
    return None
