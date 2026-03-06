---
name: check-ci
description: Run CI checks locally (test, lint, build) before creating a pull request. Use to verify changes pass all checks before pushing.
---

# Check CI Locally

This skill runs the same checks that GitHub Actions CI will run, allowing you to catch issues before creating a PR.

## Usage

Execute all CI checks in sequence and report results.

## Steps

1. **Run tests**
   ```bash
   npm run test
   ```
   - If tests fail, stop and report the failure
   - Show failed test details

2. **Run linter**
   ```bash
   npm run lint
   ```
   - If lint fails, stop and report the issues
   - Show lint errors/warnings

3. **Run build**
   ```bash
   npm run build
   ```
   - If build fails, stop and report the error
   - Show build errors

4. **Report results**
   - ✅ All checks passed: Ready to create PR
   - ❌ Checks failed: Fix issues before creating PR

## CI Check Details

The CI checks match exactly what runs in `.github/workflows/ci.yml`:

- **Test**: Runs Jest test suite
- **Lint**: Runs ESLint with project rules
- **Build**: Runs Next.js production build

## After Checks Pass

If all checks pass, suggest:
- Commit your changes if not already committed
- Use `/create-pr` to create the pull request
- Or manually push with `git push -u origin {branch-name}`

## If Checks Fail

Help the user debug:
- Show the exact error messages
- Suggest fixes based on the error type
- Run checks again after fixes
