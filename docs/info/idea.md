## PROJECT INFORMATION
Plain English text only

## TeamName
TicTrack

## WHICH CATEGORY BEST DESCRIBES YOUR IDEA?

Social


## IN ONE OR TWO SENTENCES, WHAT'S YOUR BIG IDEA? - max 500 chars

When a parent suspects their child may have tics, it's hard to explain when it happens and how often, because you can't watch every moment. We'll build a caregiver-first, non-diagnostic app: one-tap 10-20s video for new or unclear episodes, one-tap logging for known recurring tics, AI-assisted labeling, and missing-data tolerant weekly clinician-ready reports that reduce anxiety and improve appointments.


## TELL US ABOUT YOUR VISION - what exactly will you build? - max 1000 chars

A parent-focused "record, summarize, learn, share" experience:

- Capture: one-tap 10-20s video with optional audio for new or unclear episodes.
- Re-log known tics: "tic cards" such as head shake or throat clearing let parents log recurring patterns without video.
- GenAI label suggestions: propose tags like motor or vocal, severity 1-3, and context, plus "match known vs possibly new". Parents confirm or bulk-edit later.
- Weekly clinician-ready PDF: missing-data tolerant trends including week-over-week change, severity mix, time-of-day and context, with 1-3 representative clips.
- Micro-guides: short tips for supportive communication and environment, grounded in trusted sources. Non-diagnostic: no diagnosis or treatment advice. Video sharing optional, with the summary as default.


## HOW WILL YOUR SOLUTION MAKE A DIFFERENCE? - max 1000 chars

Beneficiaries: caregivers, families and clinicians.

In my own family, I've felt how stressful it is to describe when and how often tics happen when you inevitably miss episodes.

Symptoms can fluctuate, and caregivers can't observe continuously - missed events are inevitable. Self-tracking tools assume the patient notices and logs every episode, but caregivers need something that works with gaps and real-world constraints.

Our approach is caregiver-first and missing-data tolerant: minimize effort with one-tap video for new or unclear events and one-tap logging for known recurring tics, and convert imperfect observations into clinician-friendly weekly summaries focused on trends, change points, and representative examples. Families spend less time worrying and explaining. Clinicians get clearer context faster. Micro-guides help caregivers adjust communication and home environment without medicalizing the experience.


## WHAT'S YOUR GAME PLAN FOR BUILDING THIS? - max 1500 chars

Phase 1 - MVP: GenAI-first capture and labeling

- Build one-tap video capture, timeline, and "tic cards" for one-tap re-logging of known tics.
- Use Amazon Bedrock multimodal models such as Nova and Claude to propose structured labels like motor or vocal, severity, and context, plus "known vs new". Labels are suggestions, parents confirm or edit, including bulk review. Save edits as feedback.
- Enforce non-diagnostic behavior with Bedrock Guardrails and orchestrate steps with Bedrock AgentCore.
- Privacy-by-design: encrypt at rest. User-controlled retention and sharing.

Phase 2: Weekly clinician-ready report

- Generate missing-data tolerant weekly PDFs combining tic-card logs and video events including week-over-week change, severity mix, time-of-day and context, and attach 1-3 representative clips.
- Optional one-question weekly check-in about life events or caregiver anxiety score.

Phase 3: GenAI micro-guides grounded in expert knowledge

- Curate trusted references, use Bedrock Knowledge Bases for RAG to generate short, source-grounded guidance, with Guardrails enforcing safe tone and uncertainty.


## WHICH AWS AI SERVICES WILL POWER YOUR SOLUTION? - optional

- Amazon Bedrock with Nova and Claude for multimodal labeling suggestions and safe report wording
- Amazon Bedrock AgentCore for agent orchestration: labeling, matching, reporting
- Amazon Bedrock Guardrails to enforce non-diagnostic outputs
- Amazon Bedrock Knowledge Bases for RAG and expert-grounded caregiver guidance
- Amazon Transcribe for optional audio transcription as support


## WHAT OTHER AWS FREE TIER SERVICES WILL YOU EMPLOY? - optional

- AWS Amplify for web and mobile hosting
- Amazon Cognito for auth and family sharing
- Amazon S3 for secure media and report storage
- AWS Lambda for processing, aggregation, and report generation
- Amazon DynamoDB for metadata
- Amazon API Gateway for APIs
- Amazon EventBridge and Step Functions for weekly report orchestration


## TERMS AND CONDITIONS

- checkbox: I agree
