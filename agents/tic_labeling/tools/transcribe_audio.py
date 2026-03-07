"""
Audio Transcription Tool using Amazon Transcribe

This tool transcribes audio from videos to capture vocal tics or contextual information.
"""

import boto3
import time
import json
import os
from strands import tool
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

# Lazy-load Transcribe client
_transcribe_client = None

def _get_transcribe_client():
    """Get or create Transcribe client with current AWS_REGION"""
    global _transcribe_client
    if _transcribe_client is None:
        region = os.getenv("AWS_REGION", "us-east-1")
        _transcribe_client = boto3.client("transcribe", region_name=region)
        logger.info(f"Initialized Transcribe client in region: {region}")
    return _transcribe_client


@tool
def transcribe_audio(
    s3_key: str,
    bucket_name: str = "tictrack-media-dev",
    language_code: str = "ja-JP"
) -> Dict[str, Any]:
    """
    Transcribe audio from a video file to capture vocal tics or contextual information.

    Args:
        s3_key: The S3 key of the video file
        bucket_name: The S3 bucket name (default: tictrack-media-dev)
        language_code: Language code for transcription (default: ja-JP for Japanese)

    Returns:
        Dictionary containing:
        {
            "transcript": "Full transcribed text",
            "has_audio": true/false,
            "detected_sounds": ["sound1", "sound2"],
            "vocal_tics_detected": true/false
        }
    """
    try:
        logger.info(f"Transcribing audio from: s3://{bucket_name}/{s3_key}")

        # Generate unique job name
        job_name = f"tictrack-{s3_key.replace('/', '-')}-{int(time.time())}"

        # Start transcription job
        s3_uri = f"s3://{bucket_name}/{s3_key}"

        transcribe = _get_transcribe_client()
        transcribe.start_transcription_job(
            TranscriptionJobName=job_name,
            Media={"MediaFileUri": s3_uri},
            MediaFormat=_get_media_format(s3_key),
            LanguageCode=language_code,
            Settings={
                "ShowSpeakerLabels": False,
                "ChannelIdentification": False,
            }
        )

        logger.info(f"Started transcription job: {job_name}")

        # Poll for completion (with timeout)
        max_wait_time = 300  # 5 minutes
        start_time = time.time()

        while True:
            if time.time() - start_time > max_wait_time:
                raise TimeoutError(f"Transcription job {job_name} timed out")

            status = transcribe.get_transcription_job(
                TranscriptionJobName=job_name
            )

            job_status = status["TranscriptionJob"]["TranscriptionJobStatus"]

            if job_status == "COMPLETED":
                # Get transcript
                transcript_uri = status["TranscriptionJob"]["Transcript"]["TranscriptFileUri"]
                transcript_text = _fetch_transcript(transcript_uri)

                logger.info(f"Transcription completed: {job_name}")

                # Analyze transcript for vocal tics
                vocal_tics_detected = _detect_vocal_tics(transcript_text)

                return {
                    "transcript": transcript_text,
                    "has_audio": bool(transcript_text.strip()),
                    "detected_sounds": _extract_sounds(transcript_text),
                    "vocal_tics_detected": vocal_tics_detected
                }

            elif job_status == "FAILED":
                failure_reason = status["TranscriptionJob"].get("FailureReason", "Unknown")
                logger.warning(f"Transcription failed: {failure_reason}")

                # Return empty result for videos without audio
                return {
                    "transcript": "",
                    "has_audio": False,
                    "detected_sounds": [],
                    "vocal_tics_detected": False
                }

            # Wait before polling again
            time.sleep(5)

    except Exception as e:
        logger.error(f"Error transcribing audio from {s3_key}: {str(e)}")

        # Return empty result on error (non-critical)
        return {
            "transcript": "",
            "has_audio": False,
            "detected_sounds": [],
            "vocal_tics_detected": False,
            "error": str(e)
        }


def _get_media_format(s3_key: str) -> str:
    """Determine media format from S3 key"""
    if s3_key.endswith(".mp4"):
        return "mp4"
    elif s3_key.endswith(".webm"):
        return "webm"
    else:
        return "mp4"  # default


def _fetch_transcript(transcript_uri: str) -> str:
    """Fetch transcript text from S3 URI"""
    import requests
    try:
        response = requests.get(transcript_uri)
        response.raise_for_status()
        data = response.json()
        return data.get("results", {}).get("transcripts", [{}])[0].get("transcript", "")
    except Exception as e:
        logger.error(f"Error fetching transcript: {str(e)}")
        return ""


def _extract_sounds(transcript: str) -> list:
    """Extract non-speech sounds from transcript"""
    sounds = []
    # Transcribe may include markers like [cough], [throat clearing], etc.
    import re
    pattern = r'\[(.*?)\]'
    matches = re.findall(pattern, transcript)
    sounds.extend(matches)
    return sounds


def _detect_vocal_tics(transcript: str) -> bool:
    """
    Detect potential vocal tics in transcript

    Common vocal tics include:
    - Repetitive sounds (e.g., "ん ん ん")
    - Throat clearing, coughing, sniffing sounds
    - Word or phrase repetition
    - Echolalia (repeating others' words)
    """
    if not transcript:
        return False

    # Simple heuristics for vocal tic detection
    transcript_lower = transcript.lower()

    # Check for repetitive short sounds
    import re
    repetitive_sounds = re.findall(r'(\b\w{1,2}\b)(\s+\1){2,}', transcript_lower)
    if repetitive_sounds:
        return True

    # Check for common vocal tic indicators
    tic_indicators = ['んん', 'うん', 'あー', 'えー']
    for indicator in tic_indicators:
        if indicator in transcript:
            return True

    return False
