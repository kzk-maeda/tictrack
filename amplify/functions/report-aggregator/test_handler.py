"""
TDD Test Suite for Report Aggregator Lambda

Test Coverage:
1. Fetch weekly episodes from DynamoDB
2. Calculate basic statistics (missing-data tolerant)
3. Calculate type distribution (motor/vocal/both)
4. Calculate severity distribution (1-3 scale)
5. Calculate time pattern (6-hour slots)
6. Extract most frequent tics (top 5)
7. Save aggregation result to Reports table
"""

import json
import pytest
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch
from moto import mock_aws
import boto3


# Test fixtures
@pytest.fixture
def sample_episodes():
    """Sample episode data for a week"""
    return [
        {
            "episodeId": "ep1",
            "childId": "child_123",
            "occurredAt": "2026-03-03T08:30:00Z",
            "type": "motor",
            "severity": 2,
            "ticCardId": "card1",
        },
        {
            "episodeId": "ep2",
            "childId": "child_123",
            "occurredAt": "2026-03-03T14:15:00Z",
            "type": "motor",
            "severity": 1,
            "ticCardId": "card1",
        },
        {
            "episodeId": "ep3",
            "childId": "child_123",
            "occurredAt": "2026-03-04T19:45:00Z",
            "type": "vocal",
            "severity": 3,
            "ticCardId": "card2",
        },
        {
            "episodeId": "ep4",
            "childId": "child_123",
            "occurredAt": "2026-03-05T20:00:00Z",
            "type": "both",
            "severity": 2,
            "ticCardId": "card3",
        },
        {
            "episodeId": "ep5",
            "childId": "child_123",
            "occurredAt": "2026-03-06T07:30:00Z",
            "type": "motor",
            "severity": 1,
            "ticCardId": "card1",
        },
    ]


@pytest.fixture
def sample_tic_cards():
    """Sample tic card data for symptom mapping"""
    return [
        {
            "cardId": "card1",
            "symptomId": "eye_blinking",
            "label": "Eye blinking",
        },
        {
            "cardId": "card2",
            "symptomId": "throat_clearing",
            "label": "Throat clearing",
        },
        {
            "cardId": "card3",
            "symptomId": "head_jerking",
            "label": "Head jerking",
        },
    ]


@pytest.fixture
def lambda_event():
    """Sample Lambda event from Step Functions"""
    return {
        "childId": "child_123",
        "weekStart": "2026-03-03T00:00:00Z",
        "weekEnd": "2026-03-09T23:59:59Z",
        "reportId": "WEEKLY#2026-10",
    }


@pytest.fixture
def mock_dynamodb():
    """Mock DynamoDB client"""
    with mock_aws():
        dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-1")

        # Create Episodes table
        episodes_table = dynamodb.create_table(
            TableName="Episodes",
            KeySchema=[
                {"AttributeName": "childId", "KeyType": "HASH"},
                {"AttributeName": "episodeId", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "childId", "AttributeType": "S"},
                {"AttributeName": "episodeId", "AttributeType": "S"},
                {"AttributeName": "occurredAt", "AttributeType": "S"},
            ],
            GlobalSecondaryIndexes=[
                {
                    "IndexName": "childId-occurredAt-index",
                    "KeySchema": [
                        {"AttributeName": "childId", "KeyType": "HASH"},
                        {"AttributeName": "occurredAt", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                }
            ],
            BillingMode="PAY_PER_REQUEST",
        )

        # Create TicCards table
        tic_cards_table = dynamodb.create_table(
            TableName="TicCards",
            KeySchema=[
                {"AttributeName": "childId", "KeyType": "HASH"},
                {"AttributeName": "cardId", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "childId", "AttributeType": "S"},
                {"AttributeName": "cardId", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )

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
            "episodes_table": episodes_table,
            "tic_cards_table": tic_cards_table,
            "reports_table": reports_table,
        }


# Test 1: Fetch weekly episodes from DynamoDB
def test_fetch_weekly_episodes(mock_dynamodb, sample_episodes, lambda_event):
    """Test that weekly episodes are correctly fetched from DynamoDB"""
    # Setup: Insert sample episodes
    table = mock_dynamodb["episodes_table"]
    for episode in sample_episodes:
        table.put_item(Item=episode)

    # Import handler after mock is set up
    from handler import fetch_weekly_episodes

    # Execute
    result = fetch_weekly_episodes(
        child_id=lambda_event["childId"],
        week_start=lambda_event["weekStart"],
        week_end=lambda_event["weekEnd"],
    )

    # Assert
    assert len(result) == 5
    assert all(ep["childId"] == "child_123" for ep in result)
    assert all("occurredAt" in ep for ep in result)


# Test 2: Calculate basic statistics with missing data tolerance
def test_calculate_basic_stats(sample_episodes):
    """Test basic statistics calculation with missing data handling"""
    from handler import calculate_basic_stats

    # Execute
    stats = calculate_basic_stats(
        episodes=sample_episodes,
        week_start="2026-03-03T00:00:00Z",
        week_end="2026-03-09T23:59:59Z",
    )

    # Assert
    assert stats["totalEpisodes"] == 5
    assert stats["recordedDays"] == 4  # 3rd, 4th, 5th, 6th
    assert stats["missingDays"] == 3  # 7th, 8th, 9th
    assert stats["avgPerRecordedDay"] == pytest.approx(1.25)  # 5 / 4
    assert stats["dataCompleteness"] == "57.1%"  # 4 / 7


# Test 3: Calculate type distribution
def test_calculate_type_distribution(sample_episodes):
    """Test type distribution (motor/vocal/both) calculation"""
    from handler import calculate_type_distribution

    # Execute
    distribution = calculate_type_distribution(sample_episodes)

    # Assert
    assert distribution["motor"] == 3
    assert distribution["vocal"] == 1
    assert distribution["both"] == 1


# Test 4: Calculate severity distribution
def test_calculate_severity_distribution(sample_episodes):
    """Test severity distribution (1-3 scale) calculation"""
    from handler import calculate_severity_distribution

    # Execute
    distribution = calculate_severity_distribution(sample_episodes)

    # Assert
    assert distribution["1"] == 2
    assert distribution["2"] == 2
    assert distribution["3"] == 1
    assert float(distribution["average"]) == pytest.approx(1.8)  # (1+1+2+2+3) / 5


# Test 5: Calculate time pattern (6-hour slots)
def test_calculate_time_pattern(sample_episodes):
    """Test time pattern calculation for 6-hour slots"""
    from handler import calculate_time_pattern

    # Execute
    pattern = calculate_time_pattern(sample_episodes)

    # Assert
    assert pattern["06-12"] == 2  # 08:30, 07:30
    assert pattern["12-18"] == 1  # 14:15
    assert pattern["18-22"] == 2  # 19:45, 20:00
    assert pattern["22-06"] == 0
    assert pattern["peakTime"] == "18:00-22:00"


# Test 6: Extract most frequent tics (top 5)
def test_extract_most_frequent_tics(mock_dynamodb, sample_episodes, sample_tic_cards):
    """Test extraction of most frequent tics with symptom name mapping"""
    # Setup: Insert sample tic cards
    table = mock_dynamodb["tic_cards_table"]
    for card in sample_tic_cards:
        card["childId"] = "child_123"
        table.put_item(Item=card)

    from handler import extract_most_frequent_tics

    # Execute
    frequent_tics = extract_most_frequent_tics(
        episodes=sample_episodes,
        child_id="child_123",
    )

    # Assert
    assert len(frequent_tics) <= 5
    assert frequent_tics[0]["symptom"] == "Eye blinking"
    assert frequent_tics[0]["count"] == 3  # card1 appears 3 times
    assert frequent_tics[1]["symptom"] == "Throat clearing"
    assert frequent_tics[1]["count"] == 1


# Test 7: Save aggregation result to Reports table
def test_save_aggregation_result(mock_dynamodb, lambda_event):
    """Test saving aggregation result to Reports table"""
    from handler import save_aggregation_result

    # Setup: Sample aggregation data (use Decimal for DynamoDB compatibility)
    aggregation = {
        "basicStats": {
            "totalEpisodes": 5,
            "recordedDays": 4,
            "missingDays": 3,
            "avgPerRecordedDay": Decimal("1.25"),
            "dataCompleteness": "57.1%",
        },
        "typeDistribution": {"motor": 3, "vocal": 1, "both": 1},
        "severityDistribution": {"1": 2, "2": 2, "3": 1, "average": Decimal("1.8")},
        "timePattern": {
            "06-12": 2,
            "12-18": 1,
            "18-22": 2,
            "22-06": 0,
            "peakTime": "18:00-22:00",
        },
        "mostFrequentTics": [
            {"symptom": "Eye blinking", "count": 3},
            {"symptom": "Throat clearing", "count": 1},
        ],
    }

    # Execute
    save_aggregation_result(
        child_id=lambda_event["childId"],
        report_id=lambda_event["reportId"],
        week_start=lambda_event["weekStart"],
        week_end=lambda_event["weekEnd"],
        aggregation=aggregation,
    )

    # Assert: Verify data is saved to Reports table
    table = mock_dynamodb["reports_table"]
    response = table.get_item(
        Key={
            "childId": lambda_event["childId"],
            "reportId": lambda_event["reportId"],
        }
    )

    assert "Item" in response
    item = response["Item"]
    assert item["status"] == "processing"
    assert item["basicStats"]["totalEpisodes"] == 5
    assert "createdAt" in item


# Test 8: Lambda handler integration test
def test_lambda_handler(mock_dynamodb, sample_episodes, sample_tic_cards, lambda_event):
    """Test complete Lambda handler flow"""
    # Setup: Insert sample data
    episodes_table = mock_dynamodb["episodes_table"]
    for episode in sample_episodes:
        episodes_table.put_item(Item=episode)

    tic_cards_table = mock_dynamodb["tic_cards_table"]
    for card in sample_tic_cards:
        card["childId"] = "child_123"
        tic_cards_table.put_item(Item=card)

    from handler import handler

    # Execute
    response = handler(lambda_event, None)

    # Assert
    if response["statusCode"] != 200:
        print(f"Error response: {response}")
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["childId"] == "child_123"
    assert body["reportId"] == "WEEKLY#2026-10"
    assert "aggregation" in body
    assert body["aggregation"]["basicStats"]["totalEpisodes"] == 5


# Test 9: Handle empty episodes (edge case)
def test_handle_empty_episodes(lambda_event):
    """Test handling of weeks with no episodes"""
    from handler import calculate_basic_stats

    # Execute with empty episodes
    stats = calculate_basic_stats(
        episodes=[],
        week_start=lambda_event["weekStart"],
        week_end=lambda_event["weekEnd"],
    )

    # Assert
    assert stats["totalEpisodes"] == 0
    assert stats["recordedDays"] == 0
    assert stats["missingDays"] == 7
    assert stats["avgPerRecordedDay"] == 0
    assert stats["dataCompleteness"] == "0.0%"


# Test 10: Handle missing tic card (edge case)
def test_handle_missing_tic_card(mock_dynamodb):
    """Test handling of episodes with deleted tic cards"""
    # Setup: Episode with non-existent tic card
    episodes = [
        {
            "episodeId": "ep1",
            "childId": "child_123",
            "occurredAt": "2026-03-03T08:30:00Z",
            "type": "motor",
            "severity": 2,
            "ticCardId": "deleted_card",
        }
    ]

    from handler import extract_most_frequent_tics

    # Execute
    frequent_tics = extract_most_frequent_tics(
        episodes=episodes,
        child_id="child_123",
    )

    # Assert: Should handle gracefully with fallback label
    assert len(frequent_tics) == 1
    assert frequent_tics[0]["symptom"] == "Unknown tic"
    assert frequent_tics[0]["count"] == 1
