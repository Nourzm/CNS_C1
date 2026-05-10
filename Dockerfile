# Backend runtime — used by Render (default Dockerfile)
FROM python:3.11-slim

WORKDIR /app

# System libraries needed by OpenCV + InsightFace
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy application code (no config/ — it does not exist in this repo)
COPY backend/ /app/backend/
COPY ai/      /app/ai/

# Pre-download InsightFace buffalo_sc (~50 MB, ~150 MB RAM at runtime).
# buffalo_l (~280 MB) OOM-kills Render's 512 MB free container.
ENV INSIGHTFACE_HOME=/app/.insightface
RUN python - <<'EOF'
import pathlib, sys
pathlib.Path("/app/.insightface").mkdir(parents=True, exist_ok=True)
try:
    from insightface.app import FaceAnalysis
    a = FaceAnalysis(name="buffalo_sc", providers=["CPUExecutionProvider"])
    a.prepare(ctx_id=0, det_size=(640, 640))
    print("buffalo_sc pre-downloaded OK")
except Exception as e:
    print(f"pre-download failed (will retry at runtime): {e}", file=sys.stderr)
EOF

ENV PYTHONUNBUFFERED=1 \
    PORT=8000

EXPOSE 8000

WORKDIR /app/backend
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]