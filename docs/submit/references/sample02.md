AIdeas: Socratic Labs
Structured AI Tutoring Inside Assignments

App category: Social Impact
My vision
AI is already helping students with homework. The question is whether that help is invisible, or part of the learning process. Instead of trying to police AI usage or compete with it, our goal is to structure AI usage inside assignments so that students have less incentive to use homework solvers and teachers can see where misconceptions occur.
Socratic Labs aims to embed structured, misconception-aware Socratic tutoring directly into math assignments. The AI names specific misunderstandings, escalates support after repeated errors, and logs interaction patterns for teachers.
Instead of banning AI or detecting it after the fact, this project restructures how AI is used — from an unsupervised shortcut to guided learning infrastructure.
Socratic learning involves the use of dialogue and guided questioning, rather than direct instruction
Why this matters
In algebra, students commonly struggle with foundational concepts like the distributive property. When they turn to general-purpose AI tools, they often receive complete solutions without ever engaging with the underlying reasoning.
This is how we change that:
Students must submit an attempt before receiving any support. Initial hints or concept refreshers are available if needs be
The AI explicitly identifies the misconception — for example, a distributive property error — rather than correcting silently
Repeated errors trigger escalation: deeper scaffolding, not answer delivery
Direct-answer requests are redirected and logged
Teachers see aggregated data on which concepts a class struggled with most
This transforms AI from a shortcut into structured scaffolding that makes student reasoning visible and measurable.
For example, data insights available to teachers, immediately after homework has been completed, would look something like this, in a sample session of 20 algebra problems:
65% of incorrect attempts involved distributive property errors
40% of students requested help before completing the first step
12 direct-answer requests were redirected into guided questioning
And outside of AI, this becomes a very useful homework management tool for teachers, with automated marking and easy question selection from a vast question bank.
How I built this
Architecture overview
The application is built as a serverless workflow on AWS:
Student submits a math attempt via the assignment workspace
API Gateway triggers a Lambda function
The attempt and assignment context are sent to Amazon Bedrock (Nova) with tightly constrained system prompts that enforce the tutoring protocol
The AI is prompted to return guided Socratic feedback — never a final answer
All interaction events (attempts, escalations, redirected requests) are logged in DynamoDB
Teacher dashboards aggregate misconception frequency and escalation events across the class
AWS services used
AWS Amplify — frontend hosting
React + TypeScript — teacher dashboard and student workspace
Amazon Cognito — authentication and role-based access (teacher / student)
API Gateway + AWS Lambda — serverless backend APIs
Amazon DynamoDB — assignments, interaction events, misconception logs
Amazon S3 — assignment material storage
Amazon Bedrock (Nova) — foundation model used for structured Socratic tutoring responses
Amazon CloudWatch — logging and monitoring
Because the system is serverless and event-driven, it can scale from a single classroom to district-level deployment without architectural changes.
The prototype is intentionally lightweight and designed to remain Free Tier-friendly at classroom scale. All compute is event-driven (Lambda), storage is minimal (DynamoDB + S3), and AI inference via Amazon Bedrock (Nova) is limited to short, structured tutoring prompts. Usage is monitored via CloudWatch to ensure costs remain within the provided credit envelope.
Structured tutoring logic
This is the core differentiator.
The tutoring model enforces a structured interaction protocol that runs inside every assignment session:
Attempt gate — AI does not activate until the student submits their work
Misconception detection — the model identifies and names specific errors (e.g., "It looks like there may be a distributive property misunderstanding here")
Explicit labeling — the concept name is surfaced, not just a correction
Progressive scaffolding — hints increase in specificity across attempts
Escalation trigger — repeated incorrect attempts activate deeper scaffolding rather than answer delivery
Direct-answer redirection — requests for final answers are refused and logged
The system does not expose an open chat interface. AI responses are constrained to submitted work only. This is an intentional design constraint, not a limitation.
How I used Kiro
Kiro was the primary IDE used to build this project — from initial architecture planning through implementation, iteration, and refinement.
Early in the process, Kiro generated two full specification documents that shaped the architecture before a line of code was written. The backend spec produced a single-table DynamoDB schema, a REST API contract for tutor and analytics endpoints, a prompt composition model (Core Socratic layer + Subject overlay + Task overlay), and property-based test requirements — for example, that submission creation must be atomic and duplicate submissions rejected by conditional write. The frontend spec produced the attempt-gate interaction model (AI inactive until the student submits work), the three-level progressive hint structure, the teacher guardrail wizard concept, and the engagement metrics contract that feeds the teacher dashboard.
From there, Kiro was used for: wiring Lambda handlers and API Gateway configuration, iterating on the structured tutoring prompt constraints, building out the React workspace and AI panel components, and refactoring flows when the tutoring protocol requirements changed. The final architecture simplified some of what the specs described — one Lambda handler rather than a full Bedrock Agent, a single DynamoDB table rather than two — and Kiro supported those decisions as the scope was deliberately narrowed for the prototype.
Having a spec-first workflow baked into the IDE kept the tutoring protocol logic well-defined throughout, and made it easy to stay oriented on what the system was actually supposed to do rather than drifting into scope creep.
Demo
The following screenshots show a single algebra assignment flowing from student attempt to teacher insight. The live application can be found here: https://main.d3dfensy0jl5lh.amplifyapp.com
Screenshots below show a complete student-to-teacher flow within a single algebra assignment: attempt gate, misconception detection, escalation, direct-answer redirection, teacher concept dashboard, and Kiro in the development workflow.
Screenshot 1 — Attempt Required
The AI panel stays inactive until the student submits their own attempt. They may click receive an initial hint or a concept refresher if needs be

Screenshot 2 — Misconception Detection
The AI names the misunderstanding explicitly — "Distributive Property" — rather than silently correcting the work. The concept tag appears inline on the step.

Screenshot 3 — Escalation
After a repeated error, the AI escalates to structured sub-questions: "What is 3 × x?", "What is 3 × 4?", "After distributing, what equation should you get?" More support — not the answer.

Screenshot 4 — Direct-Answer Redirection
A direct answer request is refused and redirected — and logged. The teacher sees this event in the student's reasoning timeline.

Screenshot 5 — Teacher Concept Dashboard
The teacher sees which concepts generated the most confusion across the class — not just who got the right answer, but where reasoning broke down and how many students needed escalation to get there.

Screenshot 6 — Kiro in Development Workflow
Kiro was the primary IDE used throughout the build — from generating architecture specs and data models before a line of code was written, to wiring Lambda handlers, building React components, and iterating on the tutoring protocol as requirements evolved.

Kiro's spec driven development allowed me to fully plan out my workflows prior to implementation
What I learned
In addition to learning a lot more about AWS serverless architecture, I learned that the most important design decision in this project was choosing what the AI is not allowed to do.
Most AI education tools focus on what the model can generate. We are defined by our constraints: no answers before attempts, no silent corrections, no open chat; however hints and concepts refreshers are always available. Those restrictions are what make the interaction pedagogically meaningful.
Key takeaways:
Structured constraints on AI behavior are more valuable than flexible generation in a learning context
Naming misconceptions explicitly — not just hinting — changes how students engage with errors
Making AI interaction visible to teachers closes the loop that general-purpose tools leave open
Amazon Bedrock's model invocation API made it straightforward to enforce a strict system prompt contract — the tutoring constraints live in the Lambda handler, not in the model itself, which means they can't be bypassed by prompt injection from the client
API Gateway + Lambda as the policy enforcement layer was the right call: every student request passes through the same handler, so guardrail logic is centralized and auditable rather than scattered across client code
DynamoDB's single-table design pushed me to think carefully about access patterns upfront — interaction events, misconception logs, and session state all live in one table, which keeps latency low and cost predictable at classroom scale
Amplify's CI/CD pipeline meant frontend changes deployed automatically on push, which removed friction during the rapid iteration phase and kept the demo environment always current
The core insight is that AWS's serverless primitives are a natural fit for policy-aligned AI workflows: event-driven compute, pay-per-use pricing, and centralized request handling mean you can enforce behavioral constraints at the infrastructure level — not just in the model prompt.
The problem this project targets is not unique to one country or curriculum. Wherever students use AI to shortcut learning, a structured, attempt-gated tutoring model can realign incentives toward thinking rather than copying.
Socratic Labs demonstrates that AI policy becomes enforceable when it is embedded directly into the structure of student work.
Tags
#aideas-2025
#social-impact
#EMEA
Team
Team name: Socratic Labs
Contact: alex@nextcodex[dot]dev