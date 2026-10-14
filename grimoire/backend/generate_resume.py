from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch

def create_resume(filename):
    c = canvas.Canvas(filename, pagesize=letter)
    width, height = letter

    # Header
    c.setFont("Helvetica-Bold", 24)
    c.drawString(1 * inch, height - 1 * inch, "Alex I. Engineer")
    
    c.setFont("Helvetica", 12)
    c.drawString(1 * inch, height - 1.3 * inch, "ai.engineer@example.com | (555) 123-4567 | github.com/ai-engineer")
    c.line(1 * inch, height - 1.4 * inch, width - 1 * inch, height - 1.4 * inch)

    # Experience
    y = height - 1.8 * inch
    c.setFont("Helvetica-Bold", 16)
    c.drawString(1 * inch, y, "Experience")
    y -= 0.3 * inch

    c.setFont("Helvetica-Bold", 12)
    c.drawString(1 * inch, y, "Senior AI Engineer - TechCorp Inc.")
    c.setFont("Helvetica", 12)
    c.drawString(width - 2.5 * inch, y, "Jan 2022 - Present")
    y -= 0.2 * inch
    c.setFont("Helvetica", 11)
    c.drawString(1.2 * inch, y, "- Lead development of LLM-based customer support agents using RAG architecture.")
    y -= 0.2 * inch
    c.drawString(1.2 * inch, y, "- Optimized inference latency by 40% using quantization and model distillation.")
    y -= 0.2 * inch
    c.drawString(1.2 * inch, y, "- Deployed scalable AI microservices on Kubernetes handling 1M+ requests/day.")
    y -= 0.4 * inch

    c.setFont("Helvetica-Bold", 12)
    c.drawString(1 * inch, y, "Machine Learning Engineer - DataSolutions LLC")
    c.setFont("Helvetica", 12)
    c.drawString(width - 2.5 * inch, y, "Jun 2019 - Dec 2021")
    y -= 0.2 * inch
    c.setFont("Helvetica", 11)
    c.drawString(1.2 * inch, y, "- Built computer vision models for automated defect detection in manufacturing.")
    y -= 0.2 * inch
    c.drawString(1.2 * inch, y, "- Implemented data pipelines using Apache Airflow and TensorFlow Extended (TFX).")
    y -= 0.4 * inch

    # Skills
    c.setFont("Helvetica-Bold", 16)
    c.drawString(1 * inch, y, "Skills")
    y -= 0.3 * inch
    c.setFont("Helvetica", 11)
    c.drawString(1.2 * inch, y, "Languages: Python, C++, TypeScript, SQL")
    y -= 0.2 * inch
    c.drawString(1.2 * inch, y, "Frameworks: PyTorch, TensorFlow, LangChain, FastAPI, Next.js")
    y -= 0.2 * inch
    c.drawString(1.2 * inch, y, "Tools: Docker, Kubernetes, AWS, Google Cloud, wandb")
    y -= 0.4 * inch

    # Education
    c.setFont("Helvetica-Bold", 16)
    c.drawString(1 * inch, y, "Education")
    y -= 0.3 * inch
    c.setFont("Helvetica-Bold", 12)
    c.drawString(1 * inch, y, "M.S. Computer Science (AI Specialization)")
    c.setFont("Helvetica", 12)
    c.drawString(width - 2.5 * inch, y, "2017 - 2019")
    y -= 0.2 * inch
    c.setFont("Helvetica", 11)
    c.drawString(1.2 * inch, y, "University of Technology")

    c.save()

if __name__ == "__main__":
    create_resume("AI_Engineer_Resume.pdf")
    print("Resume created: AI_Engineer_Resume.pdf")
