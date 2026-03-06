---
name: cleanup-branch
description: Delete merged feature branches from local and remote repositories. Use after PRs are merged to keep repository clean.
---

# Cleanup Merged Branches

This skill helps you clean up branches that have been merged to main.

## Usage

Execute the steps below to safely remove merged branches.

## Steps

1. **Ensure you're on main**
   ```bash
   git checkout main
   git pull origin main
   ```

2. **List merged branches**
   ```bash
   # Local branches merged into main
   git branch --merged main | grep -v "^\* main$" | grep -v "^  main$" | grep -v "^  master$" | grep -v "^  develop$"
   ```

3. **Delete local merged branches**
   ```bash
   # Show branches to be deleted
   MERGED_BRANCHES=$(git branch --merged main | grep -v "^\* main$" | grep -v "^  main$" | grep -v "^  master$" | grep -v "^  develop$")

   if [ -z "$MERGED_BRANCHES" ]; then
     echo "No merged branches to delete"
   else
     echo "Branches to be deleted:"
     echo "$MERGED_BRANCHES"

     # Ask user for confirmation
     # If confirmed, delete each branch:
     echo "$MERGED_BRANCHES" | xargs -n 1 git branch -d
   fi
   ```

4. **Check remote merged branches**
   ```bash
   # Fetch latest remote info
   git fetch --prune origin

   # List remote branches merged into main
   git branch -r --merged origin/main | grep "origin/" | grep -v "main$" | grep -v "master$" | grep -v "develop$" | sed 's/origin\///'
   ```

5. **Delete remote merged branches** (optional)
   - Ask user if they want to delete remote branches
   - **Warning**: Only delete remote branches if you're sure they're merged
   ```bash
   # Example for a single branch:
   git push origin --delete {branch-name}
   ```

6. **Final cleanup**
   ```bash
   # Remove stale remote-tracking branches
   git remote prune origin

   # Show remaining branches
   git branch -a
   ```

## Protected Branches

Never delete these branches:
- `main`
- `master`
- `develop`
- Current branch (marked with `*`)

## Safety Notes

- Only delete branches that are fully merged
- Always confirm before deleting remote branches
- If unsure, skip remote deletion
- You can always recreate a branch from its last commit

## After Cleanup

- Run `git branch -a` to verify cleanup
- Use `/start-feature` to begin new work
