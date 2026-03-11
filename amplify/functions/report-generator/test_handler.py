"""
TDD Test Suite for Report Generator Lambda

Test Coverage:
1. Fetch aggregation data from Reports table
2. Generate narrative with Claude Haiku
3. Apply Bedrock Guardrails (non-diagnostic filter)
4. Reject outputs containing diagnosis names
5. Save narrative to Reports table
6. Update status to "completed"
7. Handle generation errors
"""

import json
import os
import pytest
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch, call
from moto import mock_aws
import boto3


# Test fixtures
@pytest.fixture
def sample_aggregation():
    """Sample aggregation data from report-aggregator"""
    return {
        "basicStats": {
            "totalEpisodes": 23,
            "recordedDays": 5,
            "missingDays": 2,
            "avgPerRecordedDay": Decimal("4.6"),
            "dataCompleteness": "71.4%",
        },
        "typeDistribution": {"motor": 18, "vocal": 3, "both": 2},
        "severityDistribution": {
            "1": 8,
            "2": 12,
            "3": 3,
            "average": Decimal("1.78"),
        },
        "timePattern": {
            "06-12": 5,
            "12-18": 8,
            "18-22": 10,
            "22-06": 0,
            "peakTime": "18:00-22:00",
        },
        "mostFrequentTics": [
            {"symptom": "Eye blinking", "count": 8},
            {"symptom": "Head jerking", "count": 5},
            {"symptom": "Throat clearing", "count": 4},
        ],
    }


@pytest.fixture
def lambda_event(sample_aggregation):
    """Sample Lambda event from Step Functions"""
    return {
        "childId": "child_123",
        "reportId": "WEEKLY#2026-10",
        "aggregation": sample_aggregation,
    }


@pytest.fixture
def mock_dynamodb():
    """Mock DynamoDB client"""
    with mock_aws():
        dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-1")

        # Create Reports table
        reports_table = dynamodb.create_table(
            TableName="Reports",
            KeySchema=[
                {"AttributeName": "childId", "KeyType": "HASH"},
                {"AttributeName": "reportId", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "childId", "AttributeType": "S"},
                {"AttributeName": "reportId", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )

        yield {
            "resource": dynamodb,
            "reports_table": reports_table,
        }


@pytest.fixture
def sample_claude_response():
    """Sample Claude Haiku response (non-diagnostic)"""
    return {
        "content": [
            {
                "type": "text",
                "text": "今週は23回のエピソードが記録されました。記録のあった5日間では平均4.6回/日でした。18:00-20:00の時間帯に最も多く記録されました（10回）。目のまばたきが最も頻繁に観察されました（8回）。運動性チックが全体の78%を占めました。",
            }
        ]
    }


@pytest.fixture
def sample_diagnostic_response():
    """Sample Claude response with diagnosis name (should be rejected)"""
    return {
        "content": [
            {
                "type": "text",
                "text": "今週の症状はトゥレット症候群の典型的なパターンを示しています。チック障害の診断基準を満たしており、専門医の診察をお勧めします。",
            }
        ]
    }


# Test 1: Fetch aggregation data from Reports table
def test_fetch_aggregation_data(mock_dynamodb, sample_aggregation):
    """Test fetching aggregation data from Reports table"""
    # Setup: Insert report with aggregation data
    table = mock_dynamodb["reports_table"]
    table.put_item(
        Item={
            "childId": "child_123",
            "reportId": "WEEKLY#2026-10",
            "reportType": "weekly",
            "status": "processing",
            "basicStats": sample_aggregation["basicStats"],
            "typeDistribution": sample_aggregation["typeDistribution"],
            "severityDistribution": sample_aggregation["severityDistribution"],
            "timePattern": sample_aggregation["timePattern"],
            "mostFrequentTics": sample_aggregation["mostFrequentTics"],
        }
    )

    from handler import fetch_aggregation_data

    # Execute
    result = fetch_aggregation_data(
        child_id="child_123", report_id="WEEKLY#2026-10"
    )

    # Assert
    assert result is not None
    assert result["basicStats"]["totalEpisodes"] == 23
    assert result["typeDistribution"]["motor"] == 18


# Test 2: Build prompt for Claude Haiku
def test_build_claude_prompt(sample_aggregation):
    """Test building non-diagnostic prompt for Claude Haiku"""
    from handler import build_claude_prompt

    # Execute
    prompt = build_claude_prompt(sample_aggregation)

    # Assert
    assert "診断名" in prompt  # Should mention to avoid diagnosis names
    assert "観察事実" in prompt  # Should mention observation facts
    assert "相関関係と因果関係を区別" in prompt  # Correlation vs causation
    assert "治療推奨をしない" in prompt  # No treatment recommendations
    assert "23" in prompt  # Should include total episodes
    assert "18:00-22:00" in prompt  # Should include peak time


# Test 3: Generate narrative with Claude Haiku
@patch("handler.bedrock")
def test_generate_narrative_with_claude(mock_bedrock, sample_aggregation, sample_claude_response):
    """Test narrative generation with Claude Haiku via Bedrock"""
    # Setup: Mock Bedrock client
    mock_bedrock.converse.return_value = sample_claude_response

    from handler import generate_narrative_with_claude

    # Execute
    narrative = generate_narrative_with_claude(sample_aggregation)

    # Assert
    assert narrative is not None
    assert "今週は23回のエピソードが記録されました" in narrative
    assert "目のまばたき" in narrative
    mock_bedrock.converse.assert_called_once()

    # Verify model ID is Claude Haiku
    call_args = mock_bedrock.converse.call_args
    assert call_args[1]["modelId"] == "anthropic.claude-3-haiku-20240307-v1:0"


# Test 4: Apply Bedrock Guardrails
@patch("handler.bedrock")
def test_apply_guardrails_accept(mock_bedrock, sample_claude_response):
    """Test Bedrock Guardrails accepting non-diagnostic content"""
    # Mock guardrails response (ACCEPTED)
    mock_bedrock.apply_guardrail.return_value = {
        "action": "GUARDRAIL_INTERVENED",
        "outputs": [
            {
                "text": sample_claude_response["content"][0]["text"]
            }
        ]
    }

    from handler import apply_guardrails

    text = sample_claude_response["content"][0]["text"]

    # Execute
    result = apply_guardrails(text)

    # Assert
    assert result["accepted"] is True
    assert result["text"] == text


# Test 5: Reject outputs containing diagnosis names
@patch("handler.GUARDRAIL_ID", "test-guardrail-id")
@patch("handler.bedrock")
def test_apply_guardrails_reject(mock_bedrock, sample_diagnostic_response):
    """Test Bedrock Guardrails rejecting diagnostic content"""
    # Mock guardrails response (BLOCKED)
    mock_bedrock.apply_guardrail.return_value = {
        "action": "GUARDRAIL_INTERVENED",
        "outputs": []  # Empty outputs = blocked
    }

    from handler import apply_guardrails

    text = sample_diagnostic_response["content"][0]["text"]

    # Execute
    result = apply_guardrails(text)

    # Assert
    assert result["accepted"] is False
    assert result["reason"] == "Content blocked by guardrails"


# Test 6: Extract key findings from narrative
def test_extract_key_findings():
    """Test extracting key findings from narrative text"""
    from handler import extract_key_findings

    narrative = """
    今週は23回のエピソードが記録されました。
    記録のあった5日間では平均4.6回/日でした。
    18:00-20:00の時間帯に最も多く記録されました。
    目のまばたきが最も頻繁に観察されました（8回）。
    運動性チックが全体の78%を占めました。
    """

    # Execute
    findings = extract_key_findings(narrative, total_episodes=23, recorded_days=5)

    # Assert
    assert len(findings) >= 3
    assert any("18:00-20:00" in f for f in findings)
    assert any("目のまばたき" in f for f in findings)
    assert any("運動性チック" in f for f in findings)


# Test 7: Save narrative to Reports table
def test_save_narrative(mock_dynamodb, sample_aggregation):
    """Test saving generated narrative to Reports table"""
    # Setup: Insert report with aggregation data
    table = mock_dynamodb["reports_table"]
    table.put_item(
        Item={
            "childId": "child_123",
            "reportId": "WEEKLY#2026-10",
            "reportType": "weekly",
            "status": "processing",
            "basicStats": sample_aggregation["basicStats"],
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }
    )

    from handler import save_narrative

    narrative = {
        "summary": "今週は23回のエピソードが記録されました...",
        "keyFindings": [
            "18:00-20:00の時間帯に最も多く記録されました",
            "目のまばたきが最も頻繁に観察されました（8回）",
            "運動性チックが全体の78%を占めました",
        ],
        "dataQuality": "週7日のうち5日間の記録があり、データ完全性は71.4%です。",
    }

    # Execute
    save_narrative(
        child_id="child_123",
        report_id="WEEKLY#2026-10",
        narrative=narrative,
    )

    # Assert: Verify data is saved with status "completed"
    response = table.get_item(
        Key={"childId": "child_123", "reportId": "WEEKLY#2026-10"}
    )

    assert "Item" in response
    item = response["Item"]
    assert item["status"] == "completed"
    assert item["narrative"]["summary"] == narrative["summary"]
    assert len(item["narrative"]["keyFindings"]) == 3
    assert "updatedAt" in item


# Test 8: Lambda handler integration test
@patch("handler.bedrock")
def test_lambda_handler(
    mock_bedrock, mock_dynamodb, lambda_event, sample_claude_response
):
    """Test complete Lambda handler flow"""
    # Setup: Mock Bedrock client
    mock_bedrock.converse.return_value = sample_claude_response
    mock_bedrock.apply_guardrail.return_value = {
        "action": "GUARDRAIL_INTERVENED",
        "outputs": [{"text": sample_claude_response["content"][0]["text"]}],
    }

    # Setup: Insert report with aggregation data
    table = mock_dynamodb["reports_table"]
    table.put_item(
        Item={
            "childId": lambda_event["childId"],
            "reportId": lambda_event["reportId"],
            "reportType": "weekly",
            "status": "processing",
            "basicStats": lambda_event["aggregation"]["basicStats"],
            "typeDistribution": lambda_event["aggregation"]["typeDistribution"],
            "severityDistribution": lambda_event["aggregation"]["severityDistribution"],
            "timePattern": lambda_event["aggregation"]["timePattern"],
            "mostFrequentTics": lambda_event["aggregation"]["mostFrequentTics"],
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }
    )

    from handler import handler

    # Execute
    response = handler(lambda_event, None)

    # Assert
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["childId"] == "child_123"
    assert body["reportId"] == "WEEKLY#2026-10"
    assert body["status"] == "completed"
    assert "narrative" in body


# Test 9: Handle generation errors
@patch("handler.bedrock")
def test_handle_generation_error(mock_bedrock, lambda_event):
    """Test error handling when Claude generation fails"""
    # Setup: Mock Bedrock client to raise exception
    mock_bedrock.converse.side_effect = Exception("Bedrock API error")

    from handler import handler

    # Execute
    response = handler(lambda_event, None)

    # Assert
    assert response["statusCode"] == 500
    body = json.loads(response["body"])
    assert "error" in body


# Test 10: Handle guardrail rejection (retry logic)
@patch("handler.GUARDRAIL_ID", "test-guardrail-id")
@patch("handler.bedrock")
def test_handle_guardrail_rejection_retry(
    mock_bedrock, sample_aggregation, sample_diagnostic_response, sample_claude_response
):
    """Test retry logic when guardrails reject the first attempt"""
    # First attempt: diagnostic content (rejected)
    # Second attempt: clean content (accepted)
    mock_bedrock.converse.side_effect = [
        sample_diagnostic_response,
        sample_claude_response,
    ]

    # Guardrail responses
    mock_bedrock.apply_guardrail.side_effect = [
        {"action": "GUARDRAIL_INTERVENED", "outputs": []},  # Rejected
        {
            "action": "GUARDRAIL_INTERVENED",
            "outputs": [{"text": sample_claude_response["content"][0]["text"]}],
        },  # Accepted
    ]

    from handler import generate_narrative_with_retry

    # Execute
    narrative = generate_narrative_with_retry(sample_aggregation, max_retries=3)

    # Assert
    assert narrative is not None
    assert "今週は23回のエピソードが記録されました" in narrative
    assert mock_bedrock.converse.call_count == 2  # Retried once
