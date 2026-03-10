# Local Testing Guide for Tic Labeling Agent

This guide explains how to run and test the Tic Labeling Agent locally with AWS credentials.

## Prerequisites

1. **AWS Credentials configured**
   ```bash
   aws configure --profile YOUR_PROFILE_NAME
   ```

2. **Required AWS Permissions**
   - `bedrock:InvokeModel` - For Nova Pro video analysis
   - `bedrock:InvokeModelWithResponseStream` - For streaming responses
   - `transcribe:StartTranscriptionJob` - For audio transcription
   - `transcribe:GetTranscriptionJob` - For transcription status
   - `bedrock:ApplyGuardrail` - For content safety (optional, falls back to keywords)
   - `dynamodb:PutItem` - For AILabels table
   - `dynamodb:UpdateItem` - For Episodes table
   - `s3:GetObject` - For reading video files

3. **Test Video in S3**
   Upload a test video to your S3 bucket:
   ```bash
   aws s3 cp test-video.mp4 s3://YOUR_BUCKET/videos/test/video.mp4 --profile YOUR_PROFILE
   ```

## Running the Agent Locally

### Start the Server

```bash
cd agents

# Use default profile (usually named "default")
./run_local.sh

# Use a specific AWS profile
./run_local.sh my-profile

# Use a specific profile and region
./run_local.sh my-profile ap-northeast-1
```

The server will start at `http://localhost:8080`

### Test Endpoints

#### 1. Health Check

```bash
curl http://localhost:8080/ping
```

Expected response:
```json
{
  "status": "healthy",
  "agent": "tic-labeling",
  "version": "1.0.0"
}
```

#### 2. Analyze Video

```bash
./test_invocation.sh videos/test/video.mp4 YOUR_BUCKET_NAME
```

Or manually:

```bash
curl -X POST http://localhost:8080/invocations \
  -H "Content-Type: application/json" \
  -d '{
    "episode_id": "test-episode-123",
    "child_id": "test-child-456",
    "s3_key": "videos/test/video.mp4",
    "video_mime_type": "video/mp4"
  }'
```

Expected response:
```json
{
  "episode_id": "test-episode-123",
  "status": "completed",
  "label": {
    "type": "motor",
    "severity": 2,
    "context": "Eye blinking movements observed",
    "observations": [
      {
        "timestamp": "0:05",
        "description": "Repetitive eye blinking",
        "intensity": "medium"
      }
    ],
    "confidence": 0.85
  }
}
```

## Troubleshooting

### Authentication Errors

If you see `Unable to locate credentials`:

```bash
# Verify your AWS profile
aws sts get-caller-identity --profile YOUR_PROFILE

# List available profiles
cat ~/.aws/config
```

### Permission Errors

If you see `AccessDeniedException`:

1. Check IAM permissions for your user/role
2. Verify the profile has access to required services
3. Check region - ensure services are available in your region

### Bedrock Model Access

Nova Pro requires model access approval:

1. Go to AWS Console → Bedrock → Model access
2. Request access to "Amazon Nova Pro"
3. Wait for approval (usually instant for AWS accounts)

### DynamoDB Table Not Found

For local testing, create test tables:

```bash
aws dynamodb create-table \
  --table-name AILabels-dev \
  --attribute-definitions AttributeName=labelId,AttributeType=S \
  --key-schema AttributeName=labelId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --profile YOUR_PROFILE

aws dynamodb create-table \
  --table-name Episodes-dev \
  --attribute-definitions AttributeName=episodeId,AttributeType=S \
  --key-schema AttributeName=episodeId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --profile YOUR_PROFILE
```

## Environment Variables

You can customize the server with environment variables:

```bash
# Use different port
PORT=3000 ./run_local.sh

# Use different host
HOST=127.0.0.1 ./run_local.sh

# All together
AWS_PROFILE=my-profile AWS_REGION=ap-northeast-1 PORT=3000 ./run_local.sh
```

## Cost Estimation

Local testing costs (per video analysis):

- **Nova Pro**: ~$0.004 per video (1-2 minutes)
- **Transcribe**: ~$0.024 per minute of audio
- **Bedrock Guardrails**: ~$0.0002 per 1000 characters
- **DynamoDB**: ~$0.000001 per write (negligible)

**Total per test**: ~$0.01-0.05

**Monthly free tier** (first 12 months):
- Bedrock: $200 credit
- Transcribe: 60 minutes free

## Next Steps

After verifying local functionality:

1. **Docker Containerization** (Task #43)
   ```bash
   cd agents
   docker build -t tic-labeling-agent .
   ```

2. **Deploy to AgentCore Runtime**
   - Push to ECR
   - Configure Amplify backend
   - Update Lambda Proxy

3. **Frontend Integration** (Task #45)
   - AI label display UI
   - Feedback system (approve/edit/reject)
