# AgentCore Runtime Deployment Guide

This guide explains how to deploy the Tic Labeling Agent to AWS Bedrock AgentCore Runtime.

## Prerequisites

- ✅ Docker image built and pushed to ECR (ARM64 architecture)
- ✅ Amplify sandbox running
- ✅ AWS CLI configured with appropriate permissions

## Deployment Options

### Option 1: CDK/CloudFormation (Recommended)

The AgentCore Runtime is configured in `amplify/custom/agentcore/index.ts` and integrated into `amplify/backend.ts`.

#### Step 1: Build and Push ARM64 Image

```bash
cd /Users/kazukimaeda/work/self/aws-aideas-competition/agents

# Build and push ARM64 image to ECR
./build-and-push.sh tictrack-dev ap-northeast-1 latest
```

#### Step 2: Deploy via Amplify

```bash
cd /Users/kazukimaeda/work/self/aws-aideas-competition

# Deploy to sandbox (updates AgentCore stack)
npx ampx sandbox
```

#### Step 3: Verify Deployment

```bash
# Check CloudFormation stack
AWS_PROFILE=tictrack-dev AWS_REGION=ap-northeast-1 \
  aws cloudformation describe-stacks \
  --stack-name amplify-*-agentcore-stack \
  --query 'Stacks[0].Outputs'

# Get Agent Runtime ARN
AWS_PROFILE=tictrack-dev AWS_REGION=ap-northeast-1 \
  aws cloudformation describe-stacks \
  --stack-name amplify-*-agentcore-stack \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentRuntimeArn`].OutputValue' \
  --output text
```

### Option 2: Manual Deployment (Fallback)

If CloudFormation doesn't fully support AgentCore Runtime yet, use this manual approach.

#### Using AWS Console

1. Navigate to **Amazon Bedrock > AgentCore > Runtimes**
2. Click **Create Runtime**
3. Configure:
   - **Name**: `tic-labeling-agent`
   - **Container Image**: Get from ECR (see below)
   - **Port**: `8080`
   - **Execution Role**: Use the role ARN from CDK outputs
4. Click **Create**

#### Using AWS CLI (if available)

```bash
# Get ECR image URI
ECR_IMAGE_URI=$(AWS_PROFILE=tictrack-dev AWS_REGION=ap-northeast-1 \
  aws ecr describe-repositories \
  --query 'repositories[?contains(repositoryName, `agents`)].repositoryUri' \
  --output text):latest

# Get execution role ARN (from CDK outputs)
EXECUTION_ROLE_ARN=$(AWS_PROFILE=tictrack-dev AWS_REGION=ap-northeast-1 \
  aws cloudformation describe-stacks \
  --stack-name amplify-*-agentcore-stack \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentExecutionRoleArn`].OutputValue' \
  --output text)

# Create AgentCore Runtime (command syntax may vary)
AWS_PROFILE=tictrack-dev AWS_REGION=ap-northeast-1 \
  aws bedrock-agent create-agent-runtime \
    --agent-name tic-labeling-agent \
    --container-image $ECR_IMAGE_URI \
    --container-port 8080 \
    --execution-role-arn $EXECUTION_ROLE_ARN
```

**Note**: The exact AWS CLI command for AgentCore might differ. Check the latest AWS documentation:
- https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/

## Troubleshooting

### Issue 1: CloudFormation Resource Not Found

**Symptom**: `CfnAgent` resource type not recognized

**Solution**: AgentCore might not have full CloudFormation support yet. Use Option 2 (Manual Deployment).

### Issue 2: Architecture Mismatch

**Symptom**: Container fails to start with architecture error

**Solution**: Verify image is ARM64:
```bash
docker inspect tic-labeling-agent:latest | grep Architecture
# Should show: "Architecture": "arm64"
```

### Issue 3: Container Health Check Fails

**Symptom**: Agent runtime shows unhealthy status

**Solution**: Check logs and verify /ping endpoint:
```bash
# Get log group from CDK outputs
AWS_PROFILE=tictrack-dev AWS_REGION=ap-northeast-1 \
  aws logs tail /aws/bedrock/agentcore/tic-labeling-agent --follow
```

## Verification

### Test Agent Endpoint

Once deployed, test the agent via Lambda Proxy (after Lambda Proxy is implemented):

```bash
# Via API Gateway
curl -X POST https://YOUR_API_ENDPOINT/analyze \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "episodeId": "test-123",
    "childId": "child-456",
    "s3Key": "videos/..."
  }'
```

## Next Steps

After AgentCore deployment is verified:

1. ✅ AgentCore Runtime deployed
2. ⏳ Implement Lambda Proxy (Task #44)
3. ⏳ Create API route `/analyze/{episodeId}`
4. ⏳ Build AI label UI with feedback

## Resources

- [AgentCore Runtime Documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/)
- [Container Deployment Guide](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-get-started-code-deploy.html)
- [AgentCore Pricing](https://aws.amazon.com/bedrock/agentcore/pricing/)
