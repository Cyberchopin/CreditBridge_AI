FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/tmp \
    AWS_REGION=us-east-1 \
    CREDITBRIDGE_EXECUTION_MODE=deterministic \
    CREDITBRIDGE_ALLOW_LIVE_MODEL=false

WORKDIR /app
COPY infra/agentcore/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --requirement requirements.txt
COPY agent_runtime ./agent_runtime

EXPOSE 8080
USER 10001
CMD ["python", "-m", "agent_runtime.agentcore_app"]
