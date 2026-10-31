---
name: minor-release
description: Execute a minor release end to end for this repository: guard against shallow clones, collect user-visible changes, write and confirm the announcement entry, run scoped checks, then run the release script that bumps the version, updates the changelog, commits, tags, and pushes. Use when a minor release or new version is requested.
---

# minor-release

> User-facing output during this skill (progress reports, questions, completion notices, error messages) is in Chinese.

Execute a minor release end to end: collect changes, write the announcement, run scoped checks, then run the release script. The release script owns the version bump, the changelog entry, the release commit, the tag, and the push. Do not hand-replicate what the script does.

## Triggers

Use this skill when:

- A minor version release is requested, or the user asks for a new version or says "release minor".
- A development cycle has ended and the accumulated changes need to be packaged as a minor release.

Do not use this skill when:

- The request is a patch or major release with a different bump type. The script accepts `patch`, `minor`, and `major`; this skill covers the `minor` invocation only. For another bump type, confirm the type with the user first and do not silently substitute it.
- The request is only to write announcement copy with no release. Write the copy and stop before Step 5.
- The working tree has unrelated uncommitted work that has not been evaluated. Resolve or set it aside first; do not let the release commit sweep it up unseen.

## Must-read references

Read these before starting Step 1.

- `references/release-script.md` — the release script annotated step by step, including the dirty-tree guard, the version sources, and the changelog generation.
- `references/shallow-clone-guard.md` — the required shallow-clone pre-step and how to verify it.

## Procedure

### Step 1 — Shallow-clone guard (required, before anything else)

The release script has no shallow-clone handling: in a shallow checkout, the previous-tag lookup finds no tag and the changelog entry degrades to a placeholder. Run the guard in `references/shallow-clone-guard.md` before collecting changes and before invoking the script. If the guard cannot restore full history, stop and report it; do not proceed with a degraded changelog. Verify the lookup succeeds and record the previous tag found.

### Step 2 — Collect change information

1. Get the current version from `package.json` (the authoritative source):

   ```bash
   node -p "require('./package.json').version"
   ```

2. Get all commits since the previous tag found in Step 1:

   ```bash
   git log --oneline "<previous-tag>..HEAD"
   ```

   Do not substitute a different range. The script's changelog uses the same previous-tag lookup and excludes `release:` commits; see `references/release-script.md`.

3. Classify by Conventional Commits type (`feat`, `fix`, `refactor`, `perf`, `chore`, `ci`, `docs`, `test`, `style`).
4. Filter to user-perceptible changes: keep `feat`, `fix`, `perf`, and `refactor` entries that affect UI or behaviour. Remove pure `chore`, `ci`, `docs`, `test`, and `style` entries.
5. Show the change summary to the user and ask: any additional features to highlight, any wording or ordering to adjust, and any changes that must not appear in the announcement.

### Step 3 — Write the announcement and wait for confirmation

1. Calculate the new version: a minor bump of the current version (for example `2.3.0` becomes `2.4.0`).
2. Add a new entry at the top (first property position) of the `ANNOUNCEMENTS` object in `src/config/announcements.ts`:

   ```typescript
   'v{x.y.z}': {
     title: 'v{x.y.z} 更新内容',
     items: [
       '面向用户的中文描述，每条 ≤30 字',
     ],
   },
   ```

   The shape above follows the current head entry in that file. The key format is `v{major}.{minor}.{patch}` and the title follows the same version plus the fixed suffix shown. No claim is made here that any test depends on the title format.

3. Announcement item rules (skill rules, not code facts): all in Chinese, aimed at end users; each item at most 30 characters; no technical implementation detail (no refactor, architecture, or middleware wording); only changes users can perceive: new features, experience optimisations, important bug fixes; new features first, optimisations in the middle, fixes last; typically 3 to 6 items.
4. Show the draft to the user and wait for confirmation before continuing.

### Step 4 — Commit the announcement separately

If `src/config/announcements.ts` has uncommitted changes, commit them separately first:

```bash
git add src/config/announcements.ts
git commit -m "docs(announcements): add v{x.y.z} What's New entry"
```

The announcement file is not in the release script's version-file allowlist, so an uncommitted announcement change would trigger the script's prompt in Step 6. Committing it first keeps that prompt from firing for a known change.

### Step 5 — Run scoped checks

Run the scoped local checks for the changed area plus the pre-push checks (`tsc` and the dead-code check). The full gate runs in continuous integration; a local full-gate run is not the default gate for this skill. The release script itself runs no quality check. If scoped checks fail:

- Lint or format errors: auto-fix with the fixer on the approved files, then re-run the scoped checks.
- Type errors: attempt a fix only within the approved scope; if a safe fix is not possible, stop and report blocked.
- Test failures: stop and report blocked. Do not auto-modify business logic to make a test pass.

### Step 6 — Run the release script and handle its prompts

```bash
bash scripts/release.sh minor
```

The script bumps the version, syncs `app.json`, requires the announcement entry from Step 3, generates the changelog entry, commits, tags, and pushes. See `references/release-script.md` for each step and for what the script does not do.

If the script prompts about uncommitted changes beyond the version files, it is asking about any change outside its four-file allowlist (`package.json`, `pnpm-lock.yaml`, `app.json`, `src/config/version.ts`), not only about the announcement. Read the listed changes, evaluate each one, and answer only after that evaluation. The default answer is No. Do not answer Yes reflexively.

If the script reports a missing announcement entry, go back to Step 3 and confirm the entry was added and committed. If the script reports a dirty working tree, evaluate the uncommitted changes, commit or set them aside as needed, and re-run from Step 1 (the guard) only if history state changed.

### Step 7 — Verify the release

1. Confirm the release commit and tag:

   ```bash
   git log --oneline -3
   git tag -l 'v*' | tail -3
   ```

2. Confirm the remote push succeeded from the script's output (`Released v{x.y.z}`).
3. If the push failed, the local tag already exists. Prompt the user with the manual retry:

   ```bash
   git push origin HEAD --tags
   ```

### Step 8 — Report

Report in Chinese: the previous tag found, the new version, the announcement entry added, the scoped checks run with their results, the commit and tag created, and whether the push succeeded. Name anything that was skipped or degraded, including a changelog that fell back to a placeholder entry.

## Acceptance commands

```bash
git rev-parse --is-shallow-repository
git describe --tags --abbrev=0 HEAD
bash scripts/release.sh minor
git log --oneline -3
git tag -l 'v*' | tail -3
```

Acceptance is: the guard passed with a previous tag found, the announcement entry is committed, the script completed, and the tag exists locally and on the remote.

## Pitfalls

1. Running the script in a shallow clone without the guard. The changelog silently degrades to a placeholder entry.
2. Answering Yes to the script's uncommitted-changes prompt without reading the listed changes.
3. Hand-editing a version number into `src/config/version.ts`. That file holds no version literal; it reads `package.json`.
4. Claiming the lockfile is updated by the script. Check `git status` after the bump and report what actually changed.
5. Treating a local full-gate run as required before the script. The script runs no quality check; the full gate runs in continuous integration.
