---
name: minor-release
description: 'Execute a minor release end-to-end: collect changes, write announcement, bump version, commit, tag, push. Use when: minor-release, minor release, new version, release minor.'
argument-hint: 'Main changes description (optional, used to generate announcement)'
---

# minor-release Skill

Execute a minor release end-to-end: collect changes → write announcement → quality check → bump + commit + tag + push.

## When to Use

- User requests a minor version release
- User says "release", "new version", "release minor"
- Development cycle ends, accumulated changes need to be packaged and released

---

## Procedure

### Phase 1 — Collect Change Information

1. Get current version number:

   ```bash
   node -p "require('./package.json').version"
   ```

2. Get all commits since the last tag:

   ```bash
   git log --oneline "$(git describe --tags --abbrev=0 HEAD)..HEAD"
   ```

3. Classify by Conventional Commits type (feat / fix / refactor / perf / chore / ci / docs / test / style).

4. Filter to **user-perceptible** changes (keep feat / fix / perf / refactor that affect UI or behavior). Remove pure chore / ci / docs / test / style.

5. Show change summary to user and ask:
   - Any additional features to highlight?
   - Need to adjust wording or ordering?
   - Any changes that should NOT appear in the announcement?

---

### Phase 2 — Write Announcement + Wait for Confirmation

1. Calculate new version number (current minor bump, e.g., `2.3.0` → `2.4.0`).

2. Add a new entry at the **top** (first property position) of the `ANNOUNCEMENTS` object in `src/config/announcements.ts`:

   ```typescript
   'v{x.y.z}': {
     title: 'v{x.y.z} 更新内容',
     items: [
       '面向用户的中文描述，每条 ≤30 字',
       // ...
     ],
   },
   ```

3. **items writing rules**:
   - All in Chinese, targeting end users
   - Each item ≤30 characters, no technical implementation details (no "refactor", "architecture", "middleware", etc.)
   - Only write changes users can perceive: new features, UX optimizations, important bug fixes
   - New features first, optimizations in middle, fixes last
   - Typically 3-6 items

4. **Output draft, show to user, wait for confirmation before continuing.**

---

### Phase 3 — Execute Release

#### 3a. Commit announcement changes

If `src/config/announcements.ts` has uncommitted changes, commit separately first:

```bash
git add src/config/announcements.ts
git commit -m "docs(announcements): add v{x.y.z} What's New entry"
```

#### 3b. Run quality check

```bash
pnpm run quality
```

If it fails:

- **lint / format errors** → `pnpm exec eslint . --fix && pnpm exec prettier --write .`, fix then rerun
- **TypeScript type errors** → attempt fix; if can't safely fix then BLOCKED
- **Test failures** → immediately BLOCKED, do not auto-modify business logic

#### 3c. Execute release script

```bash
bash scripts/release.sh minor
```

The script automatically:

- Bumps `package.json` + syncs `app.json`
- Checks whether `announcements.ts` has a matching version entry (added in Phase 2)
- Generates CHANGELOG entry
- `git add -A && git commit -m "release: v{x.y.z}"`
- Creates git tag `v{x.y.z}`
- Pushes to origin

#### 3d. Handle script interactions

- If the script prompts "detected uncommitted changes beyond version files" and asks whether to include them → enter `y` (since announcement was committed in 3a, this shouldn't trigger; if it does, evaluate the other changes)
- If the script reports missing announcements entry → Phase 2 commit didn't take effect, go back to Phase 2 to check

---

### Phase 4 — Verify

1. Confirm release commit and tag:

   ```bash
   git log --oneline -3
   ```

2. Confirm tag exists:

   ```bash
   git tag -l 'v*' | tail -3
   ```

3. Confirm remote push succeeded (check for `✅ Released v{x.y.z}` in Phase 3 output).

4. If push failed (network issue), prompt user:

   ```bash
   git push origin HEAD --tags
   ```

---

## Error Handling

| Scenario                                | Action                                                                           |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| `pnpm run quality` fails                | Try auto-fix (lint/format); type errors/test failures → BLOCKED                  |
| release.sh reports missing announcement | Go back to Phase 2, confirm entry correctly added and committed                  |
| release.sh reports dirty working tree   | Evaluate uncommitted changes, commit or stash as needed                          |
| Push fails                              | Local tag already created, prompt user to manually `git push origin HEAD --tags` |
| Version number calculation error        | Use value in `package.json` as authority, verify with `node -p`                  |

---

## Constraints

- **Announcement items must be in Chinese**, no technical implementation details
- **Do not modify `release.sh` itself**
- **Release commit is generated by the script** (`release: v$VERSION`), do not manually commit version files
- **Announcement changes use separate commit** `docs(announcements): add v$VERSION What's New entry`
- **`--no-verify` forbidden**, do not bypass git hooks
- **Force push forbidden**
- **Don't change business logic** — this skill only handles the release process
- **E2E compatible** — announcement title must match `/^v\d+\.\d+\.\d+ 更新内容$/` pattern (E2E auto-dismisser depends on this regex)
