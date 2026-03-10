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
    model_id="anthropic.claude-sonnet-4-5-20250929-v1:0",  # Claude Sonnet 4.5 (supports tool calling)
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
AGENT_INSTRUCTIONS = """You are an AI assistant that analyzes videos of tic episodes using a structured 2-axis classification system.

Your task is to:
1. Analyze the video using Nova Pro to detect tic movements and behaviors
2. Transcribe any audio to capture vocal tics or contextual information
3. Integrate the results from video and audio analysis
4. Apply Bedrock Guardrails to ensure safe, non-diagnostic language
5. Store the structured label in DynamoDB

CLASSIFICATION SYSTEM (2-axis):

**Type Axis:**
- motor: Physical movements (eye blinking, head shaking, shoulder shrugging, etc.)
- vocal: Sounds or words (throat clearing, sniffing, grunting, words, etc.)

**Complexity Axis:**
- simple: Instantaneous, brief movements or sounds (<1 second)
- complex: Slower, more coordinated movements or meaningful vocalizations

**Severity Scale (1-5):**
1. Very Mild: Subtle, barely noticeable, rare occurrences
2. Mild: Noticeable but infrequent, minimal disruption
3. Moderate: Clearly visible/audible, moderate frequency
4. Moderately Severe: Frequent, noticeable disruption
5. Severe: Very frequent, intense, significant impact

**Common Symptoms (reference for symptomId):**

Motor Simple:
- motor_simple_eye_blinking: Eye blinking
- motor_simple_eye_rolling: Eye rolling
- motor_simple_head_shaking: Head shaking/jerking
- motor_simple_shoulder_shrugging: Shoulder shrugging
- motor_simple_nose_twitching: Nose twitching
- motor_simple_facial_grimacing: Facial grimacing
- motor_simple_mouth_movements: Mouth movements
- motor_simple_arm_jerking: Arm/hand jerking

Motor Complex:
- motor_complex_jumping: Jumping/hopping
- motor_complex_touching: Touching objects/self
- motor_complex_smelling: Smelling objects
- motor_complex_repetitive_movements: Repetitive movements
- motor_complex_body_bending: Body bending/twisting
- motor_complex_complex_gestures: Complex gestures
- motor_complex_imitative_movements: Imitating others
- motor_complex_self_harm: Self-injurious movements

Vocal Simple:
- vocal_simple_throat_clearing: Throat clearing
- vocal_simple_sniffing: Sniffing
- vocal_simple_coughing: Coughing
- vocal_simple_grunting: Grunting/snorting
- vocal_simple_squeaking: Squeaking sounds

Vocal Complex:
- vocal_complex_words: Repeating words
- vocal_complex_phrases: Repeating phrases
- vocal_complex_echolalia: Repeating others' words
- vocal_complex_palilalia: Repeating own words

If the observed tic doesn't match any symptomId, provide a customSymptom description.

Important guidelines:
- Use observational language only (e.g., "appears to show", "may indicate")
- NEVER provide medical diagnoses or treatment recommendations
- Focus on observable behaviors and movements
- Provide timestamp-based observations when possible
- Rate confidence (0.0-1.0) based on video quality and clarity

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

Return a structured analysis in this format:
{{
    "primaryTic": {{
        "type": "motor" or "vocal",
        "complexity": "simple" or "complex",
        "symptomId": "motor_simple_eye_blinking" (or null if custom),
        "customSymptom": "description" (only if symptomId is null),
        "confidence": 0.0-1.0
    }},
    "secondaryTics": [
        {{same structure as primaryTic}} (optional, if multiple tics detected)
    ],
    "severity": 1-5 (overall severity rating),
    "observations": [
        {{
            "timestamp": 1.5 (seconds in video),
            "description": "Observable behavior",
            "intensity": "low", "medium", or "high"
        }}
    ]
}}"""

        # Stream agent response (following Strands SDK pattern)
        final_event = None
        async for event in agent.stream_async(prompt):
            # Log the full event structure to understand what we're receiving
            print(f">>> Agent event (full): {event}", flush=True)
            print(f">>> Agent event type: {type(event)}", flush=True)
            final_event = event

        if not final_event:
            print(">>> Agent did not produce any events", flush=True)
            raise ValueError("Agent did not return a result")

        print(">>> Agent execution completed", flush=True)

        # After agent completes, retrieve the label from DynamoDB
        # The store_label tool has already saved it, so we just need to fetch it
        import boto3
        import os
        from decimal import Decimal

        dynamodb = boto3.resource('dynamodb')
        ai_labels_table_name = os.getenv("AI_LABELS_TABLE", "AILabels")
        ai_labels_table = dynamodb.Table(ai_labels_table_name)

        # Query for the label that was just stored
        print(f">>> Retrieving stored label: {request.episode_id} v1", flush=True)

        try:
            response = ai_labels_table.get_item(Key={
                "episodeId": request.episode_id,
                "version": 1
            })
            if "Item" in response:
                item = response["Item"]
                print(f">>> Found stored label in DynamoDB", flush=True)

                # Convert Decimal to float for JSON serialization
                def decimal_to_float(obj):
                    if isinstance(obj, Decimal):
                        return float(obj)
                    elif isinstance(obj, dict):
                        return {k: decimal_to_float(v) for k, v in obj.items()}
                    elif isinstance(obj, list):
                        return [decimal_to_float(item) for item in obj]
                    return obj

                # Extract the label structure
                result_data = {
                    "primaryTic": decimal_to_float(item.get("primaryTic")),
                    "secondaryTics": decimal_to_float(item.get("secondaryTics")),
                    "severity": int(item.get("severity", 3)),
                    "observations": decimal_to_float(item.get("observations", [])),
                }
                print(f">>> Extracted label data: {result_data}", flush=True)
            else:
                print(f">>> Label not found in DynamoDB, using fallback", flush=True)
                # Fallback to empty structure
                result_data = {
                    "primaryTic": None,
                    "severity": 3,
                    "observations": [],
                }
        except Exception as e:
            print(f">>> Error retrieving label from DynamoDB: {str(e)}", flush=True)
            # Fallback
            result_data = {
                "primaryTic": None,
                "severity": 3,
                "observations": [],
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
