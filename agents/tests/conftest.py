"""
Shared pytest fixtures for TicTrack agent tests

This file provides shared fixtures to reduce test setup overhead.
"""

import pytest
from unittest.mock import MagicMock, patch
import boto3
from moto import mock_aws


@pytest.fixture(scope="function")
def mock_dynamodb():
    """
    Provide a mocked DynamoDB resource for tests

    Scope: function (isolated per test)
    """
    with mock_aws():
        dynamodb = boto3.resource("dynamodb", region_name="us-east-1")

        # Create test tables
        _create_test_tables(dynamodb)

        yield dynamodb


@pytest.fixture(scope="function")
def mock_bedrock_client():
    """
    Provide a mocked Bedrock Runtime client

    Scope: function (isolated per test)
    """
    mock_client = MagicMock()
    with patch("boto3.client") as mock_boto_client:
        mock_boto_client.return_value = mock_client
        yield mock_client


@pytest.fixture(scope="function")
def mock_transcribe_client():
    """
    Provide a mocked Transcribe client

    Scope: function (isolated per test)
    """
    mock_client = MagicMock()
    with patch("tic_labeling.tools.transcribe_audio.transcribe_client", mock_client):
        yield mock_client


def _create_test_tables(dynamodb):
    """
    Create test DynamoDB tables

    This is a helper function to set up tables for testing.
    Tables are created fresh for each test to ensure isolation.
    """
    # AILabels table
    dynamodb.create_table(
        TableName="AILabels-dev",
        KeySchema=[
            {"AttributeName": "labelId", "KeyType": "HASH"},
        ],
        AttributeDefinitions=[
            {"AttributeName": "labelId", "AttributeType": "S"},
        ],
        BillingMode="PAY_PER_REQUEST",
    )

    # Episodes table
    dynamodb.create_table(
        TableName="Episodes-dev",
        KeySchema=[
            {"AttributeName": "episodeId", "KeyType": "HASH"},
        ],
        AttributeDefinitions=[
            {"AttributeName": "episodeId", "AttributeType": "S"},
        ],
        BillingMode="PAY_PER_REQUEST",
    )
