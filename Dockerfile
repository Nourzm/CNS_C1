# Backend runtime for Render and other PaaS defaults
FROM python:3.11-slim

WORKDIR /app

# System libraries needed by OpenCV and related native wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first for better layer caching
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy the application code used by the backend
COPY backend/ /app/backend/
COPY ai/ /app/ai/
COPY config/ /app/config/

ENV PYTHONUNBUFFERED=1 \
    PORT=8000

EXPOSE 8000

WORKDIR /app/backend
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]