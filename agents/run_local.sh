#!/bin/bash
#
# Local Development Script for Tic Labeling Agent
#
# Usage:
#   ./run_local.sh [AWS_PROFILE] [AWS_REGION]
#
# Examples:
#   ./run_local.sh                    # Use default profile and us-east-1
#   ./run_local.sh my-profile         # Use specific profile
#   ./run_local.sh my-profile ap-northeast-1  # Use specific profile and region
#

set -e

# Configuration
AWS_PROFILE="${1:-default}"
AWS_REGION="${2:-us-east-1}"
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8080}"

echo "========================================="
echo "TicTrack Tic Labeling Agent - Local Mode"
echo "========================================="
echo "AWS Profile: $AWS_PROFILE"
echo "AWS Region:  $AWS_REGION"
echo "Listening:   http://$HOST:$PORT"
echo "========================================="
echo

# Verify AWS credentials
echo "Verifying AWS credentials..."
AWS_PROFILE=$AWS_PROFILE aws sts get-caller-identity

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to authenticate with AWS"
    echo "Please check your AWS profile configuration."
    exit 1
fi

echo
echo "Starting FastAPI server..."
echo "Press Ctrl+C to stop"
echo

# Start the server with the specified profile
AWS_PROFILE=$AWS_PROFILE \
AWS_REGION=$AWS_REGION \
uv run uvicorn tic_labeling.agent:app \
    --host $HOST \
    --port $PORT \
    --reload
