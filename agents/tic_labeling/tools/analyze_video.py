"""
Video Analysis Tool using Amazon Nova Pro

This tool analyzes tic episode videos using Nova Pro's video understanding capabilities.
"""

import boto3
import json
from strands import tool
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

# Initialize Bedrock Runtime client
bedrock_runtime = boto3.client("bedrock-runtime", region_name="us-east-1")

# Nova Pro model ID
NOVA_PRO_MODEL_ID = "us.amazon.nova-pro-v1:0"


@tool
def analyze_video(s3_key: str, bucket_name: str = "tictrack-media-dev") -> Dict[str, Any]:
    """
    Analyze a video using Amazon Nova Pro to detect tic movements and behaviors.

    Args:
        s3_key: The S3 key of the video file
        bucket_name: The S3 bucket name (default: tictrack-media-dev)

    Returns:
        Dictionary containing structured observations:
        {
            "observations": [
                {
                    "timestamp": "0:05",
                    "description": "Observable movement description",
                    "intensity": "low|medium|high"
                }
            ],
            "suggested_type": "motor|vocal|both",
            "suggested_severity": 1-3,
            "confidence": 0.0-1.0
        }
    """
    try:
        logger.info(f"Analyzing video: s3://{bucket_name}/{s3_key}")

        # Construct S3 URI for Nova Pro
        s3_uri = f"s3://{bucket_name}/{s3_key}"

        # Prepare the request for Nova Pro
        request_body = {
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "video": {
                                "format": "mp4",  # or "webm"
                                "source": {"s3Location": {"uri": s3_uri}}
                            }
                        },
                        {
                            "text": """Analyze this video for tic-like movements or behaviors.

Please observe and describe:
1. Any repetitive movements (motor tics) such as:
   - Eye movements (blinking, rolling, squinting)
   - Facial movements (grimacing, nose twitching, mouth movements)
   - Head movements (jerking, nodding, shaking)
   - Shoulder movements (shrugging, tensing)
   - Arm/hand movements (jerking, finger movements, touching)
   - Leg/foot movements (kicking, tapping, tensing)

2. Any vocalizations or sounds (vocal tics) such as:
   - Throat clearing, coughing, sniffing
   - Grunting, humming, or other sounds
   - Word or phrase repetition

3. For each observation, note:
   - Approximate timestamp in the video
   - Description of the movement or sound
   - Intensity (low, medium, high)
   - Whether it appears repetitive or involuntary

4. Overall assessment:
   - Primary type: motor, vocal, or both
   - Suggested severity: 1 (mild/subtle), 2 (moderate/noticeable), 3 (severe/intense)
   - Your confidence level in these observations

Use only observational language. Do not diagnose or recommend treatment.
Return your response as structured JSON."""
                        }
                    ]
                }
            ],
            "inferenceConfig": {
                "temperature": 0.2,  # Lower temperature for more consistent analysis
                "topP": 0.9,
                "maxTokens": 2048,
            }
        }

        # Invoke Nova Pro
        response = bedrock_runtime.invoke_model(
            modelId=NOVA_PRO_MODEL_ID,
            body=json.dumps(request_body),
            contentType="application/json",
            accept="application/json"
        )

        # Parse response
        response_body = json.loads(response["body"].read())

        # Extract the text content from Nova Pro's response
        if "output" in response_body and "message" in response_body["output"]:
            message = response_body["output"]["message"]
            if "content" in message and len(message["content"]) > 0:
                content_text = message["content"][0].get("text", "")

                # Try to parse as JSON
                try:
                    structured_result = json.loads(content_text)
                    logger.info(f"Successfully analyzed video: {s3_key}")
                    return structured_result
                except json.JSONDecodeError:
                    # If not valid JSON, wrap in a structure
                    logger.warning("Nova Pro returned non-JSON response, wrapping it")
                    return {
                        "observations": [
                            {
                                "timestamp": "unknown",
                                "description": content_text,
                                "intensity": "unknown"
                            }
                        ],
                        "suggested_type": "unknown",
                        "suggested_severity": 2,
                        "confidence": 0.5
                    }

        # Fallback if response structure is unexpected
        raise ValueError(f"Unexpected response structure from Nova Pro: {response_body}")

    except Exception as e:
        logger.error(f"Error analyzing video {s3_key}: {str(e)}")
        raise RuntimeError(f"Video analysis failed: {str(e)}")
