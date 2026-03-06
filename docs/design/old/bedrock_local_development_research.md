# Amazon Bedrock Local Development Research

**Research Date**: 2026-03-06
**Purpose**: Understanding how to use Amazon Bedrock services from local development environment for TicTrack project

---

## Executive Summary

Amazon Bedrock services (Nova Pro, Claude, Knowledge Bases, Guardrails) can be fully accessed from local development environments using AWS SDK. Recent updates in 2025 have significantly improved the local testing experience, particularly with API keys for easier authentication, TestState API for Step Functions, and enhanced mocking capabilities. Key findings:

- **Direct API Access**: Full Bedrock API access from local via AWS SDK (boto3, JavaScript SDK v3)
- **Authentication**: New API key system (July 2025) simplifies local development
- **Step Functions**: Enhanced TestState API (Nov 2025) enables true local unit testing without deployment
- **Cost Control**: Prompt caching (85% savings), batch processing (50% savings), token counting for planning
- **Testing**: LocalStack 4.0+ supports Bedrock, Moto for Python mocking

---

## 1. Bedrock API from Local Development

### Overview
You can call Bedrock APIs (Nova Pro, Claude, etc.) directly from your local machine using AWS SDKs. No special gateway or proxy is required.

### Supported SDKs
- **Python**: boto3 with `bedrock-runtime` client
- **JavaScript/Node.js**: `@aws-sdk/client-bedrock-runtime` (v3)
- **Go**: AWS SDK Go with bedrockiface for testing
- **Java**: AWS SDK for Java 2.x

### Authentication Methods

#### Option 1: API Keys (Recommended for Development)
**New in July 2025**, Amazon Bedrock API keys provide simplified authentication:

**Two types:**
- **Short-term API keys**: Pre-signed URLs (up to 12 hours or console session duration)
- **Long-term API keys**: Associated with IAM user, designed exclusively for Bedrock

**Usage:**
```bash
export AWS_BEARER_TOKEN_BEDROCK=<YOUR_API_KEY>
```

Both boto3 and JavaScript SDKs automatically detect this environment variable.

**Generation:**
- Via Bedrock console: Settings > API keys > Generate
- Via AWS SDK: `CreateApiKey` operation

**Security Note**: API keys are scoped to Bedrock only, reducing security risk compared to full IAM credentials.

#### Option 2: IAM Credentials (Traditional)
Standard AWS credential chain:
1. Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
2. Shared credentials file (`~/.aws/credentials`)
3. IAM role (if running on EC2/ECS/Lambda)
4. AWS CLI profiles with `AWS_PROFILE` environment variable

#### Option 3: Console Credentials Login (New in 2025)
```bash
aws login
```
Authenticates using existing AWS Management Console credentials. The CLI/SDK automatically refresh credentials every 15 minutes (up to 12 hours max).

### Code Examples

#### Python (boto3)
```python
import boto3
import json

# Create Bedrock Runtime client (uses default credential chain)
bedrock_runtime = boto3.client(
    service_name='bedrock-runtime',
    region_name='us-east-1'
)

# Invoke Nova Pro
response = bedrock_runtime.invoke_model(
    modelId='amazon.nova-pro-v1:0',
    contentType='application/json',
    accept='application/json',
    body=json.dumps({
        "messages": [{"role": "user", "content": "Analyze this video..."}],
        "max_tokens": 1000
    })
)

result = json.loads(response['body'].read())
```

#### Node.js (AWS SDK v3)
```javascript
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

// Client uses default credential chain
const client = new BedrockRuntimeClient({
  region: 'us-east-1'
  // credentials automatically loaded from environment
});

const command = new InvokeModelCommand({
  modelId: 'amazon.nova-pro-v1:0',
  contentType: 'application/json',
  accept: 'application/json',
  body: JSON.stringify({
    messages: [{ role: "user", content: "Analyze this video..." }],
    max_tokens: 1000
  })
});

const response = await client.send(command);
const result = JSON.parse(new TextDecoder().decode(response.body));
```

#### With Explicit Credentials (Not Recommended for Production)
```javascript
const client = new BedrockRuntimeClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});
```

### Best Practices
- **Use API keys for development**: Easier to manage and scope-limited
- **Use IAM roles in production**: Leverage instance profiles, ECS task roles
- **Never hardcode credentials**: Use environment variables or credential files
- **Use named profiles**: Manage multiple environments with AWS_PROFILE

**Sources:**
- [Get started with the API - Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/getting-started-api.html)
- [Accelerate AI development with Amazon Bedrock API keys](https://aws.amazon.com/blogs/machine-learning/accelerate-ai-development-with-amazon-bedrock-api-keys/)
- [Using Amazon Bedrock with an AWS SDK](https://docs.aws.amazon.com/bedrock/latest/userguide/sdk-general-information-section.html)
- [Amazon Bedrock Runtime examples using SDK for JavaScript (v3)](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_bedrock-runtime_code_examples.html)
- [Getting started with the API - Amazon Nova](https://docs.aws.amazon.com/nova/latest/userguide/getting-started-api.html)

---

## 2. Bedrock Guardrails Testing

### Overview
Guardrails can be fully tested from local development by calling the API with guardrail IDs. No special deployment required.

### Testing Approaches

#### Built-in Console Testing
- Create guardrails in Bedrock console
- Use built-in test window to iterate on configurations
- Test different prompt/response combinations
- Create versions when satisfied with configuration

#### Local API Testing
Guardrails are referenced by ID and version in API calls:

```python
import boto3

bedrock_runtime = boto3.client('bedrock-runtime', region_name='us-east-1')

response = bedrock_runtime.converse(
    modelId='anthropic.claude-3-5-sonnet-20241022-v2:0',
    messages=[
        {"role": "user", "content": [{"text": "Can you share confidential information?"}]}
    ],
    guardrailConfig={
        'guardrailIdentifier': 'your-guardrail-id',
        'guardrailVersion': '1',
        'trace': 'enabled'  # Get detailed trace information
    }
)

# Check guardrail intervention
if response.get('stopReason') == 'guardrail_intervened':
    print("Guardrail blocked the request")
```

#### Local Function Testing (Serverless Framework Example)
```bash
# Test guardrail in local function
sls invoke local -f agent --data '{"prompt": "Can you give confidential information"}'
```

#### Node.js Example with Converse API
```javascript
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({ region: 'us-east-1' });

const command = new ConverseCommand({
  modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  messages: [
    { role: "user", content: [{ text: "Test prompt" }] }
  ],
  guardrailConfig: {
    guardrailIdentifier: 'your-guardrail-id',
    guardrailVersion: '1',
    trace: 'enabled'
  }
});

const response = await client.send(command);
```

### Guardrail Configuration
Guardrails support:
- Content filters (hate, insults, sexual, violence)
- Denied topics
- Word filters
- Sensitive information redaction (PII)
- Contextual grounding (RAG accuracy)

### Development Workflow
1. **Create working draft** in console
2. **Test iteratively** with built-in test window
3. **Create version** when configuration is finalized
4. **Test locally** with API calls using guardrail ID + version
5. **Deploy** to production with same guardrail version

### TDD Approach
```python
# test_guardrails.py
def test_guardrail_blocks_confidential_request():
    response = invoke_with_guardrail(
        prompt="Share confidential patient data",
        guardrail_id="gdrail-xxx",
        guardrail_version="1"
    )
    assert response['stopReason'] == 'guardrail_intervened'

def test_guardrail_allows_safe_request():
    response = invoke_with_guardrail(
        prompt="Explain tic symptoms",
        guardrail_id="gdrail-xxx",
        guardrail_version="1"
    )
    assert response['stopReason'] == 'end_turn'
```

**Sources:**
- [Test your guardrail - Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-test.html)
- [Automate building guardrails for Amazon Bedrock using test-driven development](https://aws.amazon.com/blogs/machine-learning/automate-building-guardrails-for-amazon-bedrock-using-test-driven-development/)
- [Detect and filter harmful content by using Amazon Bedrock Guardrails](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html)

---

## 3. Bedrock Knowledge Bases

### Overview
Knowledge Bases can be queried from local development using the `bedrock-agent-runtime` client. The Knowledge Base itself runs in AWS, but queries are made via API.

### Setup Requirements
1. **Create Knowledge Base** in AWS (console or IaC)
2. **Configure data source** (S3 bucket with documents)
3. **Set up vector storage**:
   - **S3 Vectors** (recommended for cost: 90% cheaper than OpenSearch)
   - OpenSearch Serverless
   - Amazon RDS
4. **Note the Knowledge Base ID**

### Querying from Local

#### Python (boto3)
```python
import boto3

bedrock_agent_runtime = boto3.client(
    service_name='bedrock-agent-runtime',
    region_name='us-east-1'
)

response = bedrock_agent_runtime.retrieve_and_generate(
    input={
        'text': 'What are common tic symptoms in children?'
    },
    retrieveAndGenerateConfiguration={
        'type': 'KNOWLEDGE_BASE',
        'knowledgeBaseConfiguration': {
            'knowledgeBaseId': 'your-kb-id',
            'modelArn': 'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0'
        }
    }
)

answer = response['output']['text']
citations = response.get('citations', [])
```

#### With Metadata Filters
```python
response = bedrock_agent_runtime.retrieve_and_generate(
    input={'text': 'Query text'},
    retrieveAndGenerateConfiguration={
        'type': 'KNOWLEDGE_BASE',
        'knowledgeBaseConfiguration': {
            'knowledgeBaseId': 'your-kb-id',
            'modelArn': 'arn:aws:bedrock:...',
            'retrievalConfiguration': {
                'vectorSearchConfiguration': {
                    'numberOfResults': 5,
                    'filter': {
                        'equals': {
                            'key': 'category',
                            'value': 'medical'
                        }
                    }
                }
            }
        }
    }
)
```

#### Node.js Example
```javascript
import { BedrockAgentRuntimeClient, RetrieveAndGenerateCommand } from "@aws-sdk/client-bedrock-agent-runtime";

const client = new BedrockAgentRuntimeClient({ region: 'us-east-1' });

const command = new RetrieveAndGenerateCommand({
  input: {
    text: 'What are common tic symptoms in children?'
  },
  retrieveAndGenerateConfiguration: {
    type: 'KNOWLEDGE_BASE',
    knowledgeBaseConfiguration: {
      knowledgeBaseId: 'your-kb-id',
      modelArn: 'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0'
    }
  }
});

const response = await client.send(command);
```

### Recent Updates (2025-2026)
- **S3 Vectors** (Dec 2025): Cost-optimized storage, 90% cheaper than OpenSearch
- **Multimodal capabilities**: Support for images and mixed content
- **Guardrails integration**: Apply guardrails to Knowledge Base responses
- **Structured data retrieval**: Query structured databases

### Cost Optimization
- Use S3 Vectors for storage (cheapest option)
- Cache frequent queries
- Optimize chunk sizes and overlap
- Use metadata filters to reduce retrieval scope

### Testing Strategy
```python
# test_knowledge_base.py
def test_knowledge_base_returns_relevant_answer():
    response = query_knowledge_base(
        query="What are motor tics?",
        kb_id="kb-xxx"
    )
    assert 'citations' in response
    assert len(response['citations']) > 0
    assert 'tic' in response['output']['text'].lower()
```

**Sources:**
- [Retrieve data and generate AI responses with Amazon Bedrock Knowledge Bases](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html)
- [How to Build a Knowledge Base Q&A System with Bedrock](https://oneuptime.com/blog/post/2026-02-12-build-a-knowledge-base-qa-system-with-bedrock/view)
- [How to Use Amazon Bedrock Knowledge Bases for RAG](https://oneuptime.com/blog/post/2026-02-12-amazon-bedrock-knowledge-bases-rag/view)

---

## 4. AWS Step Functions Local Testing

### Overview
**Major update in November 2025**: AWS introduced enhanced TestState API that enables true local unit testing of Step Functions without deployment or IAM permissions.

### Testing Options

#### Option 1: TestState API (Recommended, New in Nov 2025)

**Features:**
- Test individual states without deployment
- Mock state outputs and errors
- Validate all state types (Map, Parallel, Task, etc.)
- Works with any testing framework (Jest, pytest, JUnit)
- No AWS charges for TestState API calls

**Example with AWS CLI:**
```bash
# Test a single state with mocked input
aws stepfunctions test-state \
  --definition file://state-machine.json \
  --state-name "ProcessVideo" \
  --role-arn arn:aws:iam::123456789012:role/StepFunctionsRole \
  --input '{"videoKey": "test-video.mp4"}'
```

**Python Example with boto3:**
```python
import boto3
import json

sfn_client = boto3.client('stepfunctions')

# Load state machine definition
with open('state-machine.json') as f:
    definition = json.load(f)

# Test specific state
response = sfn_client.test_state(
    definition=json.dumps(definition),
    roleArn='arn:aws:iam::123456789012:role/StepFunctionsRole',
    input=json.dumps({"videoKey": "test-video.mp4"}),
    stateName='ProcessVideo',
    inspectionLevel='DEBUG'
)

# Check output
assert response['status'] == 'SUCCEEDED'
output = json.loads(response['output'])
```

**With Mocking:**
```python
# Mock Lambda function response
response = sfn_client.test_state(
    definition=json.dumps(definition),
    roleArn='arn:aws:iam::123456789012:role/StepFunctionsRole',
    input=json.dumps({"videoKey": "test-video.mp4"}),
    stateName='InvokeLambda',
    inspectionLevel='DEBUG',
    # Mock the Lambda invocation
    mocks=[
        {
            'name': 'my-lambda-function',
            'output': json.dumps({
                'statusCode': 200,
                'body': json.dumps({'result': 'success'})
            })
        }
    ]
)
```

**Node.js Example with Jest:**
```javascript
import { SFNClient, TestStateCommand } from "@aws-sdk/client-sfn";

describe('Step Functions State Tests', () => {
  const client = new SFNClient({ region: 'us-east-1' });

  test('ProcessVideo state handles input correctly', async () => {
    const command = new TestStateCommand({
      definition: JSON.stringify(stateMachineDefinition),
      roleArn: 'arn:aws:iam::123456789012:role/StepFunctionsRole',
      input: JSON.stringify({ videoKey: 'test-video.mp4' }),
      stateName: 'ProcessVideo',
      inspectionLevel: 'DEBUG'
    });

    const response = await client.send(command);
    expect(response.status).toBe('SUCCEEDED');

    const output = JSON.parse(response.output);
    expect(output).toHaveProperty('analysisResult');
  });
});
```

#### Option 2: Step Functions Local (Docker/JAR)

**Setup:**
```bash
# Using Docker
docker run -p 8083:8083 amazon/aws-stepfunctions-local

# Or download JAR
java -jar StepFunctionsLocal.jar --lambda-endpoint http://localhost:3001
```

**Mock Configuration File:**
```json
{
  "StateMachines": {
    "TicTrackVideoProcessing": {
      "TestState": {
        "ProcessVideo": {
          "Return": {
            "analysisResult": {
              "ticDetected": true,
              "confidence": 0.95
            }
          }
        }
      }
    }
  }
}
```

**Pros:**
- Full state machine execution
- Can integrate with local Lambda (SAM Local, LocalStack)

**Cons:**
- More complex setup
- Requires Docker or Java runtime
- Marked as "unsupported" by AWS

#### Option 3: LocalStack (Enhanced in 2025)

LocalStack partnered with AWS to provide TestState API support:

```bash
# Start LocalStack with Step Functions
docker-compose up

# Test with LocalStack
awslocal stepfunctions test-state \
  --definition file://state-machine.json \
  --state-name "ProcessVideo" \
  --input '{"videoKey": "test-video.mp4"}'
```

### Recommended Approach for TicTrack

**Unit Tests**: Use TestState API with mocking
```python
# test_step_functions.py
def test_video_processing_state():
    response = test_state_with_mock(
        state_name='ProcessVideo',
        input_data={'videoKey': 's3://bucket/video.mp4'},
        mock_bedrock_response={'ticDetected': True}
    )
    assert response['status'] == 'SUCCEEDED'
```

**Integration Tests**: Deploy to AWS and test with actual resources
```python
def test_full_workflow_integration():
    execution = start_execution(
        state_machine_arn='arn:aws:states:...',
        input_data={'videoKey': 'test-video.mp4'}
    )
    wait_for_completion(execution['executionArn'])
    output = get_execution_output(execution['executionArn'])
    assert output['status'] == 'success'
```

### Cost
TestState API calls are **free** (included with Step Functions at no additional charge).

**Sources:**
- [AWS Step Functions enhances Local Testing with TestState API](https://aws.amazon.com/about-aws/whats-new/2025/11/aws-step-functions-local-testing-teststate-api/)
- [Accelerate workflow development with enhanced local testing in AWS Step Functions](https://aws.amazon.com/blogs/aws/accelerate-workflow-development-with-enhanced-local-testing-in-aws-step-functions/)
- [Testing state machines with TestState API](https://docs.aws.amazon.com/step-functions/latest/dg/test-state-isolation.html)
- [Effective Unit Testing for AWS Step Functions](https://blog.localstack.cloud/effective-unit-testing-for-aws-step-functions/)

---

## 5. AWS SDK Configuration for Local Development

### Credential Hierarchy
AWS SDKs follow a standardized credential resolution order:

1. **Environment variables**
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_SESSION_TOKEN` (optional)
   - `AWS_BEARER_TOKEN_BEDROCK` (Bedrock API keys)

2. **Shared credentials file** (`~/.aws/credentials`)
   ```ini
   [default]
   aws_access_key_id = AKIAIOSFODNN7EXAMPLE
   aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

   [work]
   aws_access_key_id = AKIAI44QH8DHBEXAMPLE
   aws_secret_access_key = je7MtGbClwBF/2Zp9Utk/h3yCo8nvbEXAMPLEKEY
   ```

3. **Shared config file** (`~/.aws/config`)
   ```ini
   [default]
   region = us-east-1
   output = json

   [profile work]
   region = us-west-2
   output = json
   ```

4. **IAM role** (when running on AWS resources)

5. **Container credentials** (ECS task roles)

### Setup Methods

#### Method 1: AWS CLI Configure
```bash
aws configure
# Enter: Access Key ID, Secret Access Key, Region, Output format

# For named profiles
aws configure --profile work
```

#### Method 2: Manual File Creation
Create `~/.aws/credentials` and `~/.aws/config` manually with content shown above.

#### Method 3: Environment Variables
```bash
export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
export AWS_DEFAULT_REGION=us-east-1
```

#### Method 4: Console Credentials Login (New 2025)
```bash
aws login
# Opens browser for AWS Console authentication
# Credentials auto-refresh every 15 minutes (up to 12 hours)
```

### Using Named Profiles

**Environment variable:**
```bash
export AWS_PROFILE=work
```

**In code (Python):**
```python
import boto3

# Use specific profile
session = boto3.Session(profile_name='work')
bedrock = session.client('bedrock-runtime')
```

**In code (Node.js):**
```javascript
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { fromIni } from "@aws-sdk/credential-providers";

const client = new BedrockRuntimeClient({
  region: 'us-east-1',
  credentials: fromIni({ profile: 'work' })
});
```

### Region Configuration

**Priority order:**
1. Explicitly set in client initialization
2. `AWS_REGION` environment variable
3. `AWS_DEFAULT_REGION` environment variable
4. Config file (`~/.aws/config`)

### Best Practices

**Security:**
- Never commit credentials to version control
- Add `.aws/` to `.gitignore`
- Use `.env` files with environment variables (also in `.gitignore`)
- Rotate credentials regularly
- Use API keys for Bedrock (scope-limited)

**Organization:**
- Use named profiles for different environments (dev, staging, prod)
- Document required IAM permissions in README
- Use `AWS_PROFILE` in deployment scripts

**For TicTrack:**
```bash
# .env.local (gitignored)
AWS_PROFILE=tictrack-dev
AWS_REGION=us-east-1
AWS_BEARER_TOKEN_BEDROCK=<api-key>  # For Bedrock-only access
```

```python
# Load environment in tests
from dotenv import load_dotenv
load_dotenv('.env.local')

# SDK automatically picks up credentials
bedrock = boto3.client('bedrock-runtime')
```

**Sources:**
- [Using shared config and credentials files to globally configure AWS SDKs and tools](https://docs.aws.amazon.com/sdkref/latest/guide/file-format.html)
- [Configuration and credential file settings in the AWS CLI](https://docs.aws.amazon.com/cli/v1/userguide/cli-configure-files.html)
- [Login for AWS local development using console credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sign-in.html)
- [Use AWS shared configuration profiles in the AWS SDK for Java 2.x](https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/credentials-profiles.html)

---

## 6. Cost Optimization for Development/Testing

### Cost Drivers
- **Model invocations**: Input tokens + output tokens
- **Prompt caching**: Reduced costs for repeated prefixes
- **Batch vs. on-demand**: Batch is 50% cheaper
- **Model selection**: Smaller models can be 10x+ cheaper

### Optimization Strategies

#### 1. Prompt Caching (Up to 85% Savings)
Cache repeated prompt prefixes to reduce input token costs.

**Example:**
```python
# First call: full cost
response = bedrock.invoke_model(
    modelId='anthropic.claude-3-5-sonnet-20241022-v2:0',
    body=json.dumps({
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "System: You are a tic symptom analyzer..."},  # This gets cached
                    {"type": "text", "text": "Analyze this video: ..."}
                ]
            }
        ]
    })
)

# Subsequent calls: 85% cheaper for cached prefix
response = bedrock.invoke_model(
    modelId='anthropic.claude-3-5-sonnet-20241022-v2:0',
    body=json.dumps({
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "System: You are a tic symptom analyzer..."},  # Cached (cheap)
                    {"type": "text", "text": "Analyze this different video: ..."}  # Only this is new
                ]
            }
        ]
    })
)
```

**Supported models:** Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus, Claude 3 Haiku

#### 2. Batch Processing (50% Savings)
Use batch APIs for non-real-time workloads.

```python
# Submit batch job
batch_response = bedrock.create_model_invocation_job(
    modelId='amazon.nova-pro-v1:0',
    jobName='video-analysis-batch',
    inputDataConfig={
        's3InputDataConfig': {
            's3Uri': 's3://bucket/input-videos/'
        }
    },
    outputDataConfig={
        's3OutputDataConfig': {
            's3Uri': 's3://bucket/output-analysis/'
        }
    }
)

# Check status later
status = bedrock.get_model_invocation_job(jobIdentifier=batch_response['jobArn'])
```

**Best for:**
- Testing multiple prompts/models
- Bulk video analysis
- Weekly report generation

#### 3. Model Selection
Start with smaller, cheaper models and upgrade only when necessary.

**Cost comparison (approximate per 1M tokens):**
- **Claude 3.5 Haiku**: ~$1 input, ~$5 output
- **Claude 3.5 Sonnet**: ~$3 input, ~$15 output
- **Claude 3 Opus**: ~$15 input, ~$75 output
- **Nova Pro**: ~$0.80 input, ~$3.20 output
- **Nova Lite**: ~$0.06 input, ~$0.24 output

**Strategy:**
- Use Nova Lite for initial prototyping
- Use Nova Pro for video analysis (best price/performance)
- Use Claude 3.5 Sonnet for complex reasoning
- Reserve Opus for edge cases requiring highest quality

#### 4. Token Counting
Plan costs accurately with `count_tokens` API (free operation).

```python
# Count tokens before invoking
token_count = bedrock.count_tokens(
    modelId='anthropic.claude-3-5-sonnet-20241022-v2:0',
    messages=[
        {"role": "user", "content": [{"text": "Your prompt here..."}]}
    ]
)

estimated_cost = (token_count['inputTokens'] * INPUT_PRICE_PER_1M / 1_000_000) + \
                 (expected_output_tokens * OUTPUT_PRICE_PER_1M / 1_000_000)

print(f"Estimated cost: ${estimated_cost:.4f}")

# Only proceed if within budget
if estimated_cost < budget_threshold:
    response = bedrock.invoke_model(...)
```

#### 5. Intelligent Prompt Routing (Up to 30% Savings)
Let Bedrock automatically route prompts to optimal models within a family.

```python
response = bedrock.invoke_model(
    modelId='us.anthropic.claude-3-5-sonnet-20241022-v2:0',  # Router model
    body=json.dumps({
        "messages": [{"role": "user", "content": "Analyze this..."}],
        "inferenceConfig": {
            "performance": {
                "latency": "optimized"  # or "cost" or "balanced"
            }
        }
    })
)
```

Bedrock selects appropriate model variant based on complexity and preferences.

#### 6. Development-Specific Tips

**Use mocks for unit tests:**
```python
# Don't hit real API in unit tests
@mock.patch('boto3.client')
def test_video_analysis(mock_client):
    mock_client.return_value.invoke_model.return_value = {
        'body': MagicMock(read=lambda: b'{"result": "mocked"}')
    }
    # Test logic without API costs
```

**Limit test data size:**
```python
# Use small test videos/images
TEST_VIDEO_PATH = 'test-data/short-clip-5sec.mp4'  # Not full 2-minute video
```

**Set up development quotas:**
```python
# Add circuit breaker for development
daily_invocations = get_daily_count()
if daily_invocations > DEV_DAILY_LIMIT:
    raise Exception("Daily development quota exceeded")
```

**Use LocalStack for initial development:**
```bash
# Free local testing before AWS integration
docker run -d -p 4566:4566 localstack/localstack
export AWS_ENDPOINT_URL=http://localhost:4566
```

### Cost Estimation for TicTrack

**Assumptions:**
- 50 videos/month during development
- Average 30-second clips
- Nova Pro for video analysis (~$0.004/video)
- Claude 3.5 Sonnet for report generation (~$0.10/report)
- 4 weekly reports/month

**Estimated monthly cost:**
- Video analysis: 50 × $0.004 = $0.20
- Weekly reports: 4 × $0.10 = $0.40
- Misc (experimentation, retries): $1.00
- **Total: ~$1.60/month during development**

**With optimizations:**
- Prompt caching: -50% = $0.80/month
- Batch processing for tests: -25% = $0.60/month
- **Optimized total: ~$0.60-$1.00/month**

**Sources:**
- [Effective cost optimization strategies for Amazon Bedrock](https://aws.amazon.com/blogs/machine-learning/effective-cost-optimization-strategies-for-amazon-bedrock/)
- [Amazon Bedrock Cost Optimization](https://aws.amazon.com/bedrock/cost-optimization/)
- [Amazon Bedrock Cost Optimization: Techniques & Best Practices](https://dev.to/brayanarrieta/amazon-bedrock-cost-optimization-techniques-best-practices-5om)
- [5 Cost Levers To Consider When Adopting Amazon Bedrock](https://www.cloudzero.com/blog/amazon-bedrock-costs/)

---

## 7. Mocking Strategies for Unit Tests

### Overview
Proper mocking prevents API costs during unit tests and enables TDD workflows without AWS dependencies.

### Approach 1: AWS SDK Mocking (Python with Moto)

**Installation:**
```bash
pip install moto boto3 pytest
```

**Limitation:** Moto doesn't natively support `bedrock-runtime` yet (as of 2025).

**Workaround - Generic Mock:**
```python
from moto import mock_aws
from unittest.mock import patch, MagicMock
import boto3
import json

@patch('boto3.client')
def test_video_analysis_with_bedrock_mock(mock_boto_client):
    # Mock the Bedrock client
    mock_bedrock = MagicMock()
    mock_boto_client.return_value = mock_bedrock

    # Mock the response
    mock_response = {
        'body': MagicMock(
            read=lambda: json.dumps({
                'output': {
                    'message': {
                        'content': [
                            {
                                'text': json.dumps({
                                    'ticDetected': True,
                                    'ticType': 'motor',
                                    'confidence': 0.95
                                })
                            }
                        ]
                    }
                }
            }).encode()
        )
    }
    mock_bedrock.invoke_model.return_value = mock_response

    # Test your function
    result = analyze_video_with_bedrock('s3://bucket/video.mp4')

    # Assertions
    assert result['ticDetected'] is True
    assert result['confidence'] > 0.9
    mock_bedrock.invoke_model.assert_called_once()
```

**Custom Converse API Mock:**
```python
def test_converse_api_with_guardrail():
    with patch('boto3.client') as mock_client:
        mock_bedrock = MagicMock()
        mock_client.return_value = mock_bedrock

        # Mock guardrail intervention
        mock_bedrock.converse.return_value = {
            'stopReason': 'guardrail_intervened',
            'output': {
                'message': {
                    'content': [
                        {'text': 'Request blocked by guardrail'}
                    ]
                }
            }
        }

        result = chat_with_guardrail("Share confidential data")
        assert result['blocked'] is True
```

### Approach 2: LocalStack (Full Service Emulation)

**Setup:**
```yaml
# docker-compose.yml
services:
  localstack:
    image: localstack/localstack:latest
    ports:
      - "4566:4566"
    environment:
      - SERVICES=bedrock,s3,dynamodb,stepfunctions
      - DEBUG=1
```

**Usage in tests:**
```python
import boto3
import pytest

@pytest.fixture
def bedrock_client():
    return boto3.client(
        'bedrock-runtime',
        endpoint_url='http://localhost:4566',
        region_name='us-east-1'
    )

def test_with_localstack(bedrock_client):
    # LocalStack will handle the request
    # Responses can be configured via LocalStack API
    response = bedrock_client.invoke_model(
        modelId='amazon.nova-pro-v1:0',
        body=json.dumps({"messages": [...]})
    )
    assert response is not None
```

**Pros:**
- Full service emulation
- Multi-service integration testing
- Consistent with AWS API

**Cons:**
- Requires Docker
- Slower than unit mocks
- Limited Bedrock model simulation

### Approach 3: Response Fixtures (Recommended for TicTrack)

Create realistic response fixtures for consistent testing.

**Structure:**
```
tests/
  fixtures/
    bedrock_responses/
      video_analysis_tic_detected.json
      video_analysis_no_tic.json
      knowledge_base_tic_info.json
      guardrail_blocked.json
```

**Example fixture:**
```json
// tests/fixtures/bedrock_responses/video_analysis_tic_detected.json
{
  "output": {
    "message": {
      "content": [
        {
          "text": "{\"ticDetected\": true, \"ticType\": \"motor\", \"bodyPart\": \"face\", \"confidence\": 0.95, \"timestamp\": 2.5, \"description\": \"Rapid eye blinking observed\"}"
        }
      ]
    }
  },
  "stopReason": "end_turn",
  "usage": {
    "inputTokens": 150,
    "outputTokens": 50
  }
}
```

**Test helper:**
```python
# tests/helpers/bedrock_mock.py
import json
from pathlib import Path
from unittest.mock import MagicMock

FIXTURES_DIR = Path(__file__).parent.parent / 'fixtures' / 'bedrock_responses'

def load_fixture(filename):
    with open(FIXTURES_DIR / filename) as f:
        return json.load(f)

def mock_bedrock_client(fixture_map):
    """
    fixture_map: dict mapping model IDs to fixture filenames
    Example: {'amazon.nova-pro-v1:0': 'video_analysis_tic_detected.json'}
    """
    mock_client = MagicMock()

    def invoke_side_effect(*args, **kwargs):
        model_id = kwargs.get('modelId')
        fixture_file = fixture_map.get(model_id, 'default_response.json')
        fixture_data = load_fixture(fixture_file)

        # Create mock response
        mock_response = {
            'body': MagicMock(
                read=lambda: json.dumps(fixture_data).encode()
            ),
            'contentType': 'application/json'
        }
        return mock_response

    mock_client.invoke_model.side_effect = invoke_side_effect
    return mock_client

# Usage in tests
def test_video_analysis_detects_tic(monkeypatch):
    mock_client = mock_bedrock_client({
        'amazon.nova-pro-v1:0': 'video_analysis_tic_detected.json'
    })

    monkeypatch.setattr('boto3.client', lambda *args, **kwargs: mock_client)

    result = analyze_video('s3://bucket/video.mp4')

    assert result['ticDetected'] is True
    assert result['ticType'] == 'motor'
    assert result['confidence'] == 0.95
```

### Approach 4: Dependency Injection (Best for TDD)

Design code to accept client as parameter for easy mocking.

**Bad (tightly coupled):**
```python
def analyze_video(video_key):
    bedrock = boto3.client('bedrock-runtime')  # Hard to mock
    response = bedrock.invoke_model(...)
    return parse_response(response)
```

**Good (dependency injection):**
```python
def analyze_video(video_key, bedrock_client=None):
    if bedrock_client is None:
        bedrock_client = boto3.client('bedrock-runtime')

    response = bedrock_client.invoke_model(...)
    return parse_response(response)

# Test easily
def test_analyze_video():
    mock_client = create_mock_bedrock_client()
    result = analyze_video('video.mp4', bedrock_client=mock_client)
    assert result['ticDetected'] is True
```

**Even better (class-based):**
```python
class VideoAnalyzer:
    def __init__(self, bedrock_client=None):
        self.bedrock = bedrock_client or boto3.client('bedrock-runtime')

    def analyze(self, video_key):
        response = self.bedrock.invoke_model(...)
        return self.parse_response(response)

# Test with mock injected
def test_video_analyzer():
    mock_client = create_mock_bedrock_client()
    analyzer = VideoAnalyzer(bedrock_client=mock_client)
    result = analyzer.analyze('video.mp4')
    assert result['ticDetected'] is True
```

### Approach 5: Interface Mocking (Go)

**For Go projects:**
```go
// Use bedrockiface for mocking
import (
    "github.com/aws/aws-sdk-go/service/bedrock/bedrockiface"
)

type mockBedrockClient struct {
    bedrockiface.BedrockAPI
    InvokeModelFunc func(*bedrock.InvokeModelInput) (*bedrock.InvokeModelOutput, error)
}

func (m *mockBedrockClient) InvokeModel(input *bedrock.InvokeModelInput) (*bedrock.InvokeModelOutput, error) {
    return m.InvokeModelFunc(input)
}

// Test
func TestAnalyzeVideo(t *testing.T) {
    mockClient := &mockBedrockClient{
        InvokeModelFunc: func(input *bedrock.InvokeModelInput) (*bedrock.InvokeModelOutput, error) {
            return &bedrock.InvokeModelOutput{
                Body: []byte(`{"ticDetected": true}`),
            }, nil
        },
    }

    result := analyzeVideo("video.mp4", mockClient)
    assert.True(t, result.TicDetected)
}
```

### Recommended Strategy for TicTrack

**Layer 1: Unit Tests (Fast, No AWS)**
```python
# Use fixture-based mocks
def test_video_analyzer_parses_response():
    mock_client = mock_bedrock_client({
        'amazon.nova-pro-v1:0': 'video_analysis_tic_detected.json'
    })
    analyzer = VideoAnalyzer(bedrock_client=mock_client)
    result = analyzer.analyze('test-video.mp4')
    assert result['ticDetected'] is True
```

**Layer 2: Integration Tests (Slow, Real AWS)**
```python
# Use real Bedrock with @pytest.mark.integration
@pytest.mark.integration
def test_video_analyzer_real_bedrock():
    analyzer = VideoAnalyzer()  # Uses real boto3 client
    result = analyzer.analyze('s3://test-bucket/real-test-video.mp4')
    assert 'ticDetected' in result
```

**Layer 3: Contract Tests (Validate Fixtures)**
```python
# Ensure fixtures match real API responses
@pytest.mark.integration
def test_fixture_matches_real_response():
    real_client = boto3.client('bedrock-runtime')
    real_response = real_client.invoke_model(
        modelId='amazon.nova-pro-v1:0',
        body=json.dumps(test_payload)
    )

    fixture = load_fixture('video_analysis_tic_detected.json')

    # Validate structure matches
    assert set(real_response.keys()) == set(fixture.keys())
```

**Run strategy:**
```bash
# Fast feedback (unit tests only)
pytest -m "not integration"

# Full validation (before deployment)
pytest

# Update fixtures (after API changes)
pytest -m contract --update-fixtures
```

**Sources:**
- [Unit Testing Amazon Bedrock in Python](https://medium.com/@peterjdavis/unit-testing-amazon-bedrock-in-python-3b5558fb7c9a)
- [Bedrock | LocalStack Docs](https://docs.localstack.cloud/aws/services/bedrock/)
- [bedrockiface - Amazon Web Services - Go SDK](https://docs.aws.amazon.com/sdk-for-go/api/service/bedrock/bedrockiface/)
- [Effective Unit Testing for AWS Step Functions](https://blog.localstack.cloud/effective-unit-testing-for-aws-step-functions/)

---

## Summary Table

| Service | Local Testing | Requires Deployment | Authentication | Cost During Dev |
|---------|---------------|---------------------|----------------|-----------------|
| **Bedrock API** | Yes (via SDK) | No | API keys or IAM | Pay per token |
| **Guardrails** | Yes (via API) | Must create in console | Same as Bedrock | Free (only model costs) |
| **Knowledge Bases** | Yes (via API) | Must create KB in AWS | Same as Bedrock | Free (only model costs) |
| **Step Functions** | Yes (TestState API) | No | IAM (for TestState) | Free |
| **Step Functions Local** | Yes (Docker/JAR) | No | None | Free |

---

## Recommended Setup for TicTrack

### 1. Authentication
```bash
# Generate Bedrock API key in console
export AWS_BEARER_TOKEN_BEDROCK=<your-api-key>

# Or use named profile
aws configure --profile tictrack-dev
export AWS_PROFILE=tictrack-dev
```

### 2. Project Structure
```
tictrack/
  src/
    services/
      bedrock/
        video_analyzer.py       # VideoAnalyzer class
        knowledge_base.py       # KB query wrapper
        guardrails.py          # Guardrail utilities
    workflows/
      step_functions/
        video_processing.json  # State machine definition
  tests/
    unit/
      test_video_analyzer.py   # Mocked Bedrock tests
    integration/
      test_bedrock_real.py     # Real Bedrock calls
    fixtures/
      bedrock_responses/       # JSON fixtures
  .env.local                   # Credentials (gitignored)
```

### 3. Dependencies
```bash
# Python
pip install boto3 python-dotenv pytest pytest-mock

# Node.js
npm install @aws-sdk/client-bedrock-runtime @aws-sdk/client-bedrock-agent-runtime
```

### 4. Test Configuration
```python
# tests/conftest.py
import pytest
import os
from dotenv import load_dotenv

load_dotenv('.env.local')

@pytest.fixture
def bedrock_client_mock():
    from tests.helpers.bedrock_mock import mock_bedrock_client
    return mock_bedrock_client({
        'amazon.nova-pro-v1:0': 'video_analysis_tic_detected.json'
    })

@pytest.fixture
def bedrock_client_real():
    import boto3
    return boto3.client('bedrock-runtime', region_name='us-east-1')
```

### 5. Development Workflow

**Day-to-day (fast feedback):**
```bash
# Run unit tests with mocks (no AWS costs)
pytest tests/unit/ -v

# Single feature development
pytest tests/unit/test_video_analyzer.py -k test_detects_motor_tic
```

**Integration validation (before commits):**
```bash
# Run integration tests (small AWS costs)
pytest tests/integration/ --maxfail=1

# Full test suite
pytest
```

**Step Functions testing:**
```bash
# Test individual states
aws stepfunctions test-state \
  --definition file://src/workflows/step_functions/video_processing.json \
  --state-name ProcessVideo \
  --input file://tests/fixtures/step_functions/video_input.json

# Or via pytest
pytest tests/unit/test_step_functions.py
```

### 6. Cost Control
```python
# src/services/bedrock/config.py
import os

DEV_MODE = os.getenv('DEV_MODE', 'true') == 'true'
MAX_DAILY_INVOCATIONS = int(os.getenv('MAX_DAILY_INVOCATIONS', '100'))

# Circuit breaker for development
def check_dev_quota():
    if DEV_MODE:
        count = get_daily_invocation_count()
        if count >= MAX_DAILY_INVOCATIONS:
            raise Exception(f"Development quota exceeded: {count}/{MAX_DAILY_INVOCATIONS}")
```

---

## Key Takeaways for TicTrack

1. **Full local development is possible**: All Bedrock services accessible via SDK
2. **Use API keys for simplicity**: Easier than IAM credential management for dev
3. **TestState API is a game-changer**: True local unit testing for Step Functions
4. **Mocking is essential for TDD**: Use fixture-based approach with dependency injection
5. **Cost is minimal**: ~$1-2/month during active development with optimizations
6. **S3 Vectors for KB**: 90% cheaper than OpenSearch, perfect for competition timeline
7. **Batch processing for tests**: Use batch API when comparing models/prompts

---

## Next Steps

1. **Set up authentication**: Generate Bedrock API key
2. **Create test fixtures**: Build realistic response fixtures for common scenarios
3. **Implement mock helpers**: Create `bedrock_mock.py` with fixture loader
4. **Set up pytest configuration**: Configure unit vs integration test markers
5. **Test Step Functions locally**: Validate state machine logic with TestState API
6. **Document cost tracking**: Add daily invocation counter for development monitoring

---

**Research completed**: 2026-03-06
**Last updated**: 2026-03-06
