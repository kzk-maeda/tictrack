# AIdeas: TicTrack — AI-Powered Tic Tracking for Caregivers

> **Category**: Daily Life Enhancement
> **Tags**: #aideas-2025, #daily-life-enhancement, #APJC
> **Team Name**: TicTrack
> **Cover Image**: (attached separately)

---

## App Category

Daily Life Enhancement

## My Vision

When a child shows signs of tics, caregivers struggle to accurately track "when do they happen?" and "how often?" and communicate that to healthcare providers. Symptoms fluctuate, constant observation is impossible, and gaps in recording are inevitable. Above all, for caregivers without medical expertise, putting tic symptoms into precise words is extremely difficult.

TicTrack is a caregiver-first, non-diagnostic application designed to solve this challenge.

**AI-powered auto-labeling from video** is the core of TicTrack. When a caregiver records a short 10-20 second video on their smartphone, Amazon Bedrock's Nova Pro model analyzes the footage and automatically suggests structured labels including symptom name, type (motor/vocal), complexity, intensity, confidence score, and timestamped observations. Caregivers no longer need to wonder "how do I describe that movement?"

For symptoms already identified, caregivers can register them as **Tic Cards** and log occurrences with a single tap. New symptoms are captured via video + AI; known symptoms via one-tap logging. By combining these two recording methods, caregivers can maintain consistent tracking without disrupting daily life.

Additionally, medication status and life events (school transfers, relocations, etc.) can be recorded along with stress levels. The **Dashboard** visualizes trends including type distribution, severity distribution, and time-of-day patterns. This information can be used directly during medical consultations — when asked "how have things been recently?", caregivers can explain with data rather than memory.

## Why This Matters

I personally faced my son's tic symptoms and felt the difficulty and anxiety of trying to explain "when and how often they occur." This is not just my problem.

**1 in 5 children** experience some form of tic during their growth. It is far from rare — yet there are almost no recording tools to support caregivers.

Existing self-tracking tools assume that the person recording is self-aware of their symptoms, but caregivers need a different approach. It is impossible to observe a child's symptoms 24 hours a day, and missed observations are unavoidable. TicTrack is designed with this **missing-data tolerant** approach as a core assumption.

Value TicTrack delivers:

- **Reduced caregiver burden**: One-tap logging and AI auto-labeling minimize friction in recording
- **Symptom verbalization support**: AI generates structured information that healthcare providers can understand, eliminating the anxiety of "I can't explain it"
- **Improved healthcare collaboration**: Data-driven consultations make the most of limited appointment time
- **Contextual recording**: Visualize correlations between medication, life changes, and symptoms

This app is **non-diagnostic** (it does not provide diagnosis or treatment advice). AI suggestions are just that — suggestions. Final confirmation and edits are made by the caregiver.

### Key Features

- **Video Recording + AI Auto-Labeling**: Video analysis and structured label suggestions powered by Amazon Bedrock Nova Pro
- **Tic Cards**: One-tap logging for frequently observed symptoms
- **Timeline**: Calendar view to review records over time
- **Medication Management**: One-tap medication logging
- **Life Events**: Record life events with stress levels
- **Dashboard**: Statistical trend visualization and information for healthcare providers
- **Demo Mode**: Try the app without signing up
- **PWA**: No app store required — accessible from any smartphone browser

## How I Built This

### Architecture Overview

TicTrack is built on Amplify Gen 2's serverless architecture with a dual-language configuration.

<!-- TODO: Insert architecture diagram -->
![Architecture Diagram](./architecture_diagram.png)

**Data Flow:**

1. **Frontend**: Next.js 14 PWA (Serwist) running on Amplify Hosting
2. **Authentication**: Amazon Cognito manages caregiver authentication and authorization (with COPPA consent flag)
3. **API**: API Gateway + Cognito Authorizer routes requests to Lambda (api-handler) for CRUD operations
4. **Data Storage**: DynamoDB with 12 tables (Users, Children, TicCards, Episodes, AILabels, etc.), videos stored in S3
5. **AI Analysis Workflow**: After video upload, Step Functions orchestrates the analysis. A Strands Agent on AgentCore Runtime uses Nova Pro to analyze the video and stores structured labels in DynamoDB

### AWS Services Used

| Service | Purpose |
|---------|---------|
| **AWS Amplify Hosting** | Next.js PWA hosting and CI/CD |
| **Amazon Cognito** | Authentication (User Pool + Identity Pool), COPPA consent management |
| **Amazon API Gateway** | REST API with Cognito Authorizer routing |
| **AWS Lambda** | CRUD API handler (Node.js), AI proxy (Node.js), analysis trigger |
| **Amazon DynamoDB** | 12 tables, PAY_PER_REQUEST, flexible queries via GSIs |
| **Amazon S3** | Video storage (Presigned URLs), knowledge base, lifecycle rules |
| **AWS Step Functions** | AI labeling workflow orchestration (retry and error handling) |
| **Amazon Bedrock** | Nova Pro (video analysis), Claude Haiku (text generation), Guardrails (non-diagnostic constraints) |
| **Bedrock AgentCore Runtime** | Managed execution environment for AI agents built with Strands Agents SDK |
| **Amazon ECR** | Docker image management for AI agents |
| **Amazon CloudWatch** | Log monitoring for Lambda, Step Functions, and AgentCore |
| **AWS CDK** | IaC via Amplify Gen 2 + custom CDK constructs |

### Key Technical Decisions

**1. Nova Pro for Video Analysis**

We chose Amazon Nova Pro for multimodal video analysis. It supports direct input from S3 URIs, eliminating the need to download or encode videos. The cost is approximately $0.004 per video, making it ideal for prototyping.

**2. Step Functions for Workflow Management**

AI analysis is an asynchronous process requiring timeout, retry, and error handling. Step Functions allows these to be defined declaratively, keeping Lambda code simple. On failure, episode status is automatically updated to "failed".

**3. Amplify Gen 2 + CDK Custom Constructs**

Amplify Gen 2 makes it easy to set up authentication, storage, and hosting, while CDK custom constructs allow adding DynamoDB tables, API Gateway, Step Functions, and more. All infrastructure is managed from a single `backend.ts`, using a staged activation pattern to incrementally enable resources.

**4. Strands Agent with 5-Tool Architecture and Multimodal Integration**

The Tic Labeling Agent at the core of AI labeling is built with the Strands Agents SDK using 5 specialized tools:

1. **analyze_video** — Nova Pro directly analyzes video on S3, extracting movement types, timing, and intensity
2. **transcribe_audio** — Amazon Transcribe detects vocal tics (throat clearing, sniffing, etc.) from the audio track
3. **integrate_results** — Integrates video and audio results to generate structured labels with 2-axis classification (type x complexity)
4. **apply_guardrails** — Bedrock Guardrails blocks diagnostic language; falls back to keyword filtering when not configured
5. **store_label** — Saves results to the AILabels table in DynamoDB and updates episode status

Claude Sonnet 4.5 serves as the agent orchestrator, dynamically determining tool invocation order and arguments. By separating video analysis (visual) and audio analysis (auditory) into independent tools, analysis can continue with one result even if the other fails, achieving fault tolerance.

**5. Multi-Layered Safety Design (Non-Diagnostic Constraints)**

As healthcare-adjacent AI, non-diagnostic constraints are enforced across multiple layers:

- **Prompt layer**: System prompts instruct "use observational language only" and "prohibit diagnosis or treatment advice"
- **Guardrails layer**: Bedrock Guardrails detects and sanitizes diagnostic language via topic policies
- **Fallback layer**: When Guardrails is not configured, keyword filtering for prohibited terms ("diagnosis", "treatment", "Tourette", etc.) serves as backup
- **Sanitization**: When violations are detected, expressions are converted to observational language (e.g., "is diagnosed" -> "appears to show", "causes" -> "is associated with")

All AI-generated text passes through these filters, preventing definitive medical statements that could cause caregiver anxiety.

**6. Asynchronous Analysis Pipeline with Staged Fallback**

Video analysis takes tens of seconds to minutes, so it is designed as a fully asynchronous pipeline:

1. Frontend calls `POST /episodes/{id}/analyze`, and Lambda (start-analysis) immediately returns **202 Accepted**
2. Step Functions launches in the background, calling the agent on AgentCore Runtime via agentcore-proxy Lambda
3. Upon completion, episode status updates from `analyzing` to `ai_suggested`, detected by frontend polling

Step Functions' retry policy (3 attempts, exponential backoff 2.0, initial interval 10s) and timeout (15 min) handle transient failures automatically. For unrecoverable failures, the `MarkAsFailed` state updates the episode to `failed`, and the UI prompts the caregiver to retry.

### Development with Kiro

TicTrack was developed using Kiro IDE's Spec-driven Development workflow.

**Establishing Project Context with Steering Files:**
Early in development, we defined product overview, tech stack, and directory structure in Kiro's Steering Files. This enabled Kiro's agent to accurately understand the project context and provide effective code generation and refactoring support.

**Pre-defining Design with Specs:**
Requirements for each implementation step were defined in EARS format, and architecture designs and implementation tasks were managed as Kiro Specs. This clarified requirements, acceptance criteria, and test items before writing code, complementing the TDD approach well.

**Direct Access to Cloud Resources via AWS MCP Server:**
We connected [AWS Labs MCP Servers](https://github.com/awslabs/mcp) to Kiro's agent, delegating access to cloud resources — checking DynamoDB table data, searching CloudWatch logs, and verifying Lambda execution status — directly to the agent. This eliminated the need to switch between the AWS Console and the editor, completing log and data verification within agent conversations and dramatically accelerating the debug-develop cycle.

The combination of spec-driven development and MCP-powered cloud resource access enabled us to incrementally add features along a 10-step implementation roadmap, preventing scope creep and completing the MVP within a few days of development.

## Demo

<!-- TODO: Embed YouTube video -->
<!-- YouTube embed: https://youtu.be/qA6dofI-EAE -->

The following screenshots showcase TicTrack's key feature flow.

### Screenshot 1 — Authentication and Tic Card Registration

<!-- TODO: Insert screenshot -->
[screenshot01](./screenshots/screenshot_01.png)

Sign up with email, register a child's profile, and set up tic cards with symptom details (type, complexity, intensity).

### Screenshot 2 — One-Tap Logging

<!-- TODO: Insert screenshot -->
[screenshot02](./screenshots/screenshot_02.png)

Simply tap the "Log" button on a registered tic card to instantly record when and what happened. The design is optimized for one-handed smartphone operation.

### Screenshot 3 — Video Recording

<!-- TODO: Insert screenshot -->
[screenshot03](./screenshots/screenshot_03.png)

Start recording anytime from the "Record Video" button in the header. A countdown timer of up to 20 seconds ensures quick, reliable capture.

### Screenshot 4 — AI Auto-Labeling Results

<!-- TODO: Insert screenshot -->
[screenshot04](./screenshots/screenshot_04.png)

Amazon Bedrock Nova Pro analyzes the video and suggests structured labels including symptom name, type, complexity, intensity, confidence score, and timestamped observations. Caregivers can confirm with one tap or make edits.

### Screenshot 5 — Timeline and Calendar

<!-- TODO: Insert screenshot -->
[screenshot05](./screenshots/screenshot_05.png)

Record counts are displayed as badges on the calendar. Tapping a date shows all records in chronological order.

### Screenshot 6 — Dashboard

<!-- TODO: Insert screenshot -->
[screenshot06](./screenshots/screenshot_06.png)

Charts for type distribution, severity distribution, time-of-day patterns, and top 5 most frequent tics provide an at-a-glance view of trends. This information can be used directly during medical consultations.

## What I Learned

### 1. AI Constraint Design Is the Most Important Thing

TicTrack is a non-diagnostic app. Designing what the AI *doesn't* do was more important than what it *does*. The constraint against diagnosis and treatment advice is enforced through both Bedrock Guardrails and prompt design. I learned the critical importance of safe constraint design when applying AI in the healthcare domain.

### 2. Designing for Missing Data

Typical tracking apps assume complete data, but with tic symptom recording, missed observations are inevitable. The missing-data tolerant design philosophy — "read trends from whatever was recorded" — is consistently applied throughout the dashboard statistics and future weekly report generation.

### 3. The Power of Step Functions for Workflow Management

AI analysis involves external service calls as asynchronous processing, requiring timeout, retry, and partial failure handling. Initially, I tried managing these within Lambda, but migrating to Step Functions allowed retry policies and error handling to be defined declaratively, dramatically simplifying Lambda code.

### 4. Nova Pro's Video Analysis Capabilities

Amazon Nova Pro accepts video input directly from S3 URIs, requiring no frame extraction or encoding preprocessing. Its ability to detect subtle body movements like tic symptoms exceeded expectations, even producing timestamped observations. The cost of approximately $0.004 per video also makes scaling from prototype to production realistic.

### 5. Incremental Building with Amplify Gen 2 + CDK

Amplify Gen 2 enables rapid setup of authentication and storage, with CDK custom constructs providing highly flexible resource definitions. The staged activation pattern in `backend.ts` allowed incremental infrastructure enablement along a 10-step implementation roadmap, enabling steady growth of a working prototype even within a short development period.

### 6. Managed Agent Execution with AgentCore Runtime

Running AI agents built with the Strands Agents SDK on AgentCore Runtime freed us from ECS/Fargate infrastructure management. Deployment is as simple as pushing a Docker image to ECR — scaling and health checks are handled automatically by AgentCore. The ability to focus exclusively on business logic during agent development was a significant advantage.

## Future Work

### 1. MCP Server via AgentCore Gateway

TicTrack is currently a REST API-based application, but the next step is to use Amazon Bedrock AgentCore Gateway to expose TicTrack's functionality as an MCP (Model Context Protocol) Server. This would enable AI assistants like Claude to perform operations through natural language, such as "Tell me about my son's tic trends this week" or "Show me yesterday's video analysis results." Existing APIs can be converted to MCP-compatible tools with just a few lines of code, and AgentCore Gateway centrally manages authentication and authorization, enabling agent access while maintaining security.

### 2. Data Provision for Healthcare and Pharmaceutical Organizations

The medication records and symptom time-series data accumulated in TicTrack hold value beyond individual records. By providing anonymized, aggregated data to healthcare institutions and pharmaceutical companies, we can contribute to clinical knowledge accumulation — such as "how does a specific medication affect tic symptom frequency and severity?" Data would be provided through an opt-in model based on caregiver consent, supporting advances in tic symptom research and treatment.

### 3. Expert-Collaborated Knowledge Base

Current AI auto-labeling relies on general-purpose model capabilities, but we aim to collaborate with pediatric neurologists and tic specialists to build a systematized knowledge base. Using Amazon Bedrock Knowledge Bases and S3 Vectors, expert-curated symptom classification criteria, observation guidelines, and case studies would be made available via RAG (Retrieval-Augmented Generation). This would bring AI labeling accuracy and reliability closer to expert level, providing higher-value information for both caregivers and healthcare providers.

---

**Tags**: #aideas-2025 #daily-life-enhancement #APJC

**Team**: TicTrack

**Contact**: kzk-maeda
