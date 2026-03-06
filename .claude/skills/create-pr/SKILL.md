---
name: create-pr
description: Create a formatted pull request with CI checks and standard template. Use when ready to submit changes for review after all checks pass.
---

# Create Pull Request

This skill creates a well-formatted pull request following the project's conventions.

## Usage

Execute the steps below to create a PR with proper formatting.

## Steps

1. **Pre-flight checks**
   ```bash
   # Ensure we're on a feature branch (not main)
   CURRENT_BRANCH=$(git branch --show-current)
   if [ "$CURRENT_BRANCH" = "main" ]; then
     echo "Error: Cannot create PR from main branch"
     exit 1
   fi
   ```

2. **Run CI checks locally** (optional but recommended)
   - Ask user if they want to run checks first
   - If yes, execute steps from `/check-ci` skill
   - If checks fail, stop and ask user to fix issues

3. **Ensure changes are committed**
   ```bash
   git status
   ```
   - If uncommitted changes exist, ask user to commit them first

4. **Push branch to remote**
   ```bash
   git push -u origin $CURRENT_BRANCH
   ```

5. **Create PR with gh CLI**
   ```bash
   gh pr create --base main --title "{PR_TITLE}" --body "$(cat <<'EOF'
   ## Summary
   {Brief description of changes}

   ## Changes
   - {Change 1}
   - {Change 2}
   - {Change 3}

   ## Implementation Details
   {Key implementation decisions or technical notes}

   ## Testing
   - [ ] Tests added/updated
   - [ ] All tests passing locally
   - [ ] Linter passing
   - [ ] Build successful

   ## Related
   Fixes #{issue_number} (if applicable)
   Relates to Step {N} of implementation roadmap

   ---
   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   EOF
   )"
   ```

6. **PR Title Guidelines**
   - Format: `{type}: {description}`
   - Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`
   - Examples:
     - `feat: Add video upload functionality for tic cards`
     - `fix: Resolve authentication redirect loop`
     - `docs: Update API documentation for Step 3`

7. **Confirm PR creation**
   - Show the PR URL
   - Remind that CI will automatically run
   - Suggest reviewing the PR in browser

## PR Template Structure

The PR should include:

1. **Summary**: High-level overview of what changed and why
2. **Changes**: Bullet list of specific changes
3. **Implementation Details**: Technical decisions worth noting
4. **Testing**: Checklist of test coverage
5. **Related**: Links to issues or roadmap steps

## After PR Creation

- CI will automatically run tests, lint, and build
- Wait for checks to pass before requesting review
- If checks fail, push fixes and they'll re-run automatically
- Use `/cleanup-branch` after PR is merged
