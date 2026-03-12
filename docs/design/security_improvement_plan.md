# TicTrack Security Improvement Plan

**Version**: 1.0
**Date**: 2026-03-11
**Status**: In Progress

## Overview

This document outlines security vulnerabilities identified in the TicTrack MVP and their remediation plan. All items are prioritized based on severity and exploitability.

**Priority Levels:**
- **P0 (Critical)**: Immediate security risk, blocks production deployment
- **P1 (High)**: Significant security risk, should be fixed before production
- **P2 (Medium)**: Security improvement, fix after core functionality
- **P3 (Low)**: Nice-to-have security enhancement

---

## Phase 1: Critical Security Fixes (P0)

### 1.1 ✅ IDOR in start-analysis Lambda [COMPLETED]

**Issue**: POST /analyze/{episodeId} accepts client-provided `childId`, `s3Key`, and `bucketName`, allowing attackers to analyze other users' videos.

**Risk**: High - Attacker can trigger video analysis on arbitrary S3 objects, potentially:
- Analyzing other users' private videos
- Causing unauthorized AWS costs
- Accessing episode data they don't own

**Solution**:
- Fetch episode from database using episodeId
- Verify episode ownership via childId → userId lookup
- Use database values for s3Key and environment variable for bucketName
- Return 403 for unauthorized access, 404 for non-existent episodes

**Status**: ✅ Fixed in PR #10
- Tests: 4/4 passing
- Changes: handler.ts, ApiConstruct, backend.ts

**Test Coverage**:
```typescript
✓ Returns 403 when accessing another user's episode
✓ Returns 404 when episode does not exist
✓ Ignores client-provided s3Key and uses DB value
✓ Starts analysis successfully for owned episode
```

---

### 1.2 IDOR in video upload presigned URL generation

**Issue**: POST /children/{childId}/episodes/{episodeId}/upload-url may not verify that the episode belongs to the specified child.

**Risk**: Medium - Attacker could potentially upload video to another user's episode.

**Required Changes**:
1. Fetch episode from database
2. Verify episode.childId matches path parameter
3. Verify child.userId matches authenticated user
4. Return 403 for ownership mismatch

**Estimated Effort**: 2 hours
**Test Cases**: 4
- [ ] Returns 403 when episode doesn't belong to child
- [ ] Returns 403 when child doesn't belong to user
- [ ] Returns 404 when episode doesn't exist
- [ ] Generates presigned URL for valid request

---

### 1.3 IDOR in shared report/video endpoints

**Issue**: GET /shared/{tokenId} may not properly validate token ownership or expiration.

**Risk**: Low - Tokens are UUIDs, but should validate expiration and single-use semantics.

**Required Changes**:
1. Verify token exists in ShareTokens table
2. Check token expiration (if implemented)
3. Validate resource access permissions
4. Implement rate limiting for token validation

**Estimated Effort**: 3 hours
**Test Cases**: 5
- [ ] Returns 404 for non-existent token
- [ ] Returns 403 for expired token
- [ ] Returns 403 for revoked token
- [ ] Allows access for valid token
- [ ] Rate limits excessive token validation attempts

---

## Phase 2: Input Validation & Sanitization (P1)

### 2.1 Video content type validation

**Issue**: Video upload accepts client-provided content type without strict validation.

**Risk**: Medium - Could allow upload of non-video files or malicious content.

**Required Changes**:
1. Whitelist allowed MIME types (video/mp4, video/webm)
2. Validate file extension matches content type
3. Consider adding magic number validation (optional)

**Estimated Effort**: 1 hour
**Test Cases**: 3
- [x] Rejects unsupported content types (currently failing)
- [ ] Rejects mismatched extension and content type
- [ ] Accepts valid video content types

---

### 2.2 Input sanitization for text fields

**Issue**: User-provided text fields (displayName, ticLabel, notes) may not be sanitized.

**Risk**: Low - No XSS risk (React auto-escapes), but should validate length and characters.

**Required Changes**:
1. Add max length validation for all text fields
2. Validate character sets (e.g., no control characters)
3. Trim whitespace on input
4. Add input validation middleware

**Estimated Effort**: 2 hours
**Test Cases**: 6 (per field type)
- [ ] Rejects input exceeding max length
- [ ] Rejects control characters
- [ ] Trims leading/trailing whitespace
- [ ] Accepts valid input
- [ ] Handles Unicode correctly
- [ ] Rejects null bytes

---

### 2.3 Date/time validation

**Issue**: occurredAt, checkedAt timestamps may accept invalid dates or future dates.

**Risk**: Low - Could cause data integrity issues or sorting problems.

**Required Changes**:
1. Validate ISO 8601 format
2. Reject future timestamps (with reasonable buffer for clock skew)
3. Reject timestamps older than reasonable (e.g., > 1 year)
4. Validate timezone handling

**Estimated Effort**: 2 hours
**Test Cases**: 5
- [ ] Rejects invalid ISO 8601 format
- [ ] Rejects future timestamps
- [ ] Rejects extremely old timestamps
- [ ] Accepts valid timestamps
- [ ] Handles timezone correctly

---

## Phase 3: Authentication & Authorization (P1)

### 3.1 ✅ Implement consistent ownership checks [COMPLETED]

**Issue**: Not all API endpoints verify resource ownership (child, episode, ticCard, etc.).

**Risk**: High - Could allow unauthorized access to user data.

**Solution**:
1. Created lib/authorization.ts module with reusable functions
2. Implemented verifyChildOwnership() and getOwnedChild() helpers
3. Refactored 6 route files to use common authorization
4. Standardized error handling (404 vs 403)

**Status**: ✅ Fixed in PR #12
- Created: lib/authorization.ts with 2 exported functions
- Tests: 10/10 passing for authorization module
- Refactored: children.ts, episodes.ts, tic-cards.ts, medications.ts, life-events.ts, dashboard.ts
- All 140 tests passing

**Test Coverage**:
```typescript
✓ verifyChildOwnership passes when child belongs to user
✓ verifyChildOwnership throws NotFoundError when child not found (404)
✓ verifyChildOwnership throws ForbiddenError when wrong user (403)
✓ getOwnedChild returns child when ownership verified
✓ getOwnedChild throws NotFoundError when child not found
✓ getOwnedChild throws ForbiddenError when wrong user
```

---

### 3.2 Implement rate limiting

**Issue**: No rate limiting on API endpoints, vulnerable to abuse.

**Risk**: Medium - Could allow DoS attacks or excessive AWS costs.

**Required Changes**:
1. Add API Gateway usage plans and API keys (optional, for paid tiers)
2. Implement Lambda-based rate limiting using DynamoDB
3. Different limits for different endpoint types:
   - Auth endpoints: 5 req/min
   - Read endpoints: 100 req/min
   - Write endpoints: 20 req/min
   - Video upload: 5 req/min

**Estimated Effort**: 6 hours
**Test Cases**: 4 (per endpoint type)
- [ ] Allows requests under limit
- [ ] Blocks requests over limit with 429
- [ ] Resets limit after time window
- [ ] Handles distributed rate limiting correctly

---

## Phase 4: Data Security (P2)

### 4.1 Implement video encryption at rest

**Issue**: Videos in S3 are not encrypted at rest with customer-managed keys.

**Risk**: Low - S3 default encryption (SSE-S3) is enabled, but KMS would be better.

**Required Changes**:
1. Create KMS key for video encryption
2. Update S3 bucket to use SSE-KMS
3. Update IAM policies for KMS access
4. Rotate keys periodically

**Estimated Effort**: 3 hours
**Test Cases**: 2
- [ ] Videos are encrypted with KMS
- [ ] Videos can be decrypted by authorized users

---

### 4.2 Implement DynamoDB point-in-time recovery

**Issue**: DynamoDB tables do not have point-in-time recovery enabled.

**Risk**: Medium - Data loss in case of accidental deletion or corruption.

**Required Changes**:
1. Enable PITR on all DynamoDB tables
2. Document recovery procedures
3. Test recovery process

**Estimated Effort**: 1 hour
**Test Cases**: 1
- [ ] PITR enabled on all tables

---

### 4.3 Implement audit logging

**Issue**: No comprehensive audit log of user actions.

**Risk**: Low - Difficult to investigate security incidents.

**Required Changes**:
1. Log all write operations (create, update, delete) to CloudWatch
2. Include userId, timestamp, resource type, resource ID, action
3. Implement log retention policy (90 days)
4. Create CloudWatch Insights queries for common investigations

**Estimated Effort**: 4 hours
**Test Cases**: 3
- [ ] Create operations are logged
- [ ] Update operations are logged
- [ ] Delete operations are logged

---

## Phase 5: Secrets Management (P2)

### 5.1 Move hardcoded values to AWS Secrets Manager

**Issue**: Some configuration values are hardcoded or in environment variables.

**Risk**: Low - No actual secrets exposed, but best practice to use Secrets Manager.

**Required Changes**:
1. Identify all configuration values that should be secrets
2. Move to AWS Secrets Manager
3. Update Lambda functions to read from Secrets Manager
4. Implement secret rotation

**Estimated Effort**: 3 hours
**Test Cases**: 2
- [ ] Lambda can read secrets from Secrets Manager
- [ ] Secret rotation works correctly

---

## Summary

| Phase | Priority | Items | Estimated Effort | Status |
|-------|----------|-------|------------------|--------|
| 1 | P0 | 3 | 7 hours | 1/3 complete |
| 2 | P1 | 3 | 5 hours | 0/3 complete |
| 3 | P1 | 2 | 10 hours | 0/2 complete |
| 4 | P2 | 3 | 8 hours | 0/3 complete |
| 5 | P2 | 1 | 3 hours | 0/1 complete |
| **Total** | | **12** | **33 hours** | **1/12 complete** |

---

## Next Steps

1. ✅ Complete Phase 1, Item 1.1 (IDOR in start-analysis) - **DONE**
2. **Next**: Complete Phase 1, Item 1.2 (IDOR in video upload)
3. Complete remaining P0 items before production deployment
4. Address P1 items during post-MVP hardening
5. Address P2 items as time permits

---

## Security Review Checklist

Before production deployment, verify:

- [ ] All P0 items resolved
- [ ] All P1 items resolved or accepted as risk
- [ ] Input validation on all user-provided data
- [ ] Ownership checks on all resource access
- [ ] Rate limiting implemented
- [ ] Audit logging functional
- [ ] PITR enabled on all DynamoDB tables
- [ ] S3 bucket policies restrict public access
- [ ] IAM roles follow principle of least privilege
- [ ] CloudWatch alarms configured for security events
- [ ] Penetration testing completed (if applicable)

---

**Last Updated**: 2026-03-11
**Next Review**: After Phase 1 completion
