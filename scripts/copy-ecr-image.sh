#!/bin/bash
#
# Copy agent Docker image from sandbox ECR to a target environment's ECR.
#
# Usage:
#   ./scripts/copy-ecr-image.sh <target-repo-uri> [source-tag] [target-tag]
#
# Example:
#   ./scripts/copy-ecr-image.sh 728291782722.dkr.ecr.ap-northeast-1.amazonaws.com/develop-repo latest latest
#
# Prerequisites:
#   - Docker running
#   - AWS CLI configured
#   - ECR login done or will be done by this script

set -euo pipefail

REGION="ap-northeast-1"
ACCOUNT_ID="728291782722"

# Source: sandbox ECR (known)
SOURCE_REPO="amplify-awsaideascompetition-kazukimaeda-sandbox-79195a0cd8-foundationstack908c88ba-8y7gmdzt3foy-foundationagentsrepo6fc60767-la5zvp6ov0hc"
SOURCE_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${SOURCE_REPO}"

# Target: passed as argument
TARGET_URI="${1:?Usage: $0 <target-repo-uri> [source-tag] [target-tag]}"
SOURCE_TAG="${2:-latest}"
TARGET_TAG="${3:-latest}"

echo "=== ECR Image Copy ==="
echo "Source: ${SOURCE_URI}:${SOURCE_TAG}"
echo "Target: ${TARGET_URI}:${TARGET_TAG}"
echo ""

# Login to ECR
echo "Logging in to ECR..."
aws ecr get-login-password --region "${REGION}" | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

# Pull source image
echo "Pulling source image..."
docker pull "${SOURCE_URI}:${SOURCE_TAG}"

# Tag for target
echo "Tagging for target..."
docker tag "${SOURCE_URI}:${SOURCE_TAG}" "${TARGET_URI}:${TARGET_TAG}"

# Push to target
echo "Pushing to target..."
docker push "${TARGET_URI}:${TARGET_TAG}"

echo ""
echo "✓ Image copied successfully!"
echo "  ${TARGET_URI}:${TARGET_TAG}"
