"""
Guardrails Tool using Amazon Bedrock Guardrails

This tool applies safety guardrails to ensure AI-generated content is non-diagnostic
and uses only observational language.
"""

import boto3
import json
import os
from strands import tool
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

# Lazy-load Bedrock Runtime client
_bedrock_runtime = None

def _get_bedrock_client():
    """Get or create Bedrock Runtime client with current AWS_REGION"""
    global _bedrock_runtime
    if _bedrock_runtime is None:
        region = os.getenv("AWS_REGION", "us-east-1")
        _bedrock_runtime = boto3.client("bedrock-runtime", region_name=region)
        logger.info(f"Initialized Bedrock client in region: {region}")
    return _bedrock_runtime

# Guardrail ID and version (to be created in Step 4 implementation)
# For now, use a placeholder - will be updated after guardrail creation
GUARDRAIL_ID = "tictrack-guardrail"
GUARDRAIL_VERSION = "DRAFT"


@tool
def apply_guardrails(label_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Apply Bedrock Guardrails to ensure safe, non-diagnostic language in labels.

    This tool checks that the label:
    - Uses only observational language (e.g., "appears to show", "may indicate")
    - Avoids medical diagnoses (e.g., "has Tourette syndrome")
    - Avoids treatment recommendations (e.g., "should take medication")
    - Avoids causal assertions (e.g., "stress causes tics")
    - Avoids prognostic statements (e.g., "will worsen over time")

    Args:
        label_data: The integrated label data to validate

    Returns:
        Validated label with guardrail results:
        {
            "label": {...},  # Original or sanitized label
            "guardrail_passed": true/false,
            "blocked_content": [...],  # List of blocked phrases if any
            "action_taken": "NONE|BLOCKED|SANITIZED"
        }
    """
    try:
        logger.info("Applying Bedrock Guardrails to label")

        # Extract text content to validate
        text_to_validate = _extract_text_content(label_data)

        # Apply guardrails using Bedrock
        bedrock_client = _get_bedrock_client()
        try:
            response = bedrock_client.apply_guardrail(
                guardrailIdentifier=GUARDRAIL_ID,
                guardrailVersion=GUARDRAIL_VERSION,
                source="INPUT",
                content=[
                    {
                        "text": {"text": text_to_validate}
                    }
                ]
            )

            # Check guardrail action
            action = response.get("action", "NONE")

            if action == "GUARDRAIL_INTERVENED":
                # Content was blocked
                assessments = response.get("assessments", [])
                blocked_content = _extract_blocked_content(assessments)

                logger.warning(f"Guardrail blocked content: {blocked_content}")

                # Sanitize the label
                sanitized_label = _sanitize_label(label_data, blocked_content)

                return {
                    "label": sanitized_label,
                    "guardrail_passed": False,
                    "blocked_content": blocked_content,
                    "action_taken": "SANITIZED"
                }
            else:
                # Content passed guardrails
                logger.info("Label passed guardrail checks")
                return {
                    "label": label_data,
                    "guardrail_passed": True,
                    "blocked_content": [],
                    "action_taken": "NONE"
                }

        except (bedrock_client.exceptions.ResourceNotFoundException,
                bedrock_client.exceptions.ValidationException) as e:
            # Guardrail not configured yet or misconfigured - use fallback validation
            logger.warning(f"Guardrail not available ({type(e).__name__}), using fallback validation")
            return _fallback_validation(label_data)

    except Exception as e:
        logger.error(f"Error applying guardrails: {str(e)}")
        # On error, use fallback validation
        return _fallback_validation(label_data)


def _extract_text_content(label_data: Dict[str, Any]) -> str:
    """Extract all text content from label for validation"""
    texts = []

    # Add context
    if "context" in label_data:
        texts.append(label_data["context"])

    # Add observation descriptions
    for obs in label_data.get("observations", []):
        if "description" in obs:
            texts.append(obs["description"])

    # Add transcript
    if "transcript" in label_data and label_data["transcript"]:
        texts.append(f"Transcript: {label_data['transcript']}")

    return "\n".join(texts)


def _extract_blocked_content(assessments: list) -> list:
    """Extract blocked content from guardrail assessments"""
    blocked = []
    for assessment in assessments:
        for topic_policy in assessment.get("topicPolicy", {}).get("topics", []):
            if topic_policy.get("action") == "BLOCKED":
                blocked.append({
                    "type": topic_policy.get("type"),
                    "name": topic_policy.get("name")
                })
    return blocked


def _sanitize_label(label_data: Dict[str, Any], blocked_content: list) -> Dict[str, Any]:
    """
    Sanitize label by replacing problematic language with observational language
    """
    sanitized = label_data.copy()

    # Add warning to context
    sanitized["context"] = f"[Observational note] {sanitized.get('context', '')}"

    # Sanitize observation descriptions
    if "observations" in sanitized:
        for obs in sanitized["observations"]:
            if "description" in obs:
                obs["description"] = _sanitize_text(obs["description"])

    # Add metadata about sanitization
    if "metadata" not in sanitized:
        sanitized["metadata"] = {}
    sanitized["metadata"]["guardrail_sanitized"] = True
    sanitized["metadata"]["blocked_topics"] = blocked_content

    return sanitized


def _sanitize_text(text: str) -> str:
    """Replace diagnostic language with observational language"""
    # Replace common diagnostic terms
    replacements = {
        "診断": "観察",
        "病気": "症状",
        "治療": "対応",
        "薬": "サポート",
        "is diagnosed": "appears to show",
        "has": "may have",
        "should": "could consider",
        "will": "may",
        "causes": "is associated with",
    }

    sanitized = text
    for old, new in replacements.items():
        sanitized = sanitized.replace(old, new)

    return sanitized


def _fallback_validation(label_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Fallback validation when Bedrock Guardrails is not available

    Uses keyword-based filtering for prohibited terms
    """
    logger.info("Using fallback validation")

    # Prohibited keywords (diagnostic/treatment terms)
    prohibited_keywords = [
        "トゥレット症候群", "tourette", "diagnosis", "disease", "disorder",
        "治療", "treatment", "medication", "薬", "therapy",
        "原因", "cause", "caused by",
        "悪化", "worsen", "deteriorate", "prognosis"
    ]

    text_content = _extract_text_content(label_data).lower()

    # Check for prohibited keywords
    found_violations = []
    for keyword in prohibited_keywords:
        if keyword.lower() in text_content:
            found_violations.append(keyword)

    if found_violations:
        logger.warning(f"Fallback validation found violations: {found_violations}")
        sanitized_label = _sanitize_label(label_data, [
            {"type": "PROHIBITED_TERM", "name": kw} for kw in found_violations
        ])
        return {
            "label": sanitized_label,
            "guardrail_passed": False,
            "blocked_content": found_violations,
            "action_taken": "SANITIZED"
        }
    else:
        return {
            "label": label_data,
            "guardrail_passed": True,
            "blocked_content": [],
            "action_taken": "NONE"
        }
