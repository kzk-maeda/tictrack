"""
Tic Labeling Agent - AI-powered tic symptom analysis

This agent analyzes video recordings of tic episodes and provides structured labels
including type (motor/vocal), severity (1-3), and context.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from strands import Agent
from typing import Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
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
    name="Tic Labeling Agent",
    instructions="""You are an AI assistant that analyzes videos of tic episodes.

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

Always be cautious and humble about limitations of AI analysis.""",
    tools=[
        analyze_video,
        transcribe_audio,
        integrate_results,
        apply_guardrails,
        store_label,
    ],
    callback_handler=None,  # Disable console output for web integration
)


# Request/Response models
class AnalyzeRequest(BaseModel):
    """Request body for video analysis"""
    episode_id: str
    child_id: str
    s3_key: str
    video_mime_type: Optional[str] = "video/mp4"


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
        logger.info(f"Starting analysis for episode {request.episode_id}")

        # Construct prompt for the agent
        prompt = f"""Analyze the tic episode video with the following details:
- Episode ID: {request.episode_id}
- Child ID: {request.child_id}
- S3 Key: {request.s3_key}
- Video Type: {request.video_mime_type}

Please:
1. Use the analyze_video tool to examine the video
2. Use the transcribe_audio tool to capture any vocal content
3. Use the integrate_results tool to combine video and audio findings
4. Use the apply_guardrails tool to ensure safe language
5. Use the store_label tool to save the results to DynamoDB

Return a structured analysis with type, severity, and context."""

        # Stream agent response
        result = None
        async for event in agent.stream_async(prompt):
            if event.get("type") == "agent_finish":
                result = event.get("data", {})
                logger.info(f"Agent finished: {result}")

        if not result:
            raise ValueError("Agent did not return a result")

        return AnalyzeResponse(
            episode_id=request.episode_id,
            status="completed",
            label=result,
        )

    except Exception as e:
        logger.error(f"Error analyzing episode {request.episode_id}: {str(e)}")
        return AnalyzeResponse(
            episode_id=request.episode_id,
            status="failed",
            error=str(e),
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
