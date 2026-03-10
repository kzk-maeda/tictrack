# ADR 009: AI Label Data Structure Fix and Backward Compatibility

## Status
Accepted

## Date
2026-03-10

## Context

### Problem Discovery
After implementing Step Functions async AI analysis workflow (ADR 008), we discovered a critical data structure issue:

1. **Agent not calling tools**: Strands Agent was generating conversational text instead of calling the 6 defined tools (analyze_video, transcribe_audio, integrate_results, apply_guardrails, store_label)

2. **Double-write issue**: Both `store_label` tool and Step Functions `UpdateEpisode` state were updating `Episodes.originalAILabel`, causing the correct data to be overwritten with incorrect data

3. **Key schema mismatch**: `store_label` tool used `labelId` as primary key, but DynamoDB table was defined with `episodeId + version`

4. **Legacy data format**: Existing DynamoDB records used old format (`type`, `context`, `severity`, `confidence`) while UI expected new format (`primaryTic`, `observations`)

### Impact
- UI displayed fallback values ("運動性 + 音声性", "強度 3/5") instead of actual AI analysis results
- Symptom names and complexity labels were not displayed
- Users couldn't see the AI-generated insights

## Decision

### Phase 0: Enable Agent Tool Calling
1. **Specify Claude Sonnet 4.5 explicitly**:
   ```python
   agent = Agent(
       model_id="anthropic.claude-sonnet-4-5-20250929-v1:0",
       tools=[...],
   )
   ```
   - Default model didn't support tool calling
   - Claude Sonnet 4.5 has full tool calling support

2. **Fix AILabels table key schema**:
   - Change from `labelId` (composite string) to `episodeId + version` (proper DynamoDB key)
   - Update `store_label.py` and `agent.py` to use correct keys
   - **Rationale**: Align with CDK table definition, enable proper queries

### Phase 1: Eliminate Double-Write
1. **Remove Step Functions originalAILabel update**:
   - `UpdateEpisode` state no longer updates `originalAILabel`
   - Only updates `labelStatus` and `updatedAt`
   - **Rationale**: `store_label` tool already updates this field correctly

2. **Remove StoreAILabel state**:
   - Step Functions no longer writes to `AILabels` table
   - `store_label` tool is the single source of truth
   - **Rationale**: Avoid duplicate writes and data inconsistency

### Phase 2: Backward Compatibility Layer
1. **Normalize old format in Frontend**:
   - `timeline-day-group.tsx` converts old fields to new fields:
     - `type` → `suggestedType`
     - `context` → `suggestedContext`
     - `severity` → `suggestedSeverity`

2. **Normalize old format in Backend**:
   - `episodes.ts` API endpoints normalize responses
   - Consistent format for both initial load and polling updates

3. **Update type definitions**:
   - `EpisodeAILabel` type allows both old and new fields
   - TypeScript compilation succeeds
   - **Rationale**: Reflect reality of DynamoDB data

## Alternatives Considered

### Alternative 1: Immediate Data Migration
**Approach**: Re-analyze all existing episodes to overwrite old format with new format

**Rejected because**:
- Time-consuming (requires re-running AI analysis)
- Costly (Bedrock API calls for all historical data)
- Risky (could fail mid-migration)
- Not necessary for functionality

### Alternative 2: Frontend-Only Normalization
**Approach**: Only normalize in `timeline-day-group.tsx`

**Rejected because**:
- API responses would still have inconsistent format
- Polling updates would return different format than initial load
- Backend clients would need their own normalization

### Alternative 3: Remove Old Data Support
**Approach**: Only support new format, mark old episodes as "needs re-analysis"

**Rejected because**:
- Poor user experience (existing data disappears)
- Forces users to re-analyze historical episodes
- Backward compatibility is a best practice

## Consequences

### Positive
1. **Agent now calls tools correctly**:
   - Structured data is properly generated and stored
   - New episodes have full symptom details (name, complexity)

2. **Data consistency**:
   - Single source of truth for AI labels (`store_label` tool)
   - No overwriting or conflicts

3. **Backward compatibility**:
   - Old data continues to display in UI
   - No data loss or forced migrations
   - Gradual transition to new format

4. **Type safety**:
   - TypeScript definitions match reality
   - Compilation succeeds

5. **Test coverage**:
   - All `test_store_label.py` tests pass (7/7)
   - Updated tests reflect new return values

### Negative
1. **Normalization overhead**:
   - Additional logic in Frontend and Backend
   - Maintenance burden until all data migrated

2. **Mixed data formats**:
   - Old and new formats coexist in DynamoDB
   - Documentation must explain both formats

3. **Type definition complexity**:
   - `EpisodeAILabel` has many optional fields
   - Some fields are legacy, some are new

### Migration Path
1. **Short term** (current):
   - Keep normalization layer
   - New data uses `primaryTic` format
   - Old data uses fallback fields

2. **Medium term** (1-2 weeks):
   - Optionally re-analyze old episodes
   - Gradually replace old format with new format

3. **Long term** (1 month+):
   - Simplify normalization logic if all data migrated
   - Mark old fields as `@deprecated` in types
   - Eventually remove old fields (optional)

## Validation

### Tests
- ✅ Python tests: 7/7 passed (`test_store_label.py`)
- ✅ TypeScript compilation: `npx tsc --noEmit` succeeds
- ⏳ E2E tests: Pending deployment verification

### Manual Testing
1. Deploy Phase 0-1 changes to sandbox
2. Upload new video and verify:
   - Agent calls tools (check CloudWatch Logs for `>>> ...`)
   - `primaryTic` is stored in DynamoDB
   - UI displays symptom name and complexity
3. Check old episodes verify:
   - Old data displays type and severity
   - No errors or blank screens

## Related ADRs
- [ADR 008: Async AI Analysis with Step Functions](008-async-ai-analysis-with-step-functions.md) - Original workflow design
- [ADR 007: Adopt next-intl for i18n](007-adopt-next-intl-for-i18n.md) - UI internationalization

## References
- Issue investigation: `docs/troubleshooting/fixes-summary.md`
- Backward compatibility docs: `docs/troubleshooting/backward-compatibility-layer.md`
- Agent code: `agents/tic_labeling/agent.py`
- Step Functions: `amplify/custom/orchestration/index.ts`
- Frontend normalization: `src/components/timeline/timeline-day-group.tsx`
- Backend normalization: `amplify/functions/api-handler/routes/episodes.ts`
