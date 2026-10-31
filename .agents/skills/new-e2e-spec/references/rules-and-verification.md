# Rules and verification — process rules, stated as process rules

## The E2E law, and what enforces it

Three rules in this skill are process rules. Nothing in the
workflows, config, or lint setup enforces them as code; they hold
because reviewers and operators follow them. Do not claim otherwise.

1. **Real seats, no automated players to fill seats.** Every seat is
   an independent browser context via `createPlayerContexts`.
   Current split in the specs, verified at drafting time: the
   Avalon main flow uses 10 independent contexts with zero automated
   players, FibKing uses 4 real players, Undercover uses 6 real
   players, and werewolf night specs drive real contexts through
   the night driver. Two existing exceptions prove the split is not
   a blanket codebase fact: `drawguess.spec.ts` has a "fill bots to
   reach a full room" step, and `avalon.spec.ts` has a bot-room
   scenario for music settings. A new spec follows the real-seat
   rule and does not copy an exception step; if a scenario seems to
   need one, report first.
2. **One spec per change.** One spec file per commit and push,
   verified one at a time. No workflow or config polices commit
   contents.
3. **Single-spec verification is an operator procedure**, not
   something the workflow does (see below).

## Playwright config facts

`playwright.config.ts`: `testDir: ./e2e/specs`, `fullyParallel:
true`, per-test timeout 60,000 ms, `forbidOnly` on CI, retries 2 on
CI only, workers 2 on CI, reporters `html` + failure bundle (CI
passes its own reporter list and must re-name the bundle reporter),
`trace: retain-on-failure`, `screenshot: only-on-failure`. Projects:
`chromium` (ignores `fibking-responsive.spec`) and `small-mobile`
(320×640, matches `home` / `config` / `fibking-responsive` specs).
Two web servers (API on :8787, web on :8081); base URL single
source `E2E_BASE_URL`, default `http://localhost:8081`. Specs and
helpers must not hardcode the default URL.

## Single-spec trigger and verification

Workflow: `.github/workflows/e2e-single-spec.yml` — manual trigger
with exactly one input, `spec` (bare filename). There is
deliberately no branch input: the branch under test is the dispatch
ref, because an input cannot change which workflow definition
executes.

```sh
gh workflow run e2e-single-spec.yml --ref <branch> --field spec=<file>
```

The job calls the single reusable implementation
(`e2e-run.yml`, `shard: single`, `build-web: true`), which validates
the spec file exists under `e2e/specs/` (bare filename, no `/`)
before installing anything. CI shards in `ci.yml` (9 shards) call
the same workflow with space-separated spec lists and
`build-web: false`.

Verify the run as operator procedure: read the run's `head_branch`
and `head_sha` and its `conclusion` through the actions API, and
compare them with the target branch and commit. Never judge success
from a piped watch command's exit code — the exit code belongs to
the last command in the pipe, not to the run.

## Interaction rules and their sanctioned exceptions

From `e2e/helpers/README.md`, "Required Test Patterns":

- `page.waitForTimeout()` only as polling cadence, at most 300 ms.
- Never `force: true` to bypass actionability for normal user
  interactions. The one current occurrence in specs is the
  sanctioned exception shape: `drawguess.spec.ts:79` clicks a
  _disabled_ button with `force: true` to prove the press fires
  nothing — a plain click would wait forever for enablement. That
  disabled-state exception path is the only allowed shape.
- Do not swallow assertion or state-transition failures with
  `.catch(() => {})`. `.catch` for conditional probing,
  retry-polling, and teardown is the established helper usage.
- No `console.log` in specs. Existing exceptions: `diagnostics.ts`
  forwarding and `night-driver.ts`'s prefixed driver log. No
  `console.log` in a new spec or helper.
- Do not commit `test.skip` / `describe.skip` / `test.only` or
  temporary `[DIAG]` output. The only related config gate is
  `forbidOnly`; skip detection by CI was not found.
- No `.isVisible({ timeout })` — none exists in the suite, and the
  timeout parameter is ignored by the framework.

## Non-determinism rule

Never assert a fixed value from a non-deterministic source:
`Math.random()`, `Date.now()`, random seeds, or generated ids.
Assert visible behaviour and relationships (present / absent,
ordered, counted from the rendered state), never a literal random
or time value. A failure that follows an intentional behaviour
change is classified, not auto-repaired: update the affected spec
to the new flow, one spec per commit, verified with a single-spec
run — assertions are never weakened to reach green.
