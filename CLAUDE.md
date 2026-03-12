# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TicTrack** is a caregiver-first, non-diagnostic PWA app for tracking children's tic symptoms. Built for the AWS 10,000 AIdeas Competition as a semifinalist prototype.

**Key characteristics:**
- Dual-language backend: Python 3.12 (AI Agents) + Node.js 20 (CRUD APIs)
- Frontend: Next.js 14 App Router + Serwist PWA + Tailwind CSS + shadcn/ui
- Infrastructure: AWS Amplify Gen 2 + CDK custom constructs
- AI: Strands Agents SDK + AgentCore Runtime, Nova Pro (video analysis), Claude Haiku (text generation)
- Strict TDD approach with incremental MVP delivery
- Deadline: 2026/3/13 (29-day timeline)

## Essential Commands

### Development
```bash
# Start Amplify sandbox (creates isolated AWS environment per developer)
npx ampx sandbox

# Start Next.js dev server
npm run dev

# Run tests
npm run test              # Run all tests once
npm run test:watch        # Watch mode
npm run test -- <file>    # Run specific test file
npm run test:e2e          # Playwright E2E tests

# Linting and formatting
npm run lint              # ESLint
npm run format            # Prettier write
npm run format:check      # Prettier check

# Build
npm run build             # Next.js production build
```

### Python Agent Tests (Backend)
```bash
cd amplify/functions/report-aggregator
pytest                    # Run all tests
pytest -v                 # Verbose mode
pytest tests/test_handler.py::test_specific  # Run specific test
```

### Amplify Sandbox Management
```bash
npx ampx sandbox          # Start sandbox (watches for changes)
npx ampx sandbox status   # Check sandbox status
npx ampx sandbox delete   # Clean up sandbox resources
npx ampx generate outputs --out-dir ./src  # Generate Amplify config

# CDK bootstrap (required once per AWS account/region)
npx cdk bootstrap aws://<ACCOUNT_ID>/us-east-1
```

### Project-Specific Claude Code Skills
Available in `.claude/skills/`:
- `/start-feature <name>` - Create new feature branch from main
- `/sync-main` - Sync local main with remote
- `/check-ci` - Run CI checks locally (test + lint + build)
- `/create-pr` - Create formatted PR with CI checks
- `/cleanup-branch` - Delete merged branches

## Architecture Overview

### Dual-Language Backend
- **Python 3.12**: AI Agents (Strands SDK) for video analysis and micro-guides
  - Located in: `amplify/functions/report-aggregator/`, `amplify/functions/report-generator/`
  - Uses: Bedrock (Nova Pro, Claude Haiku), Transcribe, Guardrails
- **Node.js 20**: CRUD REST APIs
  - Located in: `amplify/functions/api-handler/`
  - Uses: DynamoDB, S3, Cognito

### Infrastructure: Amplify Gen 2 + CDK Custom Constructs
The backend is defined in `amplify/backend.ts` with **staged activation** based on implementation roadmap steps:
- **Step 0-1 (Active)**: Auth + Storage + Database + API + Foundation (S3 knowledge + ECR)
- **Step 4+**: AI Agent infrastructure (uncommented as needed)
- **Step 6+**: Orchestration (Step Functions for reports)

Custom CDK constructs in `amplify/custom/`:
- `database/` - DynamoDB 8 tables (Users, Children, TicCards, Episodes, AILabels, CheckIns, WeeklyReports, ShareTokens)
- `foundation/` - S3 knowledge bucket + ECR repository
- `api/` - API Gateway REST + Cognito Authorizer
- `agentcore/` - AgentCore Runtime ECS/Fargate deployment
- `orchestration/` - Step Functions workflows

### Lambda Environment Variables
Individual table names (not prefixes) are passed to Lambda handlers:
```typescript
// In backend.ts
apiHandler.addEnvironment("TABLE_USERS", dbConstruct.tableNames.users);
apiHandler.addEnvironment("TABLE_CHILDREN", dbConstruct.tableNames.children);
// ... etc
```

### DynamoDB Schema
Multi-table design (8 tables):
- **Users**: `userId` (PK)
- **Children**: `childId` (PK), GSI: `userId-createdAt-index`
- **TicCards**: `cardId` (PK), GSI: `childId-createdAt-index`
- **Episodes**: `episodeId` (PK), GSI: `childId-occurredAt-index`
- **AILabels**: `episodeId` (PK), GSI: `modelId-createdAt-index`
- **CheckIns**: `checkinId` (PK), GSI: `childId-checkedAt-index`
- **WeeklyReports**: `reportId` (PK), GSI: `childId-weekStartDate-index`
- **ShareTokens**: `tokenId` (PK), GSI: `episodeId-index`

### API Structure
REST API handlers in `amplify/functions/api-handler/`:
- `router.ts` - Pattern-based routing (no Express)
- `routes/<feature>.ts` - Feature-specific route handlers
- `lib/` - Shared utilities (DynamoDB, validation, error handling)
- `__tests__/` - Vitest unit tests (TDD approach)

Route pattern example:
```typescript
{
  method: "GET",
  pattern: /^\/children\/([^/]+)\/dashboard$/,
  handler: (event, params) => getDashboard(event, params)
}
```

### Frontend Structure
Next.js 14 App Router with i18n (next-intl):
- `src/app/(protected)/` - Authenticated routes
- `src/components/` - React components (shadcn/ui based)
- `src/hooks/` - SWR hooks for API data fetching
- `src/lib/` - Utilities (API client, types, date utils)
- `messages/ja.json`, `messages/en.json` - i18n translations

## Frontend Development Patterns

### State Management: SWR (ADR 011)
All data fetching MUST use SWR for cache sharing, optimistic updates, and automatic revalidation. See `docs/adr/011-adopt-swr-for-state-management.md` for implementation patterns.

**✅ DO:**
- Use SWR for all data fetching (no useState + useEffect)
- Implement optimistic updates with `mutate()` after mutations
- Use conditional fetching (pass `null` as key) when parameters are undefined
- Configure: `revalidateOnFocus: true`, `dedupingInterval: 5000`

**❌ DON'T:**
- Use useState + useEffect for manual data fetching
- Forget to call `mutate()` after mutations
- Skip optimistic updates

## Testing Strategy

### TDD Workflow (Strictly Enforced)
1. **RED**: Write failing test first
2. **GREEN**: Implement minimum code to pass
3. **REFACTOR**: Improve code while keeping tests green

### Test Requirements
- All new features MUST have tests written first
- Tests must verify real functional behavior (no `expect(true).toBe(true)`)
- NEVER hardcode values solely to pass tests
- NEVER add test-only conditionals (`if (testMode)`) to production code
- Test boundary conditions, edge cases, and error scenarios

### Test Locations
- **Frontend/API**: `amplify/functions/api-handler/__tests__/` (Vitest)
- **Python Agents**: `amplify/functions/<function>/tests/` (pytest)
- **E2E**: `e2e/` (Playwright)

### Common Test Patterns

**API Handler Tests (Vitest):**
```typescript
import { vi } from "vitest";
import { handler } from "../handler";
import { createMockEvent } from "./helpers/event-factory";

vi.mock("@aws-sdk/lib-dynamodb");

test("should return 200 with valid data", async () => {
  const event = createMockEvent("GET", "/children/child-123");
  const response = await handler(event);
  expect(response.statusCode).toBe(200);
});
```

**Python Lambda Tests (pytest):**
```python
from unittest.mock import patch, MagicMock
import pytest

@patch("handler.ddb_client")
@patch("handler.bedrock")
def test_generate_report(mock_bedrock, mock_ddb):
    # Setup mocks
    mock_ddb.query.return_value = {"Items": [...]}
    mock_bedrock.converse.return_value = {...}

    # Execute
    result = lambda_handler(event, context)

    # Assert
    assert result["statusCode"] == 200
```

## Key Design Decisions

### Why Amplify Gen 2 + CDK (not Terraform)?
- Amplify Gen 2 uses CDK under the hood
- Allows custom CDK constructs alongside Amplify resources
- Better TypeScript integration for IaC
- Staged resource activation matches incremental roadmap

### Why Strands Agents SDK?
- AWS's latest AI Agent framework (learn cutting-edge tech)
- Tool-calling patterns simplify agent logic vs Step Functions + multiple Lambdas
- Easy fallback path: Strands → Lambda Python → Raw Bedrock API

### Why DynamoDB Multi-Table (not Single-Table)?
- Prototype stage prioritizes readability and development speed
- 8 tables match domain model directly
- GSIs provide necessary query patterns

### Why Nova Pro (not Claude) for Video Analysis?
- Nova Pro designed for multimodal (video + audio) input
- ~$0.004/video vs Claude's higher cost
- S3 URI direct input (no need to download/encode)

### Why Dual-Language (Python + Node.js)?
- Strands SDK is Python-first
- Existing Amplify Gen 2 + Node.js CRUD APIs work well
- Isolating AI logic in Python keeps concerns separated

## Common Gotchas

### Amplify Sandbox
- **MUST run `npx cdk bootstrap` once per AWS account/region** before first sandbox run
- Sandbox creates isolated environments per developer (branch name + user ID in resource names)
- `amplify/backend.ts` changes require sandbox restart to apply

### DynamoDB + TypeScript
- DynamoDB doesn't support Float type, use Decimal
- In Python: `from decimal import Decimal`, wrap float values: `Decimal(str(value))`
- In Node.js: `@aws-sdk/lib-dynamodb` handles marshalling automatically

### API Gateway + Lambda
- Router uses pattern matching (not Express)
- Path parameters captured as regex groups
- Authentication enforced via Cognito Authorizer (configured in ApiConstruct)

### Testing with AWS SDK
- Mock at module level, not `boto3.client()` call site:
  ```python
  @patch("handler.bedrock")  # NOT @patch("boto3.client")
  ```
- For TypeScript: `vi.mock("@aws-sdk/lib-dynamodb")` before imports

### i18n (next-intl)
- Translation keys structured by feature: `common`, `auth`, `nav`, `children`, `ticCards`, etc.
- Use `useTranslations('feature')` in client components
- Use `getTranslations('feature')` in server components
- Cookie-based locale switching (not URL-based)

### PWA (Serwist)
- Manifest generated dynamically at `/manifest.json/route.ts` (locale-aware)
- Service Worker registered in `src/app/sw.ts`
- Not using `next-pwa` (unmaintained), using Serwist instead

## Development Workflow

### Git Branch Strategy

**IMPORTANT: Always use feature branches. Never commit directly to main.**

#### Branch Protection
- This repository does NOT have GitHub branch protection enabled (requires GitHub Pro for private repos)
- Developers must follow branch workflow discipline manually
- Use the provided Claude Code skills to ensure proper workflow

#### Required Workflow
1. **Always start with a feature branch**: Use `/start-feature <name>` or `git checkout -b feature/<name>`
2. **Never push directly to main**: All changes must go through Pull Requests
3. **Create PRs for review**: Use `/create-pr` to create formatted pull requests
4. **Clean up after merge**: Use `/cleanup-branch` to delete merged branches

#### Why This Matters
- ✅ Code review opportunity before merging
- ✅ CI runs on feature branches before main
- ✅ Easy to revert if needed
- ✅ Clear history of what changed and why
- ❌ Direct main commits bypass review and CI validation

#### Emergency Exception
If you accidentally push to main:
1. Create a retroactive PR for documentation
2. Or revert and re-apply via feature branch
3. Update this document if the workflow needs adjustment

### Starting New Feature
1. `/start-feature step{N}-{description}` (or `git checkout -b feature/...`)
2. Write tests first (TDD Red phase)
3. Implement minimum code (TDD Green phase)
4. Refactor if needed (TDD Refactor phase)
5. `/check-ci` to verify locally
6. `/create-pr` to submit

### Amplify Backend Changes
1. Edit `amplify/backend.ts` or custom constructs in `amplify/custom/`
2. Sandbox auto-detects changes and redeploys
3. Use `npx ampx generate outputs` to update frontend config if auth/API changes

### Adding New Lambda Function
1. Create `amplify/functions/<name>/resource.ts` (define Lambda)
2. Create `amplify/functions/<name>/handler.ts` (implementation)
3. Add to `backend.ts`: `import { myFunc } from "./functions/<name>/resource"`
4. Sandbox will deploy on next run

### Adding New DynamoDB Table
1. Edit `amplify/custom/database/index.ts`
2. Add table definition with GSIs
3. Export table name via `tableNames` object
4. Pass to Lambda via `addEnvironment()` in `backend.ts`

## MCP Servers for Debugging and AWS Operations

This project has MCP (Model Context Protocol) servers configured in `.mcp.json` to assist with debugging and AWS operations.

### Frontend Debugging: Chrome DevTools MCP
Use Chrome DevTools MCP for debugging frontend issues:
- Inspect DOM elements and CSS styles
- Execute JavaScript in browser context
- Take screenshots of rendered pages
- Monitor network requests
- Analyze performance
- Access console logs

**Example usage:**
```
"Use Chrome DevTools MCP to screenshot the dashboard page and check if the chart renders correctly"
"Use Chrome DevTools MCP to inspect the network request to /children/{childId}/dashboard"
```

### AWS Environment Investigation

The following AWS MCP servers are available (see `.mcp.json`):

**CloudWatch MCP** - Log investigation and monitoring:
- Query Lambda function logs
- Search CloudWatch Logs by log group
- Analyze error patterns
- Monitor metrics

**DynamoDB MCP** - Database inspection:
- Query tables directly
- Scan for specific items
- Verify data structure
- Check GSI queries

**AgentCore MCP** - AI Agent debugging:
- Inspect AgentCore runtime logs
- Debug Strands Agent execution
- Verify tool invocations

**Step Functions MCP** - Workflow monitoring:
- Check Step Functions execution status
- Debug workflow failures
- View execution history

**AWS Serverless MCP** - Lambda debugging:
- Inspect Lambda function configuration
- View function environment variables
- Check IAM permissions

**Important notes:**
- All AWS MCP servers use `AWS_PROFILE=tictrack-dev-ro` (read-only access)
- Default region: `ap-northeast-1` (some use `us-east-1` for global services)
- Use these for investigation ONLY - do not modify production resources

**Example usage:**
```
"Use CloudWatch MCP to check Lambda logs for api-handler function errors in the last hour"
"Use DynamoDB MCP to query the Episodes table for childId=child-123"
"Use AgentCore MCP to inspect the last Tic Labeling Agent execution"
```

## Documentation
- `docs/design/architecture_final.md` - Final architecture (Single Source of Truth)
- `docs/design/implementation_roadmap.md` - 10-step implementation plan with TDD test items
- `amplify/README.md` - Amplify backend execution guide
- Design docs include ADRs (Architecture Decision Records) for key decisions
