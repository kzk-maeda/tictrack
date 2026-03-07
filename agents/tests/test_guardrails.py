"""
Unit tests for apply_guardrails tool

Tests Bedrock Guardrails integration and fallback validation.
"""

import pytest
from unittest.mock import Mock, patch
from tic_labeling.tools.apply_guardrails import apply_guardrails


class TestGuardrails:
    """Test suite for guardrails tool"""

    def setup_method(self):
        """Setup test fixtures"""
        self.sample_label = {
            "type": "motor",
            "severity": 2,
            "context": "Eye blinking movements observed",
            "observations": [
                {
                    "timestamp": "0:05",
                    "description": "Repetitive eye blinking",
                    "intensity": "medium"
                }
            ],
            "confidence": 0.85
        }

    @patch("tic_labeling.tools.apply_guardrails._get_bedrock_client")
    def test_guardrails_blocks_diagnostic_language(self, mock_get_client):
        """Test that guardrails blocks diagnostic statements like 'diagnosed with Tourette'"""
        # Arrange
        diagnostic_label = self.sample_label.copy()
        diagnostic_label["context"] = "Child is diagnosed with Tourette syndrome"

        mock_client = Mock()
        mock_client.apply_guardrail.return_value = {
            "action": "GUARDRAIL_INTERVENED",
            "assessments": [
                {
                    "topicPolicy": {
                        "topics": [
                            {
                                "type": "DIAGNOSTIC",
                                "name": "medical_diagnosis",
                                "action": "BLOCKED"
                            }
                        ]
                    }
                }
            ]
        }
        mock_get_client.return_value = mock_client

        # Act
        result = apply_guardrails(diagnostic_label)

        # Assert
        assert result["guardrail_passed"] is False
        assert result["action_taken"] == "SANITIZED"
        assert len(result["blocked_content"]) > 0

    @patch("tic_labeling.tools.apply_guardrails._get_bedrock_client")
    def test_guardrails_blocks_treatment_recommendations(self, mock_get_client):
        """Test that guardrails blocks treatment advice like 'should take medication'"""
        # Arrange
        treatment_label = self.sample_label.copy()
        treatment_label["context"] = "Child should consider medication therapy"

        mock_client = Mock()
        mock_client.apply_guardrail.return_value = {
            "action": "GUARDRAIL_INTERVENED",
            "assessments": [
                {
                    "topicPolicy": {
                        "topics": [
                            {
                                "type": "TREATMENT",
                                "name": "medical_advice",
                                "action": "BLOCKED"
                            }
                        ]
                    }
                }
            ]
        }
        mock_get_client.return_value = mock_client

        # Act
        result = apply_guardrails(treatment_label)

        # Assert
        assert result["guardrail_passed"] is False
        assert "TREATMENT" in str(result["blocked_content"])

    @patch("tic_labeling.tools.apply_guardrails._get_bedrock_client")
    def test_guardrails_allows_observational_language(self, mock_get_client):
        """Test that guardrails allows safe observational language"""
        # Arrange
        safe_label = self.sample_label.copy()
        safe_label["context"] = "Movements appear to show repetitive patterns"

        mock_client = Mock()
        mock_client.apply_guardrail.return_value = {
            "action": "NONE",
            "assessments": []
        }
        mock_get_client.return_value = mock_client

        # Act
        result = apply_guardrails(safe_label)

        # Assert
        assert result["guardrail_passed"] is True
        assert result["action_taken"] == "NONE"
        assert result["label"] == safe_label

    def test_fallback_validation_blocks_prohibited_keywords(self):
        """Test that fallback validation blocks prohibited diagnostic terms"""
        # Arrange
        diagnostic_label = self.sample_label.copy()
        diagnostic_label["context"] = "トゥレット症候群の診断"

        # Mock ResourceNotFoundException to trigger fallback
        with patch("tic_labeling.tools.apply_guardrails._get_bedrock_client") as mock_get_client:
            from botocore.exceptions import ClientError
            mock_client = Mock()
            mock_client.apply_guardrail.side_effect = ClientError(
                {"Error": {"Code": "ResourceNotFoundException"}},
                "apply_guardrail"
            )
            mock_get_client.return_value = mock_client

            # Act
            result = apply_guardrails(diagnostic_label)

            # Assert
            assert result["guardrail_passed"] is False
            assert len(result["blocked_content"]) > 0

    def test_fallback_validation_allows_safe_language(self):
        """Test that fallback validation passes safe observational language"""
        # Arrange
        safe_label = self.sample_label.copy()

        # Mock ResourceNotFoundException to trigger fallback
        with patch("tic_labeling.tools.apply_guardrails._get_bedrock_client") as mock_get_client:
            from botocore.exceptions import ClientError
            mock_client = Mock()
            mock_client.apply_guardrail.side_effect = ClientError(
                {"Error": {"Code": "ResourceNotFoundException"}},
                "apply_guardrail"
            )
            mock_get_client.return_value = mock_client

            # Act
            result = apply_guardrails(safe_label)

            # Assert
            assert result["guardrail_passed"] is True
            assert result["action_taken"] == "NONE"

    @patch("tic_labeling.tools.apply_guardrails._get_bedrock_client")
    def test_guardrails_sanitizes_blocked_content(self, mock_get_client):
        """Test that sanitization replaces diagnostic terms with observational language"""
        # Arrange
        diagnostic_label = self.sample_label.copy()
        diagnostic_label["context"] = "Child is diagnosed with Tourette"

        mock_client = Mock()
        mock_client.apply_guardrail.return_value = {
            "action": "GUARDRAIL_INTERVENED",
            "assessments": [
                {
                    "topicPolicy": {
                        "topics": [
                            {
                                "type": "DIAGNOSTIC",
                                "name": "diagnosis",
                                "action": "BLOCKED"
                            }
                        ]
                    }
                }
            ]
        }
        mock_get_client.return_value = mock_client

        # Act
        result = apply_guardrails(diagnostic_label)

        # Assert
        sanitized_context = result["label"]["context"]
        assert "[Observational note]" in sanitized_context
        assert result["label"]["metadata"]["guardrail_sanitized"] is True
