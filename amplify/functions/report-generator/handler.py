"""
Report Generator Lambda Handler

Generates narrative summaries for weekly reports using Claude Haiku
with Bedrock Guardrails for non-diagnostic filtering.
"""

import json
import os
from datetime import datetime, timezone
from typing import Dict, Any, List
from decimal import Decimal
import boto3
from botocore.exceptions import ClientError

# Environment variables
REPORTS_TABLE = os.environ.get("REPORTS_TABLE", "Reports")
REGION = os.environ.get("AWS_REGION", "ap-northeast-1")
GUARDRAIL_ID = os.environ.get("GUARDRAIL_ID", "")
GUARDRAIL_VERSION = os.environ.get("GUARDRAIL_VERSION", "DRAFT")

# AWS clients
dynamodb = boto3.resource("dynamodb", region_name=REGION)
bedrock = boto3.client("bedrock-runtime", region_name=REGION)


# Custom JSON encoder for Decimal types
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)


def fetch_aggregation_data(child_id: str, report_id: str) -> Dict[str, Any]:
    """
    Fetch aggregation data from Reports table
    """
    table = dynamodb.Table(REPORTS_TABLE)

    response = table.get_item(Key={"childId": child_id, "reportId": report_id})

    if "Item" not in response:
        raise ValueError(f"Report not found: {child_id}/{report_id}")

    item = response["Item"]

    # Return aggregation data
    return {
        "basicStats": item.get("basicStats", {}),
        "typeDistribution": item.get("typeDistribution", {}),
        "severityDistribution": item.get("severityDistribution", {}),
        "timePattern": item.get("timePattern", {}),
        "mostFrequentTics": item.get("mostFrequentTics", []),
    }


def build_claude_prompt(aggregation: Dict[str, Any]) -> str:
    """
    Build non-diagnostic prompt for Claude Haiku
    """
    basic_stats = aggregation["basicStats"]
    type_dist = aggregation["typeDistribution"]
    severity_dist = aggregation["severityDistribution"]
    time_pattern = aggregation["timePattern"]
    frequent_tics = aggregation["mostFrequentTics"]

    # Convert Decimal to float for string formatting
    avg_per_day = float(basic_stats.get("avgPerRecordedDay", 0))
    avg_severity = float(severity_dist.get("average", 0))

    prompt = f"""以下は子供のチック症状の週次集計データです。
観察事実のみに基づき、以下の制約に従って200-300字で要約してください。

【重要な制約】
- 診断名を使わないこと（例：トゥレット症候群、チック障害など）
- 観察された事実のみを述べること
- 相関関係と因果関係を区別すること
- 治療推奨をしないこと
- 専門用語を避け、保護者が理解しやすい言葉を使うこと

【データ】
- 総エピソード数: {basic_stats.get('totalEpisodes', 0)}回
- 記録日数: {basic_stats.get('recordedDays', 0)}日（全7日中）
- 1日平均: {avg_per_day}回
- データ完全性: {basic_stats.get('dataCompleteness', 'N/A')}

- タイプ分布:
  - 運動性: {type_dist.get('motor', 0)}回
  - 音声性: {type_dist.get('vocal', 0)}回
  - 両方: {type_dist.get('both', 0)}回

- 重症度分布（1-3スケール）:
  - レベル1: {severity_dist.get('1', 0)}回
  - レベル2: {severity_dist.get('2', 0)}回
  - レベル3: {severity_dist.get('3', 0)}回
  - 平均: {avg_severity}

- 時間帯パターン:
  - 06:00-12:00: {time_pattern.get('06-12', 0)}回
  - 12:00-18:00: {time_pattern.get('12-18', 0)}回
  - 18:00-22:00: {time_pattern.get('18-22', 0)}回
  - 22:00-06:00: {time_pattern.get('22-06', 0)}回
  - ピーク時間帯: {time_pattern.get('peakTime', 'なし')}

- 最も頻繁なチック（上位3つ）:
"""

    for i, tic in enumerate(frequent_tics[:3], 1):
        prompt += f"\n  {i}. {tic['symptom']} - {tic['count']}回"

    prompt += "\n\n観察事実に基づいた要約を日本語で記述してください。"

    return prompt


def generate_narrative_with_claude(aggregation: Dict[str, Any]) -> str:
    """
    Generate narrative using Claude Haiku via Bedrock
    """
    prompt = build_claude_prompt(aggregation)

    # Call Claude Haiku via Bedrock Converse API
    response = bedrock.converse(
        modelId="anthropic.claude-3-haiku-20240307-v1:0",
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={
            "maxTokens": 1000,
            "temperature": 0.3,  # Lower temperature for consistent, factual output
        },
    )

    # Extract text from response
    content = response.get("content", [])
    if not content:
        raise ValueError("Empty response from Claude")

    narrative_text = content[0].get("text", "")
    return narrative_text


def apply_guardrails(text: str) -> Dict[str, Any]:
    """
    Apply Bedrock Guardrails to filter diagnostic content
    """
    if not GUARDRAIL_ID:
        # If no guardrail configured, accept all content
        return {"accepted": True, "text": text}

    try:
        response = bedrock.apply_guardrail(
            guardrailIdentifier=GUARDRAIL_ID,
            guardrailVersion=GUARDRAIL_VERSION,
            source="OUTPUT",
            content=[{"text": {"text": text}}],
        )

        # Check if content was blocked
        outputs = response.get("outputs", [])
        if not outputs:
            return {
                "accepted": False,
                "reason": "Content blocked by guardrails",
            }

        # Extract filtered text
        filtered_text = outputs[0].get("text", text)

        return {"accepted": True, "text": filtered_text}

    except ClientError as e:
        # If guardrail fails, reject to be safe
        return {
            "accepted": False,
            "reason": f"Guardrail error: {str(e)}",
        }


def extract_key_findings(
    narrative: str, total_episodes: int, recorded_days: int
) -> List[str]:
    """
    Extract key findings from narrative text
    """
    findings = []

    # Split narrative into sentences
    sentences = [s.strip() for s in narrative.split("。") if s.strip()]

    # Take first 3-5 sentences as key findings, excluding the first summary sentence
    for sentence in sentences[1:]:
        if len(findings) >= 5:
            break
        if len(sentence) > 10:  # Skip very short sentences
            findings.append(sentence + "。")

    # If we don't have enough findings, add the first sentence too
    if len(findings) < 3 and sentences:
        findings.insert(0, sentences[0] + "。")

    return findings[:5]  # Maximum 5 findings


def save_narrative(
    child_id: str, report_id: str, narrative: Dict[str, Any]
) -> None:
    """
    Save generated narrative to Reports table and update status to "completed"
    """
    table = dynamodb.Table(REPORTS_TABLE)

    now = datetime.now(timezone.utc).isoformat()

    # Update report with narrative and status
    table.update_item(
        Key={"childId": child_id, "reportId": report_id},
        UpdateExpression="SET narrative = :narrative, #status = :status, updatedAt = :updated",
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={
            ":narrative": narrative,
            ":status": "completed",
            ":updated": now,
        },
    )


def generate_narrative_with_retry(
    aggregation: Dict[str, Any], max_retries: int = 3
) -> str:
    """
    Generate narrative with retry logic for guardrail rejections
    """
    for attempt in range(max_retries):
        # Generate narrative
        narrative_text = generate_narrative_with_claude(aggregation)

        # Apply guardrails
        guardrail_result = apply_guardrails(narrative_text)

        if guardrail_result["accepted"]:
            return guardrail_result["text"]

        # If rejected and we have retries left, try again
        if attempt < max_retries - 1:
            continue

    # All retries failed
    raise ValueError("Failed to generate acceptable narrative after retries")


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for report narrative generation

    Input event:
    {
        "childId": "child_123",
        "reportId": "WEEKLY#2026-10",
        "aggregation": {...}
    }

    Output:
    {
        "statusCode": 200,
        "body": JSON string with narrative result
    }
    """
    try:
        child_id = event["childId"]
        report_id = event["reportId"]

        # Get aggregation data (from event or fetch from DB)
        if "aggregation" in event:
            aggregation = event["aggregation"]
        else:
            aggregation = fetch_aggregation_data(child_id, report_id)

        # Generate narrative with retry logic
        narrative_text = generate_narrative_with_retry(aggregation, max_retries=3)

        # Extract key findings
        total_episodes = aggregation["basicStats"].get("totalEpisodes", 0)
        recorded_days = aggregation["basicStats"].get("recordedDays", 0)
        key_findings = extract_key_findings(
            narrative_text, total_episodes, recorded_days
        )

        # Build data quality note
        data_completeness = aggregation["basicStats"].get("dataCompleteness", "N/A")
        data_quality = f"週7日のうち{recorded_days}日間の記録があり、データ完全性は{data_completeness}です。"

        # Prepare narrative object
        narrative = {
            "summary": narrative_text,
            "keyFindings": key_findings,
            "dataQuality": data_quality,
        }

        # Save to Reports table
        save_narrative(child_id, report_id, narrative)

        # Return success response
        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "childId": child_id,
                    "reportId": report_id,
                    "status": "completed",
                    "narrative": narrative,
                },
                cls=DecimalEncoder,
            ),
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps(
                {
                    "error": str(e),
                },
                cls=DecimalEncoder,
            ),
        }
