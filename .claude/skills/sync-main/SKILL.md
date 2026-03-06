---
name: sync-main
description: Sync local main branch with remote and optionally update current feature branch. Use after PRs are merged or before starting new work.
---

# Sync Main Branch

This skill helps you keep your local main branch in sync with the remote repository.

## Usage

Execute the steps below to sync main and optionally update your feature branch.

## Steps

1. **Save current branch name**
   ```bash
   CURRENT_BRANCH=$(git branch --show-current)
   echo "Currently on: $CURRENT_BRANCH"
   ```

2. **Switch to main and pull latest**
   ```bash
   git checkout main
   git pull origin main
   ```

3. **Check if there were updates**
   - If main was updated, show the changes:
     ```bash
     git log --oneline -5
     ```

4. **Handle feature branch (if applicable)**

   If the user was on a feature branch, ask them what they want to do:

   **Option A: Return to feature branch (no merge)**
   ```bash
   git checkout $CURRENT_BRANCH
   ```

   **Option B: Update feature branch with latest main**
   ```bash
   git checkout $CURRENT_BRANCH
   git merge main
   ```
   If merge conflicts occur, guide the user through resolution.

   **Option C: Stay on main (starting new work)**
   - Stay on main
   - Suggest using `/start-feature` for new work

5. **Final status check**
   ```bash
   git status
   ```

6. **Dependencies check**
   - If `package.json` or `package-lock.json` were updated, remind to run:
     ```bash
     npm install
     ```

## Notes

- Always resolve merge conflicts before proceeding
- Run tests after merging main into feature branch
- Use `/cleanup-branch` to remove merged branches
