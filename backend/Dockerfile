FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Build deps for packages that compile native extensions (e.g. pycairo/reportlab stack).
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    libcairo2-dev \
  && rm -rf /var/lib/apt/lists/*

# Install backend dependencies.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code.
COPY . .

# Cloud Run injects PORT at runtime.
ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
