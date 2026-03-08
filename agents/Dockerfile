# TicTrack Tic Labeling Agent - Docker Image for AgentCore Runtime
# AgentCore Runtime requires ARM64 architecture
FROM --platform=linux/arm64 python:3.12-slim

WORKDIR /app

# Install uv for fast dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies with uv (creates .venv automatically)
RUN uv sync --frozen --no-dev

# Copy application code
COPY tic_labeling ./tic_labeling
COPY micro_guide ./micro_guide

# Set Python path to use uv-managed virtual environment
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app:$PYTHONPATH"

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8080/ping')"

# Expose port (AgentCore Runtime expects 8080)
EXPOSE 8080

# Run with uvicorn
CMD ["uvicorn", "tic_labeling.agent:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
