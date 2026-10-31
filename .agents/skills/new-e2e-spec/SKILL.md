---
name: new-e2e-spec
description: 'Add or update a Playwright E2E spec: real multi-context seats, no automated players to fill seats, one spec per change, night-driver patterns, and single-spec verification through the actions API. Use when adding or changing an E2E spec; never as a substitute for unit or contract tests.'
---

# New E2E spec

E2E specs prove visible behaviour in a real browser against a local
server. They are slow, flaky-prone, and expensive to verify — write
one only when unit and contract tests cannot prove the behaviour.
User-facing output is in Chinese; spec names and test titles use
English.

## When to use

Use when an existing spec must change with a behaviour change, or
when a new user-visible flow needs browser-level proof that no
lower-level test can give.

Do not use when:

- the behaviour is already covered by a unit or contract test, or
  could be — E2E is the last resort, not the default;
- no spec exists for the area and no approval to create one has been
  given — updating an existing spec is the normal case; a new spec
  needs a report and approval first (a new game's spec skeleton
  stays a `.tmpl` until then);
- the change is a fix to product code — fix the product, classify
  the failure, and update the spec only if the behaviour
  intentionally changed;
- seats would be filled with automated players, or a second spec
  would ride along in the same change — both are process rules
  (see Step 1).

## Must-read references

1. `references/helpers-pages.md` — fixtures, helpers, pages,
   failure evidence.
2. `references/patterns.md` — setup patterns, seat/role numbering,
   naming, required patterns.
3. `references/night-step-order.md` — current 37-step
   `NIGHT_STEP_ORDER`.
4. `references/rules-and-verification.md` — the E2E law, config
   facts, single-spec trigger, interaction rules, non-determinism.

## Steps

### 1. Decide: update, or report for a new spec

Check whether an existing spec covers the flow; if it does, change
that one spec and no other. If none does, report the proposal
(flow, why lower-level tests cannot prove it, seat count, pattern)
and wait for approval before creating a file. State the seat count
up front: every seat is one independent browser context. Automated
players never fill seats in a new spec, and the one-spec-per-change
rule applies from the first commit.

### 2. Choose the pattern and the page objects

Pick the pattern from `references/patterns.md` before writing:
`withSetup` + night-driver for werewolf night flows,
`setupNPlayerGameWithRoles` for role-aware multi-player setup, the
`app` fixture for single-page flows. Use page objects for selectors
and actions; put shared business flows in the domain helpers, not
in the spec and not in generic primitives.

### 3. Write the spec

Drive the flow in `NIGHT_STEP_ORDER`, one role acting from its own
page. Navigate with `gotoWithRetry()`, wait with
`waitForRoomScreenReady()` and event-driven waits, mark phases with
`test.step()`, and assert visible behaviour — what the player sees
and can do — not internal state. Keep the spec to scenario intent
and assertions; helpers own the mechanics. Never assert a fixed
value from a random or time source.

### 4. Follow the interaction rules

No `force: true` for normal interactions (the disabled-state
exception in `references/rules-and-verification.md` is the only
allowed shape). No fixed sleeps except polling cadence of at most
300 ms. No swallowing assertion or state-transition failures with
`.catch`. No `console.log` in the spec; attach evidence with
`testInfo.attach()`. No skipped or focused tests, and no temporary
diagnostic output, in a committed spec.

### 5. Verify with a single-spec run

Verify exactly the changed spec, one commit and push at a time:

```sh
gh workflow run e2e-single-spec.yml --ref <branch> --field spec=<file>
```

Then verify through the actions API: the run's `head_branch` and
`head_sha` match the target branch and commit, and its `conclusion`
is the verdict. Do not judge the run from a piped watch command's
exit code. Locally, run the single spec with the standard config
(`pnpm exec playwright test e2e/specs/<file>`) before pushing when
the local servers are available.

### 6. Classify any failure before touching the spec

On a red run, investigate in order: failure bundle / PR digest,
then trace, then CI logs only for infrastructure-shaped failures.
Classify: real regression (stop, report, fix the product), intentional
behaviour change (update the affected spec to the new flow, one spec
per commit, single-spec verified, assertions never weakened), or
flake (record the exact error; a passing rerun is not a diagnosis).
Never edit a spec to match broken behaviour, and never rerun a
failure into silence.

## Acceptance commands

```sh
.agents/skills/new-e2e-spec/scripts/check-e2e.sh .
gh workflow run e2e-single-spec.yml --ref <branch> --field spec=<file>
```

Acceptance is the actions-API `conclusion` for that run on the
correct branch and commit, not a local exit code and not a piped
watch result.

## Pitfalls

1. Writing `NIGHT_STEP_ORDER_INTERNAL` or pasting an old step order
   — the constant does not exist; the order lives in
   `nightStepIds.ts`.
2. Filling seats with automated players, or copying the existing
   bot-fill steps — new specs use real contexts only; the two
   existing bot steps are exceptions, not patterns.
3. Judging a run from `gh run watch | tail` — the exit code is the
   pipe's, not the run's; read `conclusion` from the API.
4. Asserting fixed values from random or time sources, or asserting
   a wall-clock duration — assert visible behaviour instead.
5. Using `force: true`, a fixed sleep, or a swallowed `.catch` to
   reach green — each hides the actionability or timing evidence
   the suite exists to capture.
