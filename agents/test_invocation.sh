#!/bin/bash
#
# Test Script for Tic Labeling Agent /invocations endpoint
#
# Usage:
#   ./test_invocation.sh <S3_KEY> [BUCKET_NAME]
#
# Example:
#   ./test_invocation.sh videos/test-child/episode-123/video.mp4 tictrack-media-dev
#

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <S3_KEY> [BUCKET_NAME]"
    echo ""
    echo "Example:"
    echo "  $0 videos/test-child/episode-123/video.mp4 tictrack-media-dev"
    exit 1
fi

S3_KEY="$1"
BUCKET_NAME="${2:-tictrack-media-dev}"
ENDPOINT="${ENDPOINT:-http://localhost:8080}"

echo "========================================="
echo "Testing Tic Labeling Agent"
echo "========================================="
echo "Endpoint:    $ENDPOINT"
echo "S3 Bucket:   $BUCKET_NAME"
echo "S3 Key:      $S3_KEY"
echo "========================================="
echo

# Test /ping first
echo "1. Testing /ping endpoint..."
PING_RESPONSE=$(curl -s "$ENDPOINT/ping")
echo "Response: $PING_RESPONSE"
echo

# Test /invocations
echo "2. Testing /invocations endpoint..."
echo "Request body:"
cat <<EOF | tee /dev/tty | curl -s -X POST "$ENDPOINT/invocations" \
    -H "Content-Type: application/json" \
    -d @- | jq '.'
{
  "episode_id": "test-episode-$(date +%s)",
  "child_id": "test-child-123",
  "bucket_name": "$BUCKET_NAME",
  "s3_key": "$S3_KEY",
  "video_mime_type": "video/mp4"
}
EOF

echo
echo "========================================="
echo "Test completed"
echo "========================================="
