# Shallow-clone guard

## Why this guard exists

`scripts/release.sh` finds the previous tag with:

```bash
git describe --tags --abbrev=0 HEAD
```

In a shallow clone, the tag history is not present, so the lookup finds no tag. The script then writes `- Initial release` as the entire changelog entry for the release, even when a long history of releases exists. The script contains no fetch, unshallow, or depth handling of any kind (verified by reading the script in full and searching it for shallow-clone handling; none exists). The evidence for the degradation is the script's own fallback branch: an empty `PREV_TAG` produces the placeholder line. The historical instance behind this guard is recorded in the audit evidence: a release run in a shallow worktree produced a placeholder changelog entry, and only a later history fetch restored the full log.

The tag-triggered release workflow is not affected in the same way: it checks out with full history (`fetch-depth: 0`). That workflow immunity does not help a local `scripts/release.sh` run.

## Required pre-step

Run this guard before collecting changes (Step 2 of `SKILL.md`) and before invoking the script (Step 6).

```bash
git rev-parse --is-shallow-repository
```

- If the output is `false`, the checkout is not shallow. Continue, and still verify the next command succeeds.
- If the output is `true`, restore full history before doing anything else:

  ```bash
  git fetch --unshallow origin
  ```

  Then verify:

  ```bash
  git describe --tags --abbrev=0 HEAD
  ```

  The command must print a tag (for example `v2.7.0`). If it prints nothing, stop and report the failed lookup: the changelog would degrade to the placeholder.

## After the fetch

Re-run the guard verification after any fetch, rebase, or checkout that could change history depth. A guard that passed before a fetch is not evidence after one. Record the previous tag found in the final report (Step 8 of `SKILL.md`), so a degraded changelog is visible instead of silent.

## What not to do

- A partial fetch or a tag-only fetch is acceptable only if the same `git describe` command succeeds afterwards. The acceptance test is the command's output, not the fetch command used.
- An empty lookup in a checkout that claims to be complete is a checkout problem, not a project fact. Verify against the remote tag list if the local lookup is empty.
