---
name: debug-issue
description: Structured debugging workflow for this repository: classify a symptom, locate the root cause by static analysis first, use diagnostic logging only when static analysis cannot decide, fix the root cause, and verify with scoped checks. Use when investigating a bug, crash, disconnect, state mismatch, test failure, or performance problem.
---

# debug-issue

> User-facing output during this skill (progress reports, questions, completion notices, error messages) is in Chinese.

A structured flow: classify the symptom, then static analysis first, then dynamic diagnosis only when needed, then a root-cause fix, then a verification loop.

## Triggers

Use this skill when:

- A user reports a bug, abnormal behaviour, a crash, or a performance problem.
- A unit test, contract test, or end-to-end spec fails and needs investigation.
- A disconnect, state mismatch, or API error needs a root cause, not a workaround.

Do not use this skill when:

- The request is a new feature, a refactor, or a release. Use the skill for that work instead.
- The answer is already known from a file that can be read directly. Read the file and answer; do not run this whole procedure.
- The request is to change behaviour without a reported defect. That is a design change, not debugging.

## Must-read references

Read these before starting Step 2. They are part of this skill, not optional background.

- `references/first-check-map.md` — first-check paths by symptom branch, with the dead paths removed and replaced.
- `references/session-link-audio.md` — state identity, the realtime link, and the audio-playback lock: one pointer line each in Step 2, full detail here.
- `references/diagnostic-logging.md` — diagnostic logging rules and cleanup.

## Procedure

### Step 1 — Classify the symptom and gather facts

Extract from the report: the specific behaviour, the reproduction scenario, the platform, the exact error text, and whether related code changed recently. Classify into one branch (branches may combine):

| Branch | Scenario                 | Typical symptoms                                                   |
| ------ | ------------------------ | ------------------------------------------------------------------ |
| A      | Client UI anomaly        | Component not rendering, state not updating, style broken, flicker |
| B      | Realtime / network issue | Disconnect, message loss, timeout, reconnect loop                  |
| C      | Game logic bug           | Role action result unexpected, state drift, reveal error           |
| D      | API / worker error       | 4xx/5xx, worker exception, database query failure                  |
| E      | End-to-end test failure  | Spec error, timeout, selector invalid                              |
| F      | Performance issue        | Slow load, render jank, memory growth                              |

If the symptom does not fit any branch, say so and name the closest branch instead of forcing a fit.

### Step 2 — Static analysis first

Never use dynamic diagnosis when static analysis can locate the issue.

1. Locate the code area with code search. Trace the data flow input to transform to output, step by step. When changing a caller, trace the callee, and vice versa.
2. Check type constraints: schema validation, boundary conditions, and indexed access on types that may be undefined.
3. Check recent changes for the touched paths.
4. Start from the first-check paths in `references/first-check-map.md` for the classified branch.
5. Pointers, one line each (detail lives in `references/session-link-audio.md`):
   - State identity: see `references/session-link-audio.md` (per-game state versions and migration entry points).
   - Realtime link: see `references/session-link-audio.md` (link modules, snapshot phases, and dispatch outcomes).
   - Audio-playback lock: see `references/session-link-audio.md` (the one lock predicate and combinator).

### Step 3 — Dynamic diagnosis, only when static analysis cannot decide

Enter this phase only when Step 2 cannot locate the root cause. Follow `references/diagnostic-logging.md` for diagnostic logs: project logger only, diagnostic prefix, removal after the fix. Then run only the related checks:

```bash
pnpm exec jest --no-coverage --forceExit <path-or-pattern>
pnpm exec playwright test e2e/specs/<spec> --reporter=list
npx tsc --noEmit
```

Interpret the output from the failure bundle or trace first, then from logs.

### Step 4 — State the root cause and the change plan

Before writing any fix:

1. State the root cause in one sentence explaining why it is broken.
2. List the change plan as file, specific modification, and risk (other features that may be affected).

### Step 5 — Fix the root cause

- Route errors through `handleError` in `src/utils/errorPipeline.ts`; see `references/diagnostic-logging.md`.

### Step 6 — Verify with scoped checks

1. Remove all diagnostic logs. Search for the diagnostic prefix and confirm zero residuals.
2. Run the scoped checks for the changed area: the targeted tests, the type check, and the lint/format check on the changed files.
3. Run the related end-to-end spec when the defect touches room or realtime behaviour.
4. Confirm no regression in the affected modules.

### Step 7 — Report

Report in Chinese: the one-sentence root cause, the files changed, the checks run with their results, and anything left unverified.

## Acceptance commands

```bash
pnpm exec jest --no-coverage --forceExit <path-or-pattern>
pnpm exec playwright test e2e/specs/<spec> --reporter=list
npx tsc --noEmit
```

Acceptance is: diagnostic logs removed, scoped checks pass, and the report names the root cause with its deciding code location.

## Pitfalls

1. Naming a shared session module that does not exist. The session boundary is `RoomEntryBoundary` plus `useReadyRoomSession`; there is no shared `RoomSession` module. See `references/first-check-map.md`.
2. Naming the old realtime service paths. Realtime code lives under `src/platform/realtime/`; the old service paths are dead.
3. Treating the audio flag as a value the UI may set. The flag is owned by audio-queue events only; the client lock is read through the one predicate.
4. A plain `as` cast in production code: `src/__tests__/architecture.contract.test.ts` allows only `as const` assertions (see `getOrdinaryTypeAssertions`).
