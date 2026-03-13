AIdeas: Sentrix - AI-Powered SRE Copilot
An AI SRE copilot that uses multi-agent debate between three Amazon Bedrock Claude agents (SRE, Finance, Arbiter) to make autonomous, cost-aware infrastructure scaling decisions on Amazon EKS - and learns from every incident through a self-evolving feedback loop powered by Step Functions and DynamoDB thought signatures.

Ooi Yee Fei
Ooi Yee Fei
フォロー
公開済み 2026年3月9日

17

3


翻訳

App Category
Commercial Solutions
My Vision
Every SRE team has the same nightmare: it's 3am, traffic spikes, and nobody predicted it. By the time CloudWatch alerts fire, customers are already frustrated and revenue is lost.
Sentrix is an AI-powered SRE copilot that predicts infrastructure problems before they happen and autonomously scales your cloud resources. But what makes Sentrix different isn't just prediction — it's debate.
Instead of a single AI making decisions, Sentrix runs a multi-agent debate where three AI agents argue about every scaling decision:
AGENT_SRE (Amazon Bedrock Claude Haiku) prioritizes reliability: "Scale now, we can't risk downtime."
AGENT_FINANCE (Amazon Bedrock Claude Haiku) prioritizes cost: "That's 5x the replicas — do we really need all of them?"
AGENT_ARBITER (Amazon Bedrock Claude Sonnet) synthesizes both: "Scale to 3x now, monitor for 5 minutes, then reassess."
The result? Decisions that balance reliability and cost — like having three senior engineers on-call 24/7, except they never sleep and they learn from every incident.
What I built:
Real-time telemetry analysis with triple detection rules (surge, degradation, exhaustion)
Multi-agent AI debate for every significant scaling decision
Autonomous EKS pod scaling based on AI consensus
Decision memory in DynamoDB with thought signatures — accumulated learnings from every incident
Self-evolving feedback loop via Step Functions that scores decision effectiveness and feeds it back
Live dashboard showing debates, predictions, and health scores in real-time
Cross-cloud failover from AWS to GCP when cascading failures hit
Why This Matters
The $150B problem: Companies collectively waste over $150 billion annually on cloud resources — either over-provisioning "just in case" or scrambling when under-provisioned systems fail.
Traditional monitoring is fundamentally reactive. CloudWatch tells you thresholds breached. PagerDuty wakes someone up. That person makes a sleep-deprived decision at 3am. The incident postmortem reveals the spike was predictable from data available 15 minutes earlier.
Sentrix flips this model:
For SRE teams: Proactive action instead of reactive firefighting. The AI detects traffic surges and scales preemptively — before users notice.
For Finance teams: Stop overpaying for "just in case" capacity. The Finance agent literally argues against unnecessary spending in every debate.
For customers: Fewer outages and slowdowns. When your infrastructure scales before the traffic hits, users never notice.
The self-evolving advantage: Most AI systems make the same quality of decisions on day 1 and day 100. Sentrix gets smarter. Every decision carries a thought signature — the accumulated learnings from previous incidents stored in DynamoDB. These signatures are injected into future brain analysis, so the AI knows: "Last time we saw this pattern, scaling to 8 replicas scored 85/100." Decision quality compounds over time.
How I Built This
Architecture
The entire system runs on a single AWS CDK stack

Key Technical Decisions
1. Monolith Lambda Pattern: Instead of 14 separate Lambda functions, I use a single Lambda with @codegenie/serverless-express. The event router inspects the event shape — HTTP, WebSocket, EventBridge schedule, or Step Functions callback — and dispatches to the right handler. All decisions, thought signatures, and feedback scores are persisted to DynamoDB for cross-container durability.
2. Severity-Based Model Selection: Not every analysis needs the most expensive model. Low-severity events use Claude Haiku (fast, cheap). Only HIGH/CRITICAL severity triggers Claude Sonnet for deeper reasoning. This reduces Bedrock costs by ~60% while maintaining quality where it matters.
3. Debate-Driven Scaling: The multi-agent debate produces measurably better decisions than a single agent. The Finance agent genuinely pushes back on cost. The SRE agent fights for reliability. The Arbiter synthesizes both perspectives into a balanced action — and every debate is logged for full transparency.
4. Thought Signatures & Self-Evolution: Every decision is stored in DynamoDB with a full telemetry snapshot. Step Functions evaluates each decision after 5 minutes — comparing before/after metrics to score effectiveness 0-100. These scores become thought signatures that are injected into future brain prompts. The AI literally sees what worked and what didn't for your specific infrastructure patterns.
AWS Services Used
Service	Role
Amazon Bedrock	All AI inference — Claude Haiku (fast) + Claude Sonnet (deep reasoning)
AWS Lambda	Single monolith function with serverless-express
Amazon API Gateway	REST + WebSocket APIs
Amazon DynamoDB	Decision memory with thought signatures and TTL
AWS Step Functions	Feedback loop orchestration (wait → evaluate → score)
Amazon EventBridge	Brain worker schedule (every 1 min)
Amazon S3	Frontend static hosting
Amazon CloudFront	CDN + API proxy
Amazon EKS	Kubernetes auto-scaling (2-10 replicas)
AWS CDK	Infrastructure as code — single stack deployment
Development with Kiro
The project was developed using Kiro IDE with specification-driven development:
Steering files established project context (product, tech stack, structure)
Specs defined EARS-format requirements, architecture design, and implementation tasks
Agent hooks automated test updates, CDK validation, and type synchronization
The spec-driven approach ensured every feature traced back to a user story with clear acceptance criteria
Demo
Watch the full demo:

https://youtu.be/__i2HT7O2Ik
Below is a walkthrough of Sentrix handling a real incident lifecycle — from traffic surge to cascading failure to autonomous recovery.
Phase 1: Normal Operations
All systems healthy. The dashboard shows 100% reliability, all 8 AWS regions green, 2 pods running on EKS. The brain worker runs every minute via EventBridge, analyzing telemetry through Amazon Bedrock Claude — but there's nothing to act on. This is the baseline.

Phase 2: Traffic Spike — Detect and Scale
A massive traffic surge hits. Requests jump to 859/s, latency spikes to 435ms, and reliability drops to 75%.

The brain detects the surge immediately with 92% confidence: "Massive traffic surge (4536% increase) will overwhelm system capacity within 2-3 minutes." This is Claude Haiku working fast — severity-based model selection means we get an answer in milliseconds, not seconds.
The system doesn't wait for a human. It starts scaling EKS pods autonomously — from 2 all the way to 10 replicas — while the live stream shows each scaling step in real-time.

Within 60 seconds, the system stabilizes at 10/10 replicas. The brain confirms: "Monitor 10-replica deployment. System handling load effectively." Reliability holds. No human intervention needed.
Phase 2.5: Agent Debate — Smart Cost Optimization
Here's where it gets interesting. Traffic normalizes — 40 req/s, 100ms latency, reliability back to 95%. But we're still running 10 pods. That's expensive.

The multi-agent debate kicks in. Three AI agents powered by Amazon Bedrock argue about what to do next:
AGENT_FINANCE [Bedrock Claude]: FOR scaling down (95% confidence) — "We're burning money on idle capacity."
AGENT_SRE [Bedrock Claude]: Cautious — "What if traffic spikes again?"
ARBITER [Bedrock Claude Sonnet]: Balanced (88% confidence) — "Scale down to 5 replicas immediately with staged token rate limiting, implement emergency circuit breakers, and prepare multi-cloud failover."
The system scales from 10 down to 5 pods — proving it optimizes in both directions, not just up. Notice the thought signatures in the brain analysis — these are the accumulated learnings from each incident, stored in DynamoDB. Every decision's effectiveness is scored and fed back, so our agents self-evolve and improve their reasoning based on previous incident handling. Next time a similar spike occurs, the AI already knows what worked.

Phase 3: Regional Degradation — Warm Standby Failover
US regions start degrading. Latency jumps to 1087ms, reliability drops to 55%. This isn't a traffic spike — it's infrastructure failing.

The brain detects REGIONAL_DEGRADATION and takes a different action than Phase 2: instead of just scaling, it activates a warm standby cluster in EU-WEST (Ireland). The live stream shows the chain: detection → scaling to 8 pods → warm standby activation → DNS failover.

Within seconds, workload migrates to eu-west-1. Reliability climbs back to 85% as traffic routes around the degraded US regions. The region mesh on the dashboard shows it clearly — red dots for degraded US regions, green for the EU-WEST failover cluster absorbing the load.
Phase 4: Cascading Failure — Cross-Cloud GCP Failover
The worst case. Multiple AWS regions fail simultaneously. Latency explodes to 2922ms. Reliability crashes to 20%. This is CRITICAL.

The brain escalates to Claude Sonnet (our deep reasoning model) for this CRITICAL event. An emergency multi-agent debate runs:
AGENT_SRE: FAILOVER_NOW (97%) — "Cascading failure across 4 AWS regions. Immediate GCP failover is the only option to restore service."
AGENT_FINANCE: Agrees — even the cost agent knows this is existential.
ARBITER (96% confidence): "Unanimous. Execute immediate GCP GKE failover. Revenue protection takes priority."
The system autonomously triggers cross-cloud failover to GCP GKE. The Kubernetes cluster panel switches from sentrix-demo (us-east-2) to sentrix-failover (eu-west-1). No human approval needed — the agents reached unanimous consensus.
Recovery & Feedback Loop
After failover completes, reliability recovers to 95%. The system stabilizes on GCP while AWS recovers.

Then the magic happens: the Step Functions feedback loop fires. It compares the telemetry snapshot from when the scaling decision was made against current metrics:
"Decision dec-17729004 scored 100/100 — Effective. Latency -498ms, errors -1.47%."
A perfect score. This effectiveness rating is now stored as a thought signature in DynamoDB. Next time the AI sees a similar cascading failure pattern, it won't hesitate — it already knows that immediate GCP failover works. The system literally got smarter from handling this incident.
What I Learned
1. Multi-Agent Debate Produces Better Decisions Than Single-Agent
My initial prototype used a single Claude agent for all decisions. Adding the SRE vs Finance debate structure produced measurably more nuanced scaling decisions. The key insight: competing perspectives create a natural optimization pressure that a single agent can't replicate. The Finance agent genuinely pushes back on unnecessary spending, and the Arbiter has to justify its synthesis with data.
2. Thought Signatures Make the AI Self-Evolving
Without the feedback loop, the system would make the same quality decisions forever. By scoring every decision's effectiveness and feeding those scores back as thought signatures, you get a compounding learning signal. Early decisions start at baseline quality, but within hours the brain has a library of scored outcomes to reference. The difference is measurable — the AI starts making faster, more confident decisions as its memory grows.
3. Severity-Based Model Selection is a Game-Changer for Cost
Running every brain analysis through Claude Sonnet would cost ~$15/day. By routing NONE/LOW/MEDIUM to Haiku and only HIGH/CRITICAL to Sonnet, costs dropped to ~$2/day. The critical decisions still get deep reasoning — everything else gets answered in milliseconds.
4. Monolith Lambda > Many Lambdas (for this use case)
I started with 14 separate Lambda functions — but managing cross-function state was painful. Consolidating into a single monolith Lambda with serverless-express meant all handlers share one DynamoDB table for decisions and state. It also simplified the CDK stack from 100+ resources to ~45.
5. Single-Stack CDK Changes Everything
Having everything in one CDK stack — Lambda, API Gateway, DynamoDB, Step Functions, S3, CloudFront, EventBridge, EKS — means cdk deploy gets you from zero to fully operational in 5 minutes, and cdk destroy cleans up everything. No orphaned resources.
6. The Migration Story
Sentrix started as a multi-cloud prototype using Gemini, OpenAI, Kafka, Datadog, and Vercel. Migrating to AWS-native taught me that going all-in on one cloud's AI + infrastructure services creates a tighter, more reliable system. Bedrock's Converse API unified all model calls. CDK replaced serverless.yml + Vercel + GCP Cloud Run. Simpler to deploy, simpler to debug, simpler to tear down.
Built by someone who understand the challenges of those who've been on-call at 3am when nobody predicted the traffic spike. Sentrix doesn't just monitor your infrastructure — it thinks about it.