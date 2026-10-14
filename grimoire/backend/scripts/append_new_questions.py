
import json
import os

# Define paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(BASE_DIR, "data", "company_questions.json")

NEW_QUESTIONS = [
    # --- GOOGLE ---
    {
        "company": "google", "role": "frontend_engineer", "experience": "mid", "difficulty": "medium", "category": "Frontend",
        "question": "Explain the Critical Rendering Path and how you would optimize it.",
        "context": "Tests understanding of browser internals and performance.",
        "follow_ups": ["How does async vs defer script loading affect this?", "What is layout thrashing?"]
    },
    {
        "company": "google", "role": "sre", "experience": "mid", "difficulty": "medium", "category": "System",
        "question": "A server is unreachable via SSH but responds to Ping. How do you troubleshoot?",
        "context": "Tests systematic troubleshooting and Linux knowledge.",
        "follow_ups": ["What if the disk is full?", "How do you check for firewall drops?"]
    },
    # --- AMAZON ---
    {
        "company": "amazon", "role": "frontend_engineer", "experience": "mid", "difficulty": "medium", "category": "Frontend",
        "question": "Design a star rating widget. How do you handle accessibility and partial stars?",
        "context": "Customer obsession and attention to detail.",
        "follow_ups": ["How do you handle keyboard navigation?", "How to make it performant with 1000 widgets on page?"]
    },
    {
        "company": "amazon", "role": "data_engineer", "experience": "mid", "difficulty": "hard", "category": "Data",
        "question": "Design a data pipeline to handle widely varying traffic spikes from Prime Day.",
        "context": "Scalability and trade-offs.",
        "follow_ups": ["Kinesis vs Kafka?", "How to handle duplicate events?"]
    },
    # --- MICROSOFT ---
    {
        "company": "microsoft", "role": "data_scientist", "experience": "mid", "difficulty": "medium", "category": "ML",
        "question": "Explain the Bias-Variance tradeoff. How do you detect which one is suffering?",
        "context": "Fundamentals of ML theory.",
        "follow_ups": ["Does adding more data help high bias?", "What about regularization?"]
    },
        {
        "company": "microsoft", "role": "product_manager", "experience": "mid", "difficulty": "medium", "category": "Product",
        "question": "How would you measure the success of a new search feature in VS Code?",
        "context": "Metric selection and user empathy.",
        "follow_ups": ["What is a counter-metric?", "How to handle negative user feedback?"]
    },
    # --- META ---
    {
        "company": "meta", "role": "data_engineer", "experience": "mid", "difficulty": "medium", "category": "SQL",
        "question": "Write a SQL query to find the top 3 items sold in each category by day.",
        "context": "SQL window functions and analytics.",
        "follow_ups": ["How to optimize this for petabyte scale?", "Window functions vs Group By execution?"]
    },
    {
        "company": "meta", "role": "product_designer", "experience": "mid", "difficulty": "medium", "category": "Design",
        "question": "Critique the 'Friend Request' flow. How would you improve it for emerging markets?",
        "context": "Product thinking and visual design.",
        "follow_ups": ["Constraints of low-end devices?", "Data usage considerations?"]
    },
    # --- NETFLIX ---
    {
        "company": "netflix", "role": "data_engineer", "experience": "senior", "difficulty": "hard", "category": "Big Data",
        "question": "Compare Parquet vs Avro for our data lake. Which one for read-heavy vs write-heavy?",
        "context": "Storage formats and query optimization.",
        "follow_ups": ["Schema evolution support?", "Compression efficiency?"]
    },
    {
        "company": "netflix", "role": "ui_engineer", "experience": "senior", "difficulty": "hard", "category": "Frontend",
        "question": "How would you architect a TV UI that needs to run smoothly on very low-power set-top boxes?",
        "context": "Performance under extreme constraints.",
        "follow_ups": ["Memory management strategies?", "Compositing layers?"]
    },
    # --- VISA ---
    {
        "company": "visa", "role": "product_manager", "experience": "mid", "difficulty": "hard", "category": "Product",
        "question": "A transaction success rate drops by 1% globally. What is your investigation process?",
        "context": "Crisis management and analytical thinking.",
        "follow_ups": ["Who do you alert first?", "How to distinguish network vs issuer issues?"]
    },
    {
        "company": "visa", "role": "qa_engineer", "experience": "mid", "difficulty": "medium", "category": "Testing",
        "question": "Design a test strategy for a payment API that cannot use real money in production testing.",
        "context": "Testing methodologies and safety.",
        "follow_ups": ["Mocking vs Sandboxing?", "Security testing?"]
    },
    # --- INFOSYS ---
    {
        "company": "infosys", "role": "software_engineer", "experience": "entry", "difficulty": "easy", "category": "DSA",
        "question": "Write a program to reverse a string without using built-in functions.",
        "context": "Basic coding and logic.",
        "follow_ups": ["Time complexity?", "Handle null input?"]
    },
    {
        "company": "infosys", "role": "software_engineer", "experience": "entry", "difficulty": "medium", "category": "Java",
        "question": "Explain the difference between Abstract Class and Interface in Java.",
        "context": "OOPS concepts.",
        "follow_ups": ["When to use which?", "Default methods in interface?"]
    },
    {
        "company": "infosys", "role": "systems_engineer", "experience": "entry", "difficulty": "medium", "category": "OS",
        "question": "What is the difference between specific Process and Thread?",
        "context": "OS fundamentals.",
        "follow_ups": ["Memory sharing?", "Context switching cost?"]
    },
    {
        "company": "infosys", "role": "technology_analyst", "experience": "mid", "difficulty": "medium", "category": "System Design",
        "question": "Explain the Singleton design pattern and a scenario where you used it.",
        "context": "Design patterns.",
        "follow_ups": ["Is it thread safe?", "Double checked locking?"]
    },
    # --- TCS ---
    {
        "company": "tcs", "role": "assistant_system_engineer", "experience": "entry", "difficulty": "easy", "category": "Logic",
        "question": "Swap two numbers without using a third variable.",
        "context": "Logical reasoning.",
        "follow_ups": ["Using XOR?", "Overflow issues?"]
    },
    {
        "company": "tcs", "role": "system_engineer", "experience": "mid", "difficulty": "medium", "category": "DB",
        "question": "What is normalization? Explain 1NF, 2NF, 3NF.",
        "context": "Database fundamentals.",
        "follow_ups": ["Denormalization?", "Performance impact?"]
    },
    {
        "company": "tcs", "role": "digital_innovator", "experience": "mid", "difficulty": "hard", "category": "Cloud",
        "question": "How does cloud elasticity differ from scalability?",
        "context": "Cloud concepts.",
        "follow_ups": ["Vertical vs Horizontal scaling?", "Cost implications?"]
    },
    # --- GOLDMAN SACHS ---
    {
        "company": "goldmansachs", "role": "technology_analyst", "experience": "entry", "difficulty": "medium", "category": "DSA",
        "question": "Find the first non-repeating character in a stream of characters.",
        "context": "DSA and HashMaps.",
        "follow_ups": ["Time complexity?", "Using a queue?"]
    },
    {
        "company": "goldmansachs", "role": "associate", "experience": "mid", "difficulty": "hard", "category": "System Design",
        "question": "Design a real-time stock price ticker system.",
        "context": "Low latency system design.",
        "follow_ups": ["WebSocket vs Polling?", "Handling packet loss?"]
    },
    # Additional questions to reach ~30 for new companies would take more space, 
    # but for "Company-Specific Mode" usually 10-15 is enough to demo.
    # I will add a few more for GS Quant.
    {
        "company": "goldmansachs", "role": "quant_strategist", "experience": "mid", "difficulty": "hard", "category": "Math",
        "question": "What is the expected number of tosses to get two consecutive heads?",
        "context": "Probability puzzle.",
        "follow_ups": ["Three consecutive heads?", "Markov chain approach?"]
    }
]

def append_data():
    print(f"Loading existing data from {DATA_FILE}...")
    try:
        with open(DATA_FILE, "r") as f:
            questions = json.load(f)
    except FileNotFoundError:
        print("File not found, creating new.")
        questions = []

    initial_count = len(questions)
    print(f"Initial count: {initial_count}")
    
    # Append
    processed_new = []
    # Deduplicate loosely based on query text to avoid double insertion if run twice
    existing_qs = {q["question"] for q in questions}
    
    for q in NEW_QUESTIONS:
        if q["question"] not in existing_qs:
            questions.append(q)
            processed_new.append(q)
            existing_qs.add(q["question"])
    
    print(f"Added {len(processed_new)} new questions.")
    
    with open(DATA_FILE, "w") as f:
        json.dump(questions, f, indent=2)
        
    print("Saved successfully.")

if __name__ == "__main__":
    append_data()
