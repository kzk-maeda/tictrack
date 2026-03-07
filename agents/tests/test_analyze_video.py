"""
Unit tests for analyze_video tool

Tests Nova Pro video analysis functionality with mocked AWS responses.
"""

import pytest
import json
from unittest.mock import Mock, patch, MagicMock
from tic_labeling.tools.analyze_video import analyze_video


class TestAnalyzeVideo:
    """Test suite for video analysis tool"""

    def setup_method(self):
        """Setup test fixtures"""
        self.sample_s3_key = "videos/user123/child456/episode789/video.mp4"
        self.sample_bucket = "tictrack-media-test"

    @patch("tic_labeling.tools.analyze_video.bedrock_runtime")
    def test_analyze_video_returns_structured_json(self, mock_bedrock):
        """Test that analyze_video returns structured JSON with required fields"""
        # Arrange
        mock_response = {
            "body": MagicMock(
                read=lambda: json.dumps({
                    "output": {
                        "message": {
                            "content": [{
                                "text": json.dumps({
                                    "observations": [
                                        {
                                            "timestamp": "0:05",
                                            "description": "Eye blinking movement",
                                            "intensity": "medium"
                                        }
                                    ],
                                    "suggested_type": "motor",
                                    "suggested_severity": 2,
                                    "confidence": 0.85
                                })
                            }]
                        }
                    }
                }).encode()
            )
        }
        mock_bedrock.invoke_model.return_value = mock_response

        # Act
        result = analyze_video(self.sample_s3_key, self.sample_bucket)

        # Assert
        assert "observations" in result
        assert isinstance(result["observations"], list)
        assert len(result["observations"]) > 0
        assert "suggested_type" in result
        assert "suggested_severity" in result
        assert "confidence" in result

    @patch("tic_labeling.tools.analyze_video.bedrock_runtime")
    def test_suggested_type_is_valid_enum(self, mock_bedrock):
        """Test that suggested_type is one of: motor, vocal, both"""
        # Arrange
        mock_response = {
            "body": MagicMock(
                read=lambda: json.dumps({
                    "output": {
                        "message": {
                            "content": [{
                                "text": json.dumps({
                                    "observations": [],
                                    "suggested_type": "motor",
                                    "suggested_severity": 2,
                                    "confidence": 0.8
                                })
                            }]
                        }
                    }
                }).encode()
            )
        }
        mock_bedrock.invoke_model.return_value = mock_response

        # Act
        result = analyze_video(self.sample_s3_key, self.sample_bucket)

        # Assert
        assert result["suggested_type"] in ["motor", "vocal", "both"]

    @patch("tic_labeling.tools.analyze_video.bedrock_runtime")
    def test_suggested_severity_is_between_1_and_3(self, mock_bedrock):
        """Test that suggested_severity is an integer between 1 and 3"""
        # Arrange
        mock_response = {
            "body": MagicMock(
                read=lambda: json.dumps({
                    "output": {
                        "message": {
                            "content": [{
                                "text": json.dumps({
                                    "observations": [],
                                    "suggested_type": "motor",
                                    "suggested_severity": 2,
                                    "confidence": 0.8
                                })
                            }]
                        }
                    }
                }).encode()
            )
        }
        mock_bedrock.invoke_model.return_value = mock_response

        # Act
        result = analyze_video(self.sample_s3_key, self.sample_bucket)

        # Assert
        assert isinstance(result["suggested_severity"], int)
        assert 1 <= result["suggested_severity"] <= 3

    @patch("tic_labeling.tools.analyze_video.bedrock_runtime")
    def test_observations_contain_required_fields(self, mock_bedrock):
        """Test that each observation contains timestamp, description, and intensity"""
        # Arrange
        mock_response = {
            "body": MagicMock(
                read=lambda: json.dumps({
                    "output": {
                        "message": {
                            "content": [{
                                "text": json.dumps({
                                    "observations": [
                                        {
                                            "timestamp": "0:05",
                                            "description": "Head jerking movement",
                                            "intensity": "high"
                                        },
                                        {
                                            "timestamp": "0:12",
                                            "description": "Shoulder shrug",
                                            "intensity": "medium"
                                        }
                                    ],
                                    "suggested_type": "motor",
                                    "suggested_severity": 3,
                                    "confidence": 0.9
                                })
                            }]
                        }
                    }
                }).encode()
            )
        }
        mock_bedrock.invoke_model.return_value = mock_response

        # Act
        result = analyze_video(self.sample_s3_key, self.sample_bucket)

        # Assert
        for obs in result["observations"]:
            assert "timestamp" in obs
            assert "description" in obs
            assert "intensity" in obs
            assert obs["intensity"] in ["low", "medium", "high"]

    @patch("tic_labeling.tools.analyze_video.bedrock_runtime")
    def test_analyze_video_calls_nova_pro_with_correct_model_id(self, mock_bedrock):
        """Test that the tool uses Nova Pro model ID"""
        # Arrange
        mock_response = {
            "body": MagicMock(
                read=lambda: json.dumps({
                    "output": {
                        "message": {
                            "content": [{
                                "text": json.dumps({
                                    "observations": [],
                                    "suggested_type": "motor",
                                    "suggested_severity": 1,
                                    "confidence": 0.7
                                })
                            }]
                        }
                    }
                }).encode()
            )
        }
        mock_bedrock.invoke_model.return_value = mock_response

        # Act
        analyze_video(self.sample_s3_key, self.sample_bucket)

        # Assert
        mock_bedrock.invoke_model.assert_called_once()
        call_kwargs = mock_bedrock.invoke_model.call_args[1]
        assert call_kwargs["modelId"] == "us.amazon.nova-pro-v1:0"

    @patch("tic_labeling.tools.analyze_video.bedrock_runtime")
    def test_analyze_video_raises_error_on_api_failure(self, mock_bedrock):
        """Test that tool raises RuntimeError when Nova Pro API fails"""
        # Arrange
        mock_bedrock.invoke_model.side_effect = Exception("API Error")

        # Act & Assert
        with pytest.raises(RuntimeError) as exc_info:
            analyze_video(self.sample_s3_key, self.sample_bucket)

        assert "Video analysis failed" in str(exc_info.value)

    @patch("tic_labeling.tools.analyze_video.bedrock_runtime")
    def test_analyze_video_handles_non_json_response(self, mock_bedrock):
        """Test that tool handles non-JSON responses gracefully"""
        # Arrange
        mock_response = {
            "body": MagicMock(
                read=lambda: json.dumps({
                    "output": {
                        "message": {
                            "content": [{
                                "text": "This is plain text, not JSON"
                            }]
                        }
                    }
                }).encode()
            )
        }
        mock_bedrock.invoke_model.return_value = mock_response

        # Act
        result = analyze_video(self.sample_s3_key, self.sample_bucket)

        # Assert
        assert "observations" in result
        assert result["suggested_type"] == "unknown"
        assert result["suggested_severity"] == 2
        assert result["confidence"] == 0.5
