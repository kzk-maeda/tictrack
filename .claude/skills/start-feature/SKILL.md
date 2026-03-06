---
name: start-feature
description: Start a new feature branch from main following project branching conventions. Use when starting work on a new feature, step, or task.
---

# Start Feature Branch

This skill helps you create a new feature branch following the project's branching strategy.

## Usage

Ask the user for the branch description if not provided, then execute the steps below.

## Steps

1. **Ensure main is up to date**
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Create feature branch**
   ```bash
   git checkout -b feature/{description}
   ```

   Branch naming conventions:
   - `feature/step{N}-{description}` - for implementation steps (e.g., `feature/step3-video-upload`)
   - `feature/{description}` - for other features
   - `fix/{description}` - for bug fixes
   - `refactor/{description}` - for refactoring
   - `docs/{description}` - for documentation updates

3. **Confirm creation**
   ```bash
   git status
   git branch --show-current
   ```

4. **Remind about workflow**
   - Implement your changes
   - Run `/check-ci` before creating PR
   - Use `/create-pr` to create the pull request
   - CI will automatically run tests, lint, and build checks

## Example

```bash
# User wants to implement video upload feature
git checkout main
git pull origin main
git checkout -b feature/step3-video-upload
```
