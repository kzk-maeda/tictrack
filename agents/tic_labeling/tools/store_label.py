"""
Label Storage Tool

This tool stores AI-generated labels in DynamoDB (AILabels and Episodes tables).
"""

import boto3
from datetime import datetime
from strands import tool
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

# Initialize DynamoDB client
dynamodb = boto3.resource("dynamodb", region_name="us-east-1")


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
            "ai_label_id": "...",
            "episode_updated": true/false,
            "status": "completed"
        }
    """
    try:
        logger.info(f"Storing label for episode {episode_id}")

        # Get table names from environment (will be set by Lambda/Amplify)
        # For now, use placeholders
        ai_labels_table_name = "AILabels-dev"
        episodes_table_name = "Episodes-dev"

        ai_labels_table = dynamodb.Table(ai_labels_table_name)
        episodes_table = dynamodb.Table(episodes_table_name)

        # Generate AI label ID
        ai_label_id = f"{episode_id}-v1"

        # Prepare label item for AILabels table
        label_item = {
            "labelId": ai_label_id,
            "episodeId": episode_id,
            "childId": child_id,
            "version": 1,
            "type": label_data.get("type", "motor"),
            "severity": label_data.get("severity", 2),
            "context": label_data.get("context", ""),
            "observations": label_data.get("observations", []),
            "transcript": label_data.get("transcript", ""),
            "confidence": label_data.get("confidence", 0.7),
            "metadata": label_data.get("metadata", {}),
            "guardrailPassed": guardrail_result.get("guardrail_passed", False),
            "guardrailAction": guardrail_result.get("action_taken", "NONE"),
            "createdAt": datetime.utcnow().isoformat(),
        }

        # Save to AILabels table
        ai_labels_table.put_item(Item=label_item)
        logger.info(f"Saved AI label: {ai_label_id}")

        # Update Episodes table
        episodes_table.update_item(
            Key={"episodeId": episode_id},
            UpdateExpression=(
                "SET labelStatus = :status, "
                "originalAILabel = :label, "
                "updatedAt = :updatedAt"
            ),
            ExpressionAttributeValues={
                ":status": "ai_suggested",
                ":label": {
                    "type": label_data.get("type"),
                    "severity": label_data.get("severity"),
                    "context": label_data.get("context"),
                    "confidence": label_data.get("confidence"),
                },
                ":updatedAt": datetime.utcnow().isoformat(),
            }
        )
        logger.info(f"Updated episode {episode_id} with AI label")

        return {
            "ai_label_id": ai_label_id,
            "episode_updated": True,
            "status": "completed",
            "label": label_item
        }

    except Exception as e:
        logger.error(f"Error storing label for episode {episode_id}: {str(e)}")
        raise RuntimeError(f"Label storage failed: {str(e)}")
