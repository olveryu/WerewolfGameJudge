# Release script, annotated

Source: `scripts/release.sh` (108 lines), read in full at drafting time. This reference restates the script step by step. Where the script is silent, this reference says so instead of filling the gap.

## Invocation and bump types

```bash
bash scripts/release.sh          # patch (default)
bash scripts/release.sh minor    # minor
bash scripts/release.sh major    # major
```

The first argument must be exactly `patch`, `minor`, or `major`. Anything else exits with an error and a usage message. The script runs with `set -e` and changes into the repository root (the parent of the script directory) before doing anything else.

## Step 1 — Dirty-tree guard

Before the bump, the script lists uncommitted and staged changes, excluding exactly four files:

```
package.json
pnpm-lock.yaml
app.json
src/config/version.ts
```

If any other change exists, it prints up to five of them and prompts:

```
是否一起提交？(y/N)
```

The default is No. Answering anything other than `y`/`Y` cancels the script with "已取消" and exits before the version is bumped, so a cancellation never leaves a half-bumped version behind. Answering Yes includes those changes in the release commit the script creates later with `git add -A`. The prompt fires for any non-version-file change, not only for announcement changes.

## Step 2 — Version bump

```bash
pnpm version "$BUMP_TYPE" --no-git-tag-version
VERSION=$(node -p "require('./package.json').version")
```

`pnpm version` updates `package.json`. The `--no-git-tag-version` flag means the script creates the commit and tag itself later; `pnpm` does not. Whether `pnpm version` also updates `pnpm-lock.yaml` was not verified from a deciding source; do not claim it does. After the bump, check `git status` and report exactly which files changed.

### Version sources

| Source                      | Role                                                                                                                                                                | Verified                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `package.json` (`version`)  | Authoritative source. The only version number the bump writes directly.                                                                                             | `scripts/release.sh`, `node -p` read                                                                              |
| `app.json` (`expo.version`) | Synced copy. The script rewrites it with a small inline program after the bump.                                                                                     | `scripts/release.sh` sync block; `app.json` carries `"version": "2.8.0"` matching `package.json` at drafting time |
| `src/config/version.ts`     | Derived copy, not a version source. It imports `package.json` and exports `APP_VERSION` as `` `v${packageJson.version}` ``. It contains no version literal to edit. | `src/config/version.ts` read in full                                                                              |
| `pnpm-lock.yaml`            | Named in the dirty-tree guard allowlist. No explicit lockfile step exists in the script.                                                                            | `scripts/release.sh` guard lines; lockfile update behaviour unverified                                            |

Do not hand-edit a version number into `src/config/version.ts`: it reads `package.json` and holds no version literal.

## Step 3 — Announcement requirement

The script exits if `src/config/announcements.ts` has no entry keyed `'v$VERSION'`:

```bash
grep -q "'v$VERSION'" src/config/announcements.ts
```

The entry must already exist before the script runs. The script does not create it, and it does not check the entry's contents beyond the key. The announcement entry format is described in Step 3 of `SKILL.md`.

## Step 4 — Changelog generation

```bash
PREV_TAG=$(git describe --tags --abbrev=0 HEAD 2>/dev/null || echo "")
TODAY=$(date +%Y-%m-%d)
```

- If a previous tag is found, the changes are `git log --format='- %s' "$PREV_TAG..HEAD"` with lines starting `- release:` removed.
- If no previous tag is found, the changes are the single line `- Initial release`. This is the shallow-clone degradation: in a shallow checkout, `git describe` finds no tag and the entry is a placeholder. The script contains no shallow-clone handling (verified by searching it for shallow-clone and depth handling; none exists). The guard in `references/shallow-clone-guard.md` exists because of this.
- The header is `## [<version>] - <today>`.
- The entry is inserted before the first `## ` heading in `CHANGELOG.md`, only if the file exists, contains a `## ` heading, and the changes list is non-empty. The insertion is done with an inline program that splits the file at the first newline-plus-`## ` boundary.
- The script does not itself commit the changelog separately; the changelog change is swept into the release commit in Step 5.

## Step 5 — Commit, tag, push

```bash
git add -A
git commit -m "release: v$VERSION"
git tag "v$VERSION"
git push origin HEAD --tags
```

Notes:

- `git add -A` is the script's own behaviour for the release commit.
- The commit message is generated by the script.
- The tag name is `v$VERSION`, matching the announcement key format.
- If the push fails, the script prints a warning, states the local tag was already created, and gives the manual retry command `git push origin HEAD --tags`. It does not retry, and it does not delete the tag. A failed push is not a failed release locally; report both facts separately.

## What the script does not do

- It does not run any quality, type, lint, format, or test check.
- It does not verify the announcement entry's contents.
- It does not handle shallow clones, missing tags beyond the placeholder fallback, or push retries.
- It does not touch any file outside the bump, the `app.json` sync, the changelog insertion, and the commit/tag/push steps above.
