---
name: ship
description: Autonomously sync ORCHESTRATOR.md, review, simplify, build-verify, lint, commit, and push all uncommitted changes. Processes each file individually so one failure doesn't block the rest.
---

## Process

### 1. Sync ORCHESTRATOR.md

Before touching any code, update ORCHESTRATOR.md to reflect the current repo state:

1. Read the current ORCHESTRATOR.md
2. Scan the repo for what has changed since the last update:
   - New files and modules that have been created
   - API routes that now exist
   - Config/lib modules that have landed
   - Components built
   - Contracts written
   - Any new dependencies added to package.json
3. Update every section of ORCHESTRATOR.md:
   - **Current State**: Update the date and the "what exists" / "what does NOT exist" tables
   - **Decisions Made**: Add any new decisions from this session
   - **Known Risks & Fragile Areas**: Add or resolve risks
   - **Subagent History**: Log any subagent work completed
4. Keep the file concise — a reference, not a narrative. Remove resolved items. Keep it under 200 lines.

### 2. Identify changed files

Run `git diff --name-only` and `git diff --cached --name-only` to collect all uncommitted changed files (including the ORCHESTRATOR.md update from step 1). Filter to only source files (`.ts`, `.tsx`, `.js`, `.jsx`, `.css`, `.json`, `.md`). Present the list to the user and confirm before proceeding.

### 3. Run /simplify on changed code

Invoke the `/simplify` skill using the Skill tool. This reviews all changed source code for:

- Dead code and unused imports
- Unnecessary complexity
- Inconsistencies with surrounding code
- Opportunities to reuse existing utilities

Let `/simplify` make its fixes across all changed files. Skip `.md` and `.json` files for simplification — they only need the build/lint pass.

### 4. Build verification loop

After `/simplify` completes, run the build to verify nothing broke:

```
npm run build
```

**If the build fails:**

1. Read the error output and identify the broken file(s)
2. Fix the error
3. Re-run `npm run build`
4. Repeat up to **3 attempts total**

If the build still fails after 3 attempts, revert the simplification changes for the failing file(s) using `git checkout -- <file>` and record them as skipped.

### 5. Lint verification loop

Once the build passes, run lint:

```
npm run lint
```

**If lint fails:**

1. Read the errors and fix them
2. Re-run `npm run lint`
3. Repeat up to **3 attempts total**

If lint still fails after 3 attempts on a specific file, revert that file and record it as skipped.

### 6. Commit

If build and lint pass, stage all changed files and create a clean commit with a descriptive message summarizing what changed (both feature work and any simplifications).

### 7. Push

Push the commit to the remote:

```
git push
```

If the current branch has no upstream, use `git push -u origin <branch>`. If the push fails due to remote changes, run `git pull --rebase` first, then re-run the build to verify the rebase didn't break anything before pushing again.

### 8. Summary

Present a final summary:

- **ORCHESTRATOR.md**: what sections were updated
- **Files cleaned up**: list each file and what changed
- **Files skipped**: list each file and why (build error, lint error, what failed)
- **Commit**: the commit hash and message
- **Pushed to**: remote branch name and URL

## Important rules

- **Never change behavior** — simplification must be cosmetic/structural only
- **File-level isolation** — if a file's changes break the build, revert only that file
- **Respect .gitignore** — don't touch ignored files
- **No new dependencies** — don't add packages to fix issues
- **Ask before proceeding** if more than 10 files are changed
- **Never force push** — if push fails after pull/rebase, stop and report
