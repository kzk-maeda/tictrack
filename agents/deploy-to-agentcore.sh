#!/bin/bash
set -e

# Deploy Tic Labeling Agent to AWS Bedrock AgentCore Runtime
#
# Prerequisites:
#   - Docker image already pushed to ECR (run build-and-push.sh first)
#   - AWS CLI configured with appropriate permissions
#
# Usage:
#   ./deploy-to-agentcore.sh [AWS_PROFILE] [AWS_REGION] [AGENT_NAME]
#
# Example:
#   ./deploy-to-agentcore.sh tictrack-dev ap-northeast-1 tic-labeling-agent

# --- Configuration ---
AWS_PROFILE=${1:-tictrack-dev}
AWS_REGION=${2:-ap-northeast-1}
AGENT_NAME=${3:-tic-labeling-agent}

echo "========================================="
echo "Deploying to AgentCore Runtime"
echo "========================================="
echo "AWS Profile:  $AWS_PROFILE"
echo "AWS Region:   $AWS_REGION"
echo "Agent Name:   $AGENT_NAME"
echo ""

# --- Get ECR Image URI ---
echo "[1/3] Getting ECR image URI..."
ECR_REPO_URI=$(AWS_PROFILE=$AWS_PROFILE AWS_REGION=$AWS_REGION \
  aws ecr describe-repositories \
  --query 'repositories[?contains(repositoryName, `agents`)].repositoryUri' \
  --output text)

if [ -z "$ECR_REPO_URI" ]; then
  echo "❌ Error: ECR repository not found."
  exit 1
fi

IMAGE_URI="${ECR_REPO_URI}:latest"
echo "✅ Image URI: $IMAGE_URI"
echo ""

# --- Create AgentCore Runtime ---
echo "[2/3] Creating AgentCore Runtime..."
echo "Note: This may take a few minutes..."

# Create agent runtime using AWS Bedrock AgentCore API
AWS_PROFILE=$AWS_PROFILE AWS_REGION=$AWS_REGION \
  aws bedrock-agent-runtime create-agent-runtime \
    --agent-name "$AGENT_NAME" \
    --runtime-configuration "{
      \"containerConfiguration\": {
        \"imageUri\": \"$IMAGE_URI\",
        \"containerPort\": 8080
      }
    }" \
    --description "TicTrack Tic Labeling Agent - AI-powered tic episode analysis" \
    > agentcore-deployment.json 2>&1

if [ $? -eq 0 ]; then
  echo "✅ AgentCore Runtime created successfully!"
  echo ""

  # Extract agent runtime ARN
  AGENT_RUNTIME_ARN=$(cat agentcore-deployment.json | grep -o '"agentRuntimeArn":"[^"]*"' | cut -d'"' -f4)

  if [ -n "$AGENT_RUNTIME_ARN" ]; then
    echo "Agent Runtime ARN: $AGENT_RUNTIME_ARN"
    echo ""
    echo "Save this ARN for Lambda Proxy configuration!"
  fi
else
  echo "❌ Error creating AgentCore Runtime"
  cat agentcore-deployment.json
  echo ""
  echo "Note: If the command is not recognized, you may need to:"
  echo "  1. Update AWS CLI: aws --version (need 2.x)"
  echo "  2. Check if AgentCore is available in your region"
  echo "  3. Use the AWS Console or CloudFormation instead"
  exit 1
fi

echo ""
echo "[3/3] Verifying deployment..."
AWS_PROFILE=$AWS_PROFILE AWS_REGION=$AWS_REGION \
  aws bedrock-agent-runtime list-agent-runtimes \
    --query "agentRuntimes[?agentName=='$AGENT_NAME']" \
    --output table

echo ""
echo "========================================="
echo "✅ Deployment Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Note the Agent Runtime ARN above"
echo "  2. Update Lambda Proxy to invoke this agent"
echo "  3. Test the agent endpoint"
echo ""
