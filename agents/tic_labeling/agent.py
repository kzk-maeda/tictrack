"""
Tic Labeling Agent - AI-powered tic symptom analysis

This agent analyzes video recordings of tic episodes and provides structured labels
including type (motor/vocal), severity (1-3), and context.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from strands import Agent
from typing import Optional
import logging

# Configure logging to stdout (for AgentCore Runtime)
import sys
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

# Import tools (to be implemented)
from .tools.analyze_video import analyze_video
from .tools.transcribe_audio import transcribe_audio
from .tools.integrate_results import integrate_results
from .tools.apply_guardrails import apply_guardrails
from .tools.store_label import store_label

# Initialize FastAPI app
app = FastAPI(
    title="TicTrack Tic Labeling Agent",
    description="AI-powered tic symptom analysis using Nova Pro and Bedrock",
    version="1.0.0",
)

# Initialize Strands Agent with tools
agent = Agent(
    tools=[
        analyze_video,
        transcribe_audio,
        integrate_results,
        apply_guardrails,
        store_label,
    ],
    callback_handler=None,  # Disable console output for web integration
)

# System instructions to be prepended to each prompt
AGENT_INSTRUCTIONS = """You are an AI assistant that analyzes videos of tic episodes.

Your task is to:
1. Analyze the video using Nova Pro to detect tic movements and behaviors
2. Transcribe any audio to capture vocal tics or contextual information
3. Integrate the results from video and audio analysis
4. Apply Bedrock Guardrails to ensure safe, non-diagnostic language
5. Store the structured label in DynamoDB

Important guidelines:
- Use observational language only (e.g., "appears to show", "may indicate")
- NEVER provide medical diagnoses or treatment recommendations
- Focus on observable behaviors and movements
- Classify tics as motor (physical movements) or vocal (sounds/words)
- Rate severity on a scale of 1-3 based on intensity and frequency
- Identify context if possible (time of day, activity, environment)

Always be cautious and humble about limitations of AI analysis.
"""


# Request/Response models
class AnalyzeRequest(BaseModel):
    """Request body for video analysis"""
    model_config = {"populate_by_name": True}

    episode_id: str = Field(alias="episodeId")
    child_id: str = Field(alias="childId")
    s3_key: str = Field(alias="s3Key")
    bucket_name: Optional[str] = Field(default="tictrack-media-dev", alias="bucketName")
    aws_region: Optional[str] = Field(default="ap-northeast-1", alias="awsRegion")
    video_mime_type: Optional[str] = Field(default="video/webm", alias="videoMimeType")


class AnalyzeResponse(BaseModel):
    """Response body for video analysis"""
    episode_id: str
    status: str
    label: Optional[dict] = None
    error: Optional[str] = None


@app.get("/ping")
async def ping():
    """Health check endpoint for AgentCore Runtime"""
    return {"status": "healthy", "agent": "tic-labeling", "version": "1.0.0"}


@app.post("/invocations", response_model=AnalyzeResponse)
async def analyze_tic_episode(request: AnalyzeRequest):
    """
    Main endpoint for analyzing tic episodes

    This endpoint is called by the Lambda proxy when a video upload is complete.
    The agent will:
    1. Analyze the video with Nova Pro
    2. Transcribe audio if present
    3. Apply guardrails for safety
    4. Store results in DynamoDB
    """
    try:
        print(f">>> Starting analysis for episode {request.episode_id}", flush=True)

        # Construct prompt for the agent (prepend instructions)
        prompt = f"""{AGENT_INSTRUCTIONS}

Analyze the tic episode video with the following details:
- Episode ID: {request.episode_id}
- Child ID: {request.child_id}
- S3 Bucket: {request.bucket_name}
- S3 Key: {request.s3_key}
- Video Type: {request.video_mime_type}

Please:
1. Use the analyze_video tool with s3_key="{request.s3_key}" and bucket_name="{request.bucket_name}"
2. Use the transcribe_audio tool with s3_key="{request.s3_key}" and bucket_name="{request.bucket_name}"
3. Use the integrate_results tool to combine video and audio findings
4. Use the apply_guardrails tool to ensure safe language
5. Use the store_label tool to save the results to DynamoDB

Return a structured analysis with type, severity, and context."""

        # Stream agent response (following Strands SDK pattern)
        final_event = None
        async for event in agent.stream_async(prompt):
            # Log the full event structure to understand what we're receiving
            print(f">>> Agent event (full): {event}", flush=True)
            print(f">>> Agent event type: {type(event)}", flush=True)

            # The final event contains the result
            final_event = event

        if not final_event:
            print(">>> Agent did not produce any events", flush=True)
            raise ValueError("Agent did not return a result")

        # Extract result from final event (following Strands SDK pattern)
        if "result" not in final_event:
            print(f">>> Final event does not contain 'result' key: {final_event}", flush=True)
            raise ValueError("Agent streaming completed without producing a result event")

        agent_result = final_event["result"]
        print(f">>> Agent result extracted: {agent_result}", flush=True)
        print(f">>> Agent result type: {type(agent_result)}", flush=True)

        # Try to extract structured result or text
        result_data = None
        if isinstance(agent_result, dict):
            # If result is already a dict, use it directly
            result_data = agent_result
        elif hasattr(agent_result, "structured_output") and agent_result.structured_output:
            result_data = agent_result.structured_output
        elif hasattr(agent_result, "text") and agent_result.text:
            # Try to parse text as JSON
            import json
            try:
                result_data = json.loads(agent_result.text)
            except json.JSONDecodeError:
                result_data = {"raw_text": agent_result.text}
        else:
            # Fallback: convert AgentResult to dict
            result_data = {
                "stop_reason": getattr(agent_result, "stop_reason", "unknown"),
                "text": str(agent_result),
            }

        return AnalyzeResponse(
            episode_id=request.episode_id,
            status="completed",
            label=result_data,
        )

    except Exception as e:
        print(f">>> Error analyzing episode {request.episode_id}: {str(e)}", flush=True)
        import traceback
        print(f">>> Traceback: {traceback.format_exc()}", flush=True)
        return AnalyzeResponse(
            episode_id=request.episode_id,
            status="failed",
            error=str(e),
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
