"""
Unit tests for transcribe_audio tool

Tests Amazon Transcribe integration with mocked AWS responses.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from tic_labeling.tools.transcribe_audio import transcribe_audio


class TestTranscribeAudio:
    """Test suite for audio transcription tool"""

    def setup_method(self):
        """Setup test fixtures"""
        self.sample_s3_key = "videos/user123/child456/episode789/video.mp4"
        self.sample_bucket = "tictrack-media-test"

    @patch("tic_labeling.tools.transcribe_audio.transcribe_client")
    @patch("tic_labeling.tools.transcribe_audio._fetch_transcript")
    def test_transcribe_audio_returns_transcript_text(self, mock_fetch, mock_transcribe):
        """Test that transcribe_audio returns transcript text on success"""
        # Arrange
        mock_transcribe.start_transcription_job.return_value = {}
        mock_transcribe.get_transcription_job.return_value = {
            "TranscriptionJob": {
                "TranscriptionJobStatus": "COMPLETED",
                "Transcript": {
                    "TranscriptFileUri": "https://s3.amazonaws.com/transcript.json"
                }
            }
        }
        mock_fetch.return_value = "これはテスト音声です"

        # Act
        result = transcribe_audio(self.sample_s3_key, self.sample_bucket)

        # Assert
        assert "transcript" in result
        assert result["transcript"] == "これはテスト音声です"
        assert result["has_audio"] is True

    @patch("tic_labeling.tools.transcribe_audio.transcribe_client")
    def test_transcribe_audio_returns_empty_for_no_audio(self, mock_transcribe):
        """Test that transcribe_audio returns empty transcript for videos without audio"""
        # Arrange
        mock_transcribe.start_transcription_job.return_value = {}
        mock_transcribe.get_transcription_job.return_value = {
            "TranscriptionJob": {
                "TranscriptionJobStatus": "FAILED",
                "FailureReason": "No audio detected"
            }
        }

        # Act
        result = transcribe_audio(self.sample_s3_key, self.sample_bucket)

        # Assert
        assert result["transcript"] == ""
        assert result["has_audio"] is False
        assert result["vocal_tics_detected"] is False

    @patch("tic_labeling.tools.transcribe_audio.transcribe_client")
    @patch("tic_labeling.tools.transcribe_audio._fetch_transcript")
    def test_transcribe_audio_detects_vocal_tics(self, mock_fetch, mock_transcribe):
        """Test that vocal tic detection works for repetitive sounds"""
        # Arrange
        mock_transcribe.start_transcription_job.return_value = {}
        mock_transcribe.get_transcription_job.return_value = {
            "TranscriptionJob": {
                "TranscriptionJobStatus": "COMPLETED",
                "Transcript": {
                    "TranscriptFileUri": "https://s3.amazonaws.com/transcript.json"
                }
            }
        }
        # Repetitive sounds indicating vocal tics
        mock_fetch.return_value = "ん ん ん あー"

        # Act
        result = transcribe_audio(self.sample_s3_key, self.sample_bucket)

        # Assert
        assert result["vocal_tics_detected"] is True

    @patch("tic_labeling.tools.transcribe_audio.transcribe_client")
    @patch("tic_labeling.tools.transcribe_audio._fetch_transcript")
    def test_transcribe_audio_extracts_detected_sounds(self, mock_fetch, mock_transcribe):
        """Test that non-speech sounds are extracted from transcript"""
        # Arrange
        mock_transcribe.start_transcription_job.return_value = {}
        mock_transcribe.get_transcription_job.return_value = {
            "TranscriptionJob": {
                "TranscriptionJobStatus": "COMPLETED",
                "Transcript": {
                    "TranscriptFileUri": "https://s3.amazonaws.com/transcript.json"
                }
            }
        }
        mock_fetch.return_value = "これは [cough] テスト [throat clearing] です"

        # Act
        result = transcribe_audio(self.sample_s3_key, self.sample_bucket)

        # Assert
        assert "detected_sounds" in result
        assert "cough" in result["detected_sounds"]
        assert "throat clearing" in result["detected_sounds"]

    @patch("tic_labeling.tools.transcribe_audio.transcribe_client")
    def test_transcribe_audio_handles_timeout(self, mock_transcribe):
        """Test that tool handles transcription timeout gracefully"""
        # Arrange
        mock_transcribe.start_transcription_job.return_value = {}
        # Always return IN_PROGRESS to simulate timeout
        mock_transcribe.get_transcription_job.return_value = {
            "TranscriptionJob": {
                "TranscriptionJobStatus": "IN_PROGRESS"
            }
        }

        # Act
        result = transcribe_audio(self.sample_s3_key, self.sample_bucket)

        # Assert - Should return empty result with error
        assert "error" in result
        assert result["has_audio"] is False

    @patch("tic_labeling.tools.transcribe_audio.transcribe_client")
    def test_transcribe_audio_handles_api_error(self, mock_transcribe):
        """Test that tool handles Transcribe API errors gracefully"""
        # Arrange
        mock_transcribe.start_transcription_job.side_effect = Exception("API Error")

        # Act
        result = transcribe_audio(self.sample_s3_key, self.sample_bucket)

        # Assert - Should return empty result, not raise exception
        assert result["transcript"] == ""
        assert result["has_audio"] is False
        assert "error" in result

    @patch("tic_labeling.tools.transcribe_audio.transcribe_client")
    @patch("tic_labeling.tools.transcribe_audio._fetch_transcript")
    def test_transcribe_audio_uses_correct_language_code(self, mock_fetch, mock_transcribe):
        """Test that default language code is ja-JP for Japanese"""
        # Arrange
        mock_transcribe.start_transcription_job.return_value = {}
        mock_transcribe.get_transcription_job.return_value = {
            "TranscriptionJob": {
                "TranscriptionJobStatus": "COMPLETED",
                "Transcript": {
                    "TranscriptFileUri": "https://s3.amazonaws.com/transcript.json"
                }
            }
        }
        mock_fetch.return_value = "テスト"

        # Act
        transcribe_audio(self.sample_s3_key, self.sample_bucket)

        # Assert
        call_kwargs = mock_transcribe.start_transcription_job.call_args[1]
        assert call_kwargs["LanguageCode"] == "ja-JP"
