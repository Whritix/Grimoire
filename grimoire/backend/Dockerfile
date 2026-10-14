# Use official Python 3.11 slim image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

# Set working directory
WORKDIR /app

# Install system dependencies
# Added dos2unix to fix potential Windows line-ending issues in scripts
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    dos2unix \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file first to leverage Docker cache
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Create a non-root user for security
RUN useradd -m -u 1000 user

# Copy application code
COPY services/ services/
COPY shared/ shared/
COPY entrypoint.sh .

# Fix line endings and permissions
RUN dos2unix entrypoint.sh && \
    chmod +x entrypoint.sh && \
    chown -R user:user /app

# Switch to non-root user
USER user

# Expose port
EXPOSE 8000

# Start command
CMD ["./entrypoint.sh"]
