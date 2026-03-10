# TicTrack AI Agents

AI-powered tic symptom analysis agents using Amazon Bedrock and Strands Agents SDK.

## Overview

This package contains two AI agents:

1. **Tic Labeling Agent** - Analyzes video recordings of tic episodes and provides structured labels
2. **Micro-Guide Agent** - Generates personalized micro-guides based on weekly symptom patterns (TODO)

## Architecture

- **Language**: Python 3.12
- **Framework**: FastAPI + Strands Agents SDK
- **AI Models**:
  - Amazon Nova Pro (video analysis)
  - Amazon Transcribe (audio transcription)
  - Bedrock Guardrails (content safety)
- **Deployment**: AgentCore Runtime (Docker containers on ECS)

## Development Setup

### Prerequisites

- Python 3.12+
- [uv](https://github.com/astral-sh/uv) package manager
- AWS credentials configured

### Installation

```bash
# Install dependencies
uv sync

# Run tests
uv run pytest

# Run tests in parallel (faster)
uv run pytest -n auto
```

## Local Testing

### Quick Start

```bash
# Start the agent server with your AWS profile
./run_local.sh YOUR_AWS_PROFILE

# In another terminal, test the endpoint
./test_invocation.sh videos/test/video.mp4 YOUR_BUCKET_NAME
```

### Detailed Instructions

See [LOCAL_TESTING.md](./LOCAL_TESTING.md) for:
- AWS credentials setup
- Required permissions
- Troubleshooting guide
- Cost estimation

## Project Structure

```
agents/
├── tic_labeling/              # Tic Labeling Agent
│   ├── agent.py              # FastAPI application
│   └── tools/                # Agent tools
│       ├── analyze_video.py  # Nova Pro video analysis
│       ├── transcribe_audio.py # Audio transcription
│       ├── integrate_results.py # Result combination
│       ├── apply_guardrails.py # Content safety
│       └── store_label.py    # DynamoDB storage
├── micro_guide/              # Micro-Guide Agent (TODO)
├── tests/                    # Unit tests
│   ├── test_analyze_video.py
│   ├── test_transcribe_audio.py
│   ├── test_guardrails.py
│   └── test_store_label.py
├── run_local.sh             # Local server startup script
├── test_invocation.sh       # Test script for /invocations
├── LOCAL_TESTING.md         # Detailed testing guide
└── pyproject.toml           # Dependencies and config
```

## Tic Labeling Agent

### Endpoints

#### `GET /ping`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "agent": "tic-labeling",
  "version": "1.0.0"
}
```

#### `POST /invocations`

Analyze a tic episode video.

**Request:**
```json
{
  "episode_id": "episode-123",
  "child_id": "child-456",
  "s3_key": "videos/user/child/episode/video.mp4",
  "video_mime_type": "video/mp4"
}
```

**Response:**
```json
{
  "episode_id": "episode-123",
  "status": "completed",
  "label": {
    "type": "motor|vocal|both",
    "severity": 1-3,
    "context": "Description of observed behavior",
    "observations": [
      {
        "timestamp": "0:05",
        "description": "Repetitive eye blinking",
        "intensity": "low|medium|high"
      }
    ],
    "confidence": 0.0-1.0,
    "transcript": "Audio transcription if present",
    "vocal_tics_detected": true|false
  }
}
```

### Agent Tools

The Tic Labeling Agent uses 5 tools:

1. **analyze_video** - Analyzes video with Nova Pro
   - Input: S3 key, bucket name
   - Output: Observations, suggested type/severity, confidence

2. **transcribe_audio** - Transcribes audio with Amazon Transcribe
   - Input: S3 key, bucket name, language code
   - Output: Transcript, detected sounds, vocal tics flag

3. **integrate_results** - Combines video and audio analysis
   - Input: Video analysis, audio transcription
   - Output: Unified label structure

4. **apply_guardrails** - Ensures safe, observational language
   - Input: Label data
   - Output: Validated/sanitized label

5. **store_label** - Saves results to DynamoDB
   - Input: Episode ID, child ID, label, guardrail result
   - Output: Confirmation with AI label ID

### Guardrails

The agent uses Bedrock Guardrails to ensure:
- ✅ Only observational language (e.g., "appears to show")
- ❌ No medical diagnoses
- ❌ No treatment recommendations

**Fallback**: If Bedrock Guardrails is unavailable, keyword-based validation is used.

## Testing

### Unit Tests

```bash
# Run all tests
uv run pytest

# Run specific test file
uv run pytest tests/test_analyze_video.py

# Run with coverage
uv run pytest --cov=tic_labeling

# Run in parallel (fast)
uv run pytest -n auto
```

**Test Statistics:**
- Total: 27 tests
- Execution time: ~2 seconds (parallel)
- Coverage: Tools and integration logic

### Test Structure

- **Mocked AWS Services**: Uses `moto` for DynamoDB, mocked responses for Bedrock/Transcribe
- **Timeout Handling**: Uses time mocking for fast timeout tests
- **Shared Fixtures**: `conftest.py` provides reusable mocks

## Environment Variables

The agent respects standard AWS environment variables:

- `AWS_PROFILE` - AWS profile to use (default: "default")
- `AWS_REGION` - AWS region (default: "us-east-1")
- `AWS_ACCESS_KEY_ID` - AWS access key (if not using profile)
- `AWS_SECRET_ACCESS_KEY` - AWS secret key (if not using profile)

## Docker Deployment (TODO: Task #43)

```bash
# Build image
docker build -t tic-labeling-agent .

# Run locally
docker run -p 8080:8080 \
  -e AWS_PROFILE=your-profile \
  -v ~/.aws:/root/.aws:ro \
  tic-labeling-agent

# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker tag tic-labeling-agent:latest <account>.dkr.ecr.us-east-1.amazonaws.com/tictrack-agents:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/tictrack-agents:latest
```

## API Integration (TODO: Task #44)

The agent will be called via Lambda Proxy:

```
User uploads video → S3 → EventBridge → Lambda Proxy → AgentCore Runtime → Agent
```

Lambda Proxy will:
1. Receive S3 upload event
2. Extract episode metadata
3. Call `/invocations` endpoint
4. Handle retries and errors
5. Update frontend via AppSync

## Cost Estimation

Per video analysis:
- Nova Pro: ~$0.004 (1-2 min video)
- Transcribe: ~$0.024/min audio
- Guardrails: ~$0.0002/1k chars
- DynamoDB: negligible

**Total**: ~$0.01-0.05 per analysis

**Free tier** (12 months):
- Bedrock: $200 credit
- Transcribe: 60 minutes free

## Troubleshooting

### Import Errors

```bash
# Reinstall dependencies
uv sync --reinstall
```

### AWS Credential Issues

```bash
# Verify credentials
aws sts get-caller-identity --profile YOUR_PROFILE

# List profiles
cat ~/.aws/config
```

### Bedrock Model Access

Ensure Nova Pro access is enabled:
1. AWS Console → Bedrock → Model access
2. Request access to "Amazon Nova Pro"
3. Wait for approval (usually instant)

### Test Failures

```bash
# Clear pytest cache
rm -rf .pytest_cache

# Run with verbose output
uv run pytest -vv

# Run single test
uv run pytest tests/test_analyze_video.py::TestAnalyzeVideo::test_analyze_video_returns_structured_json
```

## Contributing

### Adding New Tools

1. Create tool in `tic_labeling/tools/my_tool.py`:
```python
from strands import tool
from typing import Dict, Any

@tool
def my_tool(param: str) -> Dict[str, Any]:
    """Tool description for AI agent"""
    # Implementation
    return {"result": "..."}
```

2. Import in `agent.py`:
```python
from .tools.my_tool import my_tool

agent = Agent(
    tools=[
        # ... existing tools
        my_tool,
    ]
)
```

3. Add tests in `tests/test_my_tool.py`:
```python
from tic_labeling.tools.my_tool import my_tool

class TestMyTool:
    def test_my_tool_returns_expected_result(self):
        result = my_tool("input")
        assert result["result"] == "expected"
```

### Code Style

- Follow PEP 8
- Use type hints
- Document with docstrings
- Write tests before implementation (TDD)

## License

Proprietary - TicTrack AWS 10,000 AIdeas Competition Entry

## Support

For issues or questions:
- Check [LOCAL_TESTING.md](./LOCAL_TESTING.md)
- Review logs: Agent outputs detailed logs via Python logging
- AWS CloudWatch: Check Lambda/ECS logs in production
