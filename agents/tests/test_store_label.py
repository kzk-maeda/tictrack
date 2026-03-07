"""
Unit tests for store_label tool

Tests DynamoDB storage with mocked boto3 responses.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from tic_labeling.tools.store_label import store_label


class TestStoreLabel:
    """Test suite for label storage tool"""

    def setup_method(self):
        """Setup test fixtures"""
        self.sample_episode_id = "episode-123"
        self.sample_child_id = "child-456"
        self.sample_label = {
            "type": "motor",
            "severity": 2,
            "context": "Eye blinking movements",
            "observations": [
                {
                    "timestamp": "0:05",
                    "description": "Repetitive blinking",
                    "intensity": "medium"
                }
            ],
            "confidence": 0.85,
            "metadata": {}
        }
        self.sample_guardrail_result = {
            "guardrail_passed": True,
            "action_taken": "NONE"
        }

    @patch("tic_labeling.tools.store_label.dynamodb")
    def test_store_label_saves_to_ailabels_table(self, mock_dynamodb):
        """Test that label is saved to AILabels table"""
        # Arrange
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table

        # Act
        result = store_label(
            self.sample_episode_id,
            self.sample_child_id,
            self.sample_label,
            self.sample_guardrail_result
        )

        # Assert
        mock_table.put_item.assert_called_once()
        put_item_args = mock_table.put_item.call_args[1]
        item = put_item_args["Item"]

        assert item["episodeId"] == self.sample_episode_id
        assert item["childId"] == self.sample_child_id
        assert item["type"] == "motor"
        assert item["severity"] == 2
        assert item["version"] == 1

    @patch("tic_labeling.tools.store_label.dynamodb")
    def test_store_label_updates_episodes_table(self, mock_dynamodb):
        """Test that Episodes table is updated with labelStatus"""
        # Arrange
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table

        # Act
        result = store_label(
            self.sample_episode_id,
            self.sample_child_id,
            self.sample_label,
            self.sample_guardrail_result
        )

        # Assert
        # Should call update_item on episodes table
        assert mock_table.update_item.called
        update_args = mock_table.update_item.call_args[1]

        assert update_args["Key"]["episodeId"] == self.sample_episode_id
        assert ":status" in update_args["ExpressionAttributeValues"]
        assert update_args["ExpressionAttributeValues"][":status"] == "ai_suggested"

    @patch("tic_labeling.tools.store_label.dynamodb")
    def test_store_label_sets_labelstatus_to_ai_suggested(self, mock_dynamodb):
        """Test that Episodes.labelStatus is updated to 'ai_suggested'"""
        # Arrange
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table

        # Act
        store_label(
            self.sample_episode_id,
            self.sample_child_id,
            self.sample_label,
            self.sample_guardrail_result
        )

        # Assert
        update_call = mock_table.update_item.call_args[1]
        assert update_call["ExpressionAttributeValues"][":status"] == "ai_suggested"

    @patch("tic_labeling.tools.store_label.dynamodb")
    def test_store_label_includes_original_ai_label(self, mock_dynamodb):
        """Test that originalAILabel is stored in Episodes table"""
        # Arrange
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table

        # Act
        store_label(
            self.sample_episode_id,
            self.sample_child_id,
            self.sample_label,
            self.sample_guardrail_result
        )

        # Assert
        update_call = mock_table.update_item.call_args[1]
        assert ":label" in update_call["ExpressionAttributeValues"]
        original_label = update_call["ExpressionAttributeValues"][":label"]

        assert original_label["type"] == "motor"
        assert original_label["severity"] == 2
        assert "context" in original_label
        assert "confidence" in original_label

    @patch("tic_labeling.tools.store_label.dynamodb")
    def test_store_label_generates_versioned_label_id(self, mock_dynamodb):
        """Test that labelId is generated as episodeId-v1"""
        # Arrange
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table

        # Act
        result = store_label(
            self.sample_episode_id,
            self.sample_child_id,
            self.sample_label,
            self.sample_guardrail_result
        )

        # Assert
        assert result["ai_label_id"] == f"{self.sample_episode_id}-v1"

    @patch("tic_labeling.tools.store_label.dynamodb")
    def test_store_label_returns_completed_status(self, mock_dynamodb):
        """Test that function returns status='completed' on success"""
        # Arrange
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table

        # Act
        result = store_label(
            self.sample_episode_id,
            self.sample_child_id,
            self.sample_label,
            self.sample_guardrail_result
        )

        # Assert
        assert result["status"] == "completed"
        assert result["episode_updated"] is True

    @patch("tic_labeling.tools.store_label.dynamodb")
    def test_store_label_raises_error_on_dynamodb_failure(self, mock_dynamodb):
        """Test that function raises RuntimeError when DynamoDB operation fails"""
        # Arrange
        mock_table = MagicMock()
        mock_table.put_item.side_effect = Exception("DynamoDB Error")
        mock_dynamodb.Table.return_value = mock_table

        # Act & Assert
        with pytest.raises(RuntimeError) as exc_info:
            store_label(
                self.sample_episode_id,
                self.sample_child_id,
                self.sample_label,
                self.sample_guardrail_result
            )

        assert "Label storage failed" in str(exc_info.value)
