"""
Results Integration Tool

This tool integrates video analysis and audio transcription results into a structured label.
"""

from strands import tool
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)


@tool
def integrate_results(
    video_analysis: Dict[str, Any],
    audio_transcription: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Integrate video analysis and audio transcription results into a unified label.

    Args:
        video_analysis: Results from analyze_video tool
        audio_transcription: Results from transcribe_audio tool

    Returns:
        Integrated label:
        {
            "type": "motor|vocal|both",
            "severity": 1-3,
            "context": "description",
            "observations": [...],
            "confidence": 0.0-1.0
        }
    """
    try:
        logger.info("Integrating video and audio analysis results")

        # Extract video analysis results
        video_type = video_analysis.get("suggested_type", "motor")
        video_severity = video_analysis.get("suggested_severity", 2)
        video_observations = video_analysis.get("observations", [])
        video_confidence = video_analysis.get("confidence", 0.7)

        # Extract audio analysis results
        has_vocal_tics = audio_transcription.get("vocal_tics_detected", False)
        transcript = audio_transcription.get("transcript", "")
        detected_sounds = audio_transcription.get("detected_sounds", [])

        # Determine final type
        final_type = _determine_type(video_type, has_vocal_tics)

        # Determine final severity
        final_severity = _determine_severity(
            video_severity,
            len(video_observations),
            has_vocal_tics
        )

        # Generate context description
        context = _generate_context(
            video_observations,
            transcript,
            detected_sounds
        )

        # Calculate overall confidence
        confidence = _calculate_confidence(
            video_confidence,
            len(video_observations),
            bool(transcript)
        )

        integrated_label = {
            "type": final_type,
            "severity": final_severity,
            "context": context,
            "observations": video_observations,
            "transcript": transcript if has_vocal_tics else "",
            "confidence": round(confidence, 2),
            "metadata": {
                "video_analysis": {
                    "type": video_type,
                    "severity": video_severity,
                    "observation_count": len(video_observations)
                },
                "audio_analysis": {
                    "has_vocal_tics": has_vocal_tics,
                    "has_audio": audio_transcription.get("has_audio", False),
                    "detected_sounds": detected_sounds
                }
            }
        }

        logger.info(f"Integration complete: type={final_type}, severity={final_severity}")
        return integrated_label

    except Exception as e:
        logger.error(f"Error integrating results: {str(e)}")
        raise RuntimeError(f"Integration failed: {str(e)}")


def _determine_type(video_type: str, has_vocal_tics: bool) -> str:
    """Determine final tic type based on video and audio evidence"""
    if video_type == "both":
        return "both"
    elif video_type == "vocal" or has_vocal_tics:
        if video_type == "motor":
            return "both"
        return "vocal"
    else:
        return "motor"


def _determine_severity(
    video_severity: int,
    observation_count: int,
    has_vocal_tics: bool
) -> int:
    """
    Determine final severity based on multiple factors

    Severity scale:
    1 = Mild: Subtle, infrequent, minimal impact
    2 = Moderate: Noticeable, somewhat frequent
    3 = Severe: Intense, very frequent, significant impact
    """
    severity = video_severity

    # Increase severity if multiple observations
    if observation_count >= 5:
        severity = min(3, severity + 1)

    # Increase severity if both motor and vocal
    if has_vocal_tics and video_severity >= 1:
        severity = min(3, severity + 1)

    return max(1, min(3, severity))


def _generate_context(
    observations: list,
    transcript: str,
    detected_sounds: list
) -> str:
    """Generate context description from observations"""
    context_parts = []

    # Add observation count
    if len(observations) > 0:
        context_parts.append(f"{len(observations)} observable movements detected")

    # Add dominant movement types
    movement_types = set()
    for obs in observations:
        desc = obs.get("description", "").lower()
        if "eye" in desc or "blink" in desc:
            movement_types.add("eye movements")
        elif "head" in desc:
            movement_types.add("head movements")
        elif "shoulder" in desc:
            movement_types.add("shoulder movements")
        elif "facial" in desc or "face" in desc:
            movement_types.add("facial movements")

    if movement_types:
        context_parts.append(f"primarily {', '.join(sorted(movement_types))}")

    # Add vocal information
    if detected_sounds:
        context_parts.append(f"with sounds: {', '.join(detected_sounds)}")
    elif transcript:
        context_parts.append("with vocal components")

    if not context_parts:
        return "Video observation"

    return "; ".join(context_parts)


def _calculate_confidence(
    video_confidence: float,
    observation_count: int,
    has_audio: bool
) -> float:
    """Calculate overall confidence score"""
    confidence = video_confidence

    # Increase confidence with more observations
    if observation_count >= 3:
        confidence = min(1.0, confidence + 0.1)
    if observation_count >= 5:
        confidence = min(1.0, confidence + 0.1)

    # Slight increase if audio provides additional evidence
    if has_audio:
        confidence = min(1.0, confidence + 0.05)

    return confidence
