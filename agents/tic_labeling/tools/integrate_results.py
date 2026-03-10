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
    Integrate video analysis and audio transcription results into a unified label
    using 2-axis classification (type × complexity).

    Args:
        video_analysis: Results from analyze_video tool
        audio_transcription: Results from transcribe_audio tool

    Returns:
        Integrated label:
        {
            "primaryTic": {
                "type": "motor|vocal",
                "complexity": "simple|complex",
                "symptomId": "motor_simple_eye_blinking" or null,
                "customSymptom": "description" or null,
                "confidence": 0.0-1.0
            },
            "secondaryTics": [...],  # Optional
            "severity": 1-5,
            "observations": [
                {
                    "timestamp": 1.5,
                    "description": "...",
                    "intensity": "low|medium|high"
                }
            ]
        }
    """
    try:
        logger.info("Integrating video and audio analysis results (2-axis classification)")

        # Extract video analysis results
        video_type = video_analysis.get("suggested_type", "motor")
        video_complexity = video_analysis.get("suggested_complexity", "simple")
        video_symptom_id = video_analysis.get("symptom_id")
        video_custom_symptom = video_analysis.get("custom_symptom")
        video_severity = video_analysis.get("suggested_severity", 3)
        video_observations = video_analysis.get("observations", [])
        video_confidence = video_analysis.get("confidence", 0.7)

        # Extract audio analysis results
        has_vocal_tics = audio_transcription.get("vocal_tics_detected", False)
        transcript = audio_transcription.get("transcript", "")
        detected_sounds = audio_transcription.get("detected_sounds", [])
        audio_symptom_id = audio_transcription.get("symptom_id")

        # Determine primary tic
        primary_tic = {
            "type": video_type if not has_vocal_tics else "vocal",
            "complexity": video_complexity,
            "symptomId": video_symptom_id or audio_symptom_id,
            "customSymptom": video_custom_symptom if not (video_symptom_id or audio_symptom_id) else None,
            "confidence": round(video_confidence, 2)
        }

        # Determine secondary tics (if both motor and vocal detected)
        secondary_tics = []
        if video_type == "motor" and has_vocal_tics:
            secondary_tics.append({
                "type": "vocal",
                "complexity": "simple",  # Most audio tics are simple
                "symptomId": audio_symptom_id,
                "customSymptom": None if audio_symptom_id else ", ".join(detected_sounds),
                "confidence": 0.6
            })

        # Determine final severity (1-5 scale)
        final_severity = _determine_severity_v2(
            video_severity,
            len(video_observations),
            has_vocal_tics,
            bool(secondary_tics)
        )

        # Format observations with timestamps and intensity
        formatted_observations = _format_observations(video_observations)

        integrated_label = {
            "primaryTic": primary_tic,
            "secondaryTics": secondary_tics if secondary_tics else None,
            "severity": final_severity,
            "observations": formatted_observations,
            "metadata": {
                "video_analysis": {
                    "type": video_type,
                    "complexity": video_complexity,
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

        logger.info(f"Integration complete: type={primary_tic['type']}, complexity={primary_tic['complexity']}, severity={final_severity}")
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
    DEPRECATED: Use _determine_severity_v2 instead
    """
    return _determine_severity_v2(video_severity, observation_count, has_vocal_tics, False)


def _determine_severity_v2(
    video_severity: int,
    observation_count: int,
    has_vocal_tics: bool,
    has_secondary_tics: bool
) -> int:
    """
    Determine final severity based on multiple factors

    Severity scale (1-5):
    1 = Very Mild: Subtle, barely noticeable, rare occurrences
    2 = Mild: Noticeable but infrequent, minimal disruption
    3 = Moderate: Clearly visible/audible, moderate frequency
    4 = Moderately Severe: Frequent, noticeable disruption
    5 = Severe: Very frequent, intense, significant impact
    """
    severity = video_severity

    # Increase severity if multiple observations (frequency indicator)
    if observation_count >= 5:
        severity = min(5, severity + 1)
    if observation_count >= 8:
        severity = min(5, severity + 1)

    # Increase severity if multiple tic types detected
    if has_secondary_tics:
        severity = min(5, severity + 1)

    return max(1, min(5, severity))


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


def _format_observations(observations: list) -> list:
    """
    Format observations to include timestamp and intensity

    Args:
        observations: Raw observations from video analysis

    Returns:
        Formatted observations with timestamp (seconds) and intensity
    """
    formatted = []
    for i, obs in enumerate(observations):
        # Extract or generate timestamp (in seconds)
        timestamp = obs.get("timestamp")
        if timestamp is None:
            # Estimate based on observation index (assume evenly distributed)
            # For a typical 10-second video
            timestamp = round((i + 1) * 2.0, 1)

        # Determine intensity from description or severity
        description = obs.get("description", "")
        intensity = "medium"  # Default
        if any(word in description.lower() for word in ["subtle", "slight", "mild", "small"]):
            intensity = "low"
        elif any(word in description.lower() for word in ["strong", "intense", "severe", "pronounced", "marked"]):
            intensity = "high"

        formatted.append({
            "timestamp": timestamp,
            "description": description,
            "intensity": intensity
        })

    return formatted
