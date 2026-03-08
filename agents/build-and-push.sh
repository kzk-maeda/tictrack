#!/bin/bash
set -e

# Build and push Docker image to ECR for AgentCore Runtime
#
# Usage:
#   ./build-and-push.sh [AWS_PROFILE] [AWS_REGION] [IMAGE_TAG]
#
# Example:
#   ./build-and-push.sh tictrack-dev ap-northeast-1 latest

# --- Configuration ---
AWS_PROFILE=${1:-tictrack-dev}
AWS_REGION=${2:-ap-northeast-1}
IMAGE_TAG=${3:-latest}

echo "========================================="
echo "Building and pushing Tic Labeling Agent"
echo "========================================="
echo "AWS Profile: $AWS_PROFILE"
echo "AWS Region:  $AWS_REGION"
echo "Image Tag:   $IMAGE_TAG"
echo ""

# --- Get ECR Repository URI ---
echo "[1/5] Getting ECR repository URI..."
ECR_REPO_URI=$(AWS_PROFILE=$AWS_PROFILE AWS_REGION=$AWS_REGION \
  aws ecr describe-repositories \
  --query 'repositories[?contains(repositoryName, `agents`)].repositoryUri' \
  --output text)

if [ -z "$ECR_REPO_URI" ]; then
  echo "❌ Error: ECR repository not found. Make sure Amplify sandbox is running."
  exit 1
fi

echo "✅ Found ECR repository: $ECR_REPO_URI"
echo ""

# --- ECR Login ---
echo "[2/5] Logging in to ECR..."
AWS_PROFILE=$AWS_PROFILE AWS_REGION=$AWS_REGION \
  aws ecr get-login-password | \
  docker login --username AWS --password-stdin ${ECR_REPO_URI%%/*}

echo "✅ Logged in to ECR"
echo ""

# --- Build Docker Image ---
echo "[3/5] Building Docker image for ARM64 (AgentCore Runtime requirement)..."
docker buildx build --platform linux/arm64 -t tic-labeling-agent:$IMAGE_TAG .

echo "✅ Built image: tic-labeling-agent:$IMAGE_TAG"
echo ""

# --- Tag for ECR ---
echo "[4/5] Tagging image for ECR..."
docker tag tic-labeling-agent:$IMAGE_TAG $ECR_REPO_URI:$IMAGE_TAG

echo "✅ Tagged: $ECR_REPO_URI:$IMAGE_TAG"
echo ""

# --- Push to ECR ---
echo "[5/5] Pushing image to ECR..."
docker push $ECR_REPO_URI:$IMAGE_TAG

echo ""
echo "========================================="
echo "✅ Successfully pushed to ECR!"
echo "========================================="
echo ""
echo "Image URI: $ECR_REPO_URI:$IMAGE_TAG"
echo ""
echo "Next steps:"
echo "  1. Update backend.ts to deploy AgentCore Runtime"
echo "  2. Configure Lambda Proxy to invoke the agent"
echo ""
