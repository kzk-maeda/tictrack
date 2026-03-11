"""
Report Aggregator Lambda Handler

Aggregates weekly tic episode data for report generation.
"""

import json
import os
from datetime import datetime, timezone
from typing import List, Dict, Any
from decimal import Decimal
import boto3
from boto3.dynamodb.conditions import Key

# Environment variables
EPISODES_TABLE = os.environ.get("EPISODES_TABLE", "Episodes")
TIC_CARDS_TABLE = os.environ.get("TIC_CARDS_TABLE", "TicCards")
REPORTS_TABLE = os.environ.get("REPORTS_TABLE", "Reports")
REGION = os.environ.get("AWS_REGION", "ap-northeast-1")

# DynamoDB client
dynamodb = boto3.resource("dynamodb", region_name=REGION)


# Custom JSON encoder for Decimal types
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)


def fetch_weekly_episodes(
    child_id: str, week_start: str, week_end: str
) -> List[Dict[str, Any]]:
    """
    Fetch episodes for a specific week using GSI: childId-occurredAt-index
    """
    table = dynamodb.Table(EPISODES_TABLE)

    response = table.query(
        IndexName="childId-occurredAt-index",
        KeyConditionExpression=Key("childId").eq(child_id)
        & Key("occurredAt").between(week_start, week_end),
    )

    return response.get("Items", [])


def calculate_basic_stats(
    episodes: List[Dict[str, Any]], week_start: str, week_end: str
) -> Dict[str, Any]:
    """
    Calculate basic statistics with missing-data tolerance
    """
    total_episodes = len(episodes)

    # Calculate recorded days
    if total_episodes == 0:
        recorded_days = 0
    else:
        unique_dates = set(
            datetime.fromisoformat(ep["occurredAt"].replace("Z", "+00:00"))
            .date()
            .isoformat()
            for ep in episodes
        )
        recorded_days = len(unique_dates)

    # Calculate week length (7 days)
    week_days = 7
    missing_days = week_days - recorded_days

    # Calculate average per recorded day
    avg_per_recorded_day = total_episodes / recorded_days if recorded_days > 0 else 0

    # Calculate data completeness percentage
    data_completeness = f"{(recorded_days / week_days * 100):.1f}%"

    return {
        "totalEpisodes": total_episodes,
        "recordedDays": recorded_days,
        "missingDays": missing_days,
        "avgPerRecordedDay": Decimal(str(round(avg_per_recorded_day, 2))),
        "dataCompleteness": data_completeness,
    }


def calculate_type_distribution(episodes: List[Dict[str, Any]]) -> Dict[str, int]:
    """
    Calculate type distribution (motor/vocal/both)
    """
    distribution = {"motor": 0, "vocal": 0, "both": 0}

    for episode in episodes:
        tic_type = episode.get("type", "motor")
        if tic_type in distribution:
            distribution[tic_type] += 1

    return distribution


def calculate_severity_distribution(episodes: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calculate severity distribution (1-3 scale) with average
    """
    distribution = {"1": 0, "2": 0, "3": 0}
    total_severity = 0

    for episode in episodes:
        severity = episode.get("severity", 1)
        severity_str = str(severity)
        if severity_str in distribution:
            distribution[severity_str] += 1
        total_severity += severity

    average_severity = total_severity / len(episodes) if episodes else 0

    return {
        "1": distribution["1"],
        "2": distribution["2"],
        "3": distribution["3"],
        "average": Decimal(str(round(average_severity, 2))),
    }


def calculate_time_pattern(episodes: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calculate time pattern for 6-hour slots (06-12, 12-18, 18-22, 22-06)
    """
    pattern = {"06-12": 0, "12-18": 0, "18-22": 0, "22-06": 0}

    for episode in episodes:
        occurred_at = datetime.fromisoformat(
            episode["occurredAt"].replace("Z", "+00:00")
        )
        hour = occurred_at.hour

        if 6 <= hour < 12:
            pattern["06-12"] += 1
        elif 12 <= hour < 18:
            pattern["12-18"] += 1
        elif 18 <= hour < 22:
            pattern["18-22"] += 1
        else:  # 22-06 (night)
            pattern["22-06"] += 1

    # Find peak time slot (prefer later slots when counts are equal)
    peak_time_map = {
        "06-12": "06:00-12:00",
        "12-18": "12:00-18:00",
        "18-22": "18:00-22:00",
        "22-06": "22:00-06:00",
    }

    slot_order = ["06-12", "12-18", "18-22", "22-06"]
    max_count = max(pattern.values()) if episodes else 0

    # Find the last slot with max count (prefer later time slots)
    peak_slot = None
    if max_count > 0:
        for slot in reversed(slot_order):
            if pattern[slot] == max_count:
                peak_slot = slot
                break

    result = {**pattern}
    if peak_slot:
        result["peakTime"] = peak_time_map[peak_slot]

    return result


def extract_most_frequent_tics(
    episodes: List[Dict[str, Any]], child_id: str
) -> List[Dict[str, Any]]:
    """
    Extract most frequent tics (top 5) with symptom name mapping
    """
    # Count tic card frequency
    tic_card_counts = {}
    for episode in episodes:
        tic_card_id = episode.get("ticCardId")
        if tic_card_id:
            tic_card_counts[tic_card_id] = tic_card_counts.get(tic_card_id, 0) + 1

    if not tic_card_counts:
        return []

    # Fetch tic card details for symptom names
    tic_cards_table = dynamodb.Table(TIC_CARDS_TABLE)
    tic_card_map = {}

    for card_id in tic_card_counts.keys():
        try:
            response = tic_cards_table.get_item(
                Key={"childId": child_id, "cardId": card_id}
            )
            if "Item" in response:
                item = response["Item"]
                symptom_name = item.get("label", "Unknown tic")
                tic_card_map[card_id] = symptom_name
            else:
                tic_card_map[card_id] = "Unknown tic"
        except Exception:
            tic_card_map[card_id] = "Unknown tic"

    # Sort by frequency and take top 5
    frequent_tics = [
        {"symptom": tic_card_map.get(card_id, "Unknown tic"), "count": count}
        for card_id, count in sorted(
            tic_card_counts.items(), key=lambda x: x[1], reverse=True
        )[:5]
    ]

    return frequent_tics


def save_aggregation_result(
    child_id: str,
    report_id: str,
    week_start: str,
    week_end: str,
    aggregation: Dict[str, Any],
) -> None:
    """
    Save aggregation result to Reports table with status 'processing'
    """
    reports_table = dynamodb.Table(REPORTS_TABLE)

    now = datetime.now(timezone.utc).isoformat()

    item = {
        "childId": child_id,
        "reportId": report_id,
        "reportType": "weekly",
        "weekStart": week_start,
        "weekEnd": week_end,
        "status": "processing",
        "basicStats": aggregation.get("basicStats", {}),
        "typeDistribution": aggregation.get("typeDistribution", {}),
        "severityDistribution": aggregation.get("severityDistribution", {}),
        "timePattern": aggregation.get("timePattern", {}),
        "mostFrequentTics": aggregation.get("mostFrequentTics", []),
        "createdAt": now,
        "updatedAt": now,
    }

    reports_table.put_item(Item=item)


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for report aggregation

    Input event:
    {
        "childId": "child_123",
        "weekStart": "2026-03-03T00:00:00Z",
        "weekEnd": "2026-03-09T23:59:59Z",
        "reportId": "WEEKLY#2026-10"
    }

    Output:
    {
        "statusCode": 200,
        "body": JSON string with aggregation result
    }
    """
    try:
        child_id = event["childId"]
        week_start = event["weekStart"]
        week_end = event["weekEnd"]
        report_id = event["reportId"]

        # 1. Fetch weekly episodes
        episodes = fetch_weekly_episodes(child_id, week_start, week_end)

        # 2. Calculate aggregations
        basic_stats = calculate_basic_stats(episodes, week_start, week_end)
        type_distribution = calculate_type_distribution(episodes)
        severity_distribution = calculate_severity_distribution(episodes)
        time_pattern = calculate_time_pattern(episodes)
        most_frequent_tics = extract_most_frequent_tics(episodes, child_id)

        # 3. Combine aggregation results
        aggregation = {
            "basicStats": basic_stats,
            "typeDistribution": type_distribution,
            "severityDistribution": severity_distribution,
            "timePattern": time_pattern,
            "mostFrequentTics": most_frequent_tics,
        }

        # 4. Save to Reports table
        save_aggregation_result(child_id, report_id, week_start, week_end, aggregation)

        # 5. Return success response
        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "childId": child_id,
                    "reportId": report_id,
                    "aggregation": aggregation,
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
