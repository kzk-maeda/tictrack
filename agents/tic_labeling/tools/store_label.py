"""
Label Storage Tool

This tool stores AI-generated labels in DynamoDB (AILabels and Episodes tables).
"""

import boto3
import os
from datetime import datetime, timezone
from decimal import Decimal
from strands import tool
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

# Lazy-load DynamoDB resource
_dynamodb = None

def _get_dynamodb():
    """Get or create DynamoDB resource with current AWS_REGION"""
    global _dynamodb
    if _dynamodb is None:
        region = os.getenv("AWS_REGION", "us-east-1")
        _dynamodb = boto3.resource("dynamodb", region_name=region)
        logger.info(f"Initialized DynamoDB in region: {region}")
    return _dynamodb


def convert_floats_to_decimal(obj):
    """Convert float values to Decimal for DynamoDB compatibility"""
    if isinstance(obj, float):
        return Decimal(str(obj))
    elif isinstance(obj, dict):
        return {k: convert_floats_to_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_floats_to_decimal(item) for item in obj]
    return obj


@tool
def store_label(
    episode_id: str,
    child_id: str,
    label_data: Dict[str, Any],
    guardrail_result: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Store AI-generated label in DynamoDB.

    This tool:
    1. Saves the label to the AILabels table
    2. Updates the Episodes table with the label and status

    Args:
        episode_id: The episode ID
        child_id: The child ID
        label_data: The validated label data
        guardrail_result: The guardrail validation result

    Returns:
        Storage result:
        {
            "episode_id": "...",
            "version": 1,
            "episode_updated": true/false,
            "status": "completed"
        }
    """
    try:
        logger.info(f"Storing label for episode {episode_id}")

        # Get table names from environment (will be set by Lambda/Amplify)
        # For local testing, use actual sandbox table names
        ai_labels_table_name = os.getenv("AI_LABELS_TABLE", "AILabels")
        episodes_table_name = os.getenv("EPISODES_TABLE", "Episodes")

        dynamodb = _get_dynamodb()
        ai_labels_table = dynamodb.Table(ai_labels_table_name)
        episodes_table = dynamodb.Table(episodes_table_name)

        # Prepare label item for AILabels table (new 2-axis classification structure)
        primary_tic = label_data.get("primaryTic", {})

        label_item = {
            "episodeId": episode_id,
            "version": 1,
            "childId": child_id,
            "modelId": "nova-pro-v1",  # Model used for analysis
            "rawOutput": str(label_data),  # Store full result as string

            # New 2-axis classification structure
            "primaryTic": primary_tic,
            "secondaryTics": label_data.get("secondaryTics"),
            "severity": label_data.get("severity", 3),
            "observations": label_data.get("observations", []),

            # Legacy fields for backward compatibility
            "suggestedType": primary_tic.get("type", "motor"),
            "suggestedSeverity": label_data.get("severity", 3),
            "confidence": primary_tic.get("confidence", 0.7),

            # Metadata
            "metadata": label_data.get("metadata", {}),
            "guardrailPassed": guardrail_result.get("guardrail_passed", False),
            "guardrailAction": guardrail_result.get("action_taken", "NONE"),
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }

        # Convert floats to Decimal for DynamoDB
        label_item = convert_floats_to_decimal(label_item)

        # Save to AILabels table
        ai_labels_table.put_item(Item=label_item)
        logger.info(f"Saved AI label: {episode_id} v1")

        # Update Episodes table with new structure
        update_values = {
            ":status": "ai_suggested",
            ":label": {
                "primaryTic": primary_tic,
                "secondaryTics": label_data.get("secondaryTics"),
                "severity": label_data.get("severity"),
                "observations": label_data.get("observations", [])[:3],  # Store first 3 observations
            },
            ":updatedAt": datetime.now(timezone.utc).isoformat(),
        }
        # Convert floats to Decimal
        update_values = convert_floats_to_decimal(update_values)

        episodes_table.update_item(
            Key={"episodeId": episode_id},
            UpdateExpression=(
                "SET labelStatus = :status, "
                "originalAILabel = :label, "
                "updatedAt = :updatedAt"
            ),
            ExpressionAttributeValues=update_values
        )
        logger.info(f"Updated episode {episode_id} with AI label")

        return {
            "episode_id": episode_id,
            "version": 1,
            "episode_updated": True,
            "status": "completed",
            "label": label_item
        }

    except Exception as e:
        logger.error(f"Error storing label for episode {episode_id}: {str(e)}")
        raise RuntimeError(f"Label storage failed: {str(e)}")
