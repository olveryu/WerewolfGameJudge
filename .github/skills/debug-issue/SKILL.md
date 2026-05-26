---
name: debug-issue
description: 'Structured debugging workflow: diagnose bugs/abnormal behavior, locate root cause, verify fix. Use when: debugging, bug, issue investigation, error, crash, not working, not rendering, timeout, disconnect.'
argument-hint: 'Symptom description (e.g., seats not showing after entering room, WebSocket frequent disconnects, E2E hunter spec timeout)'
---

# Structured Debugging Skill

A structured flow: classify symptoms → static analysis → dynamic diagnosis → root cause fix → verification loop.

## When to Use

- User reports a bug, abnormal behavior, crash, or performance issue
- E2E / unit test failure needs investigation
- WebSocket disconnects, state desync, API errors

---

## Procedure

### Phase 1 — Symptom Classification + Information Gathering

Extract the following from the user's description:

| Field          | Description                        | Example                                |
| -------------- | ---------------------------------- | -------------------------------------- |
| Symptom        | Specific behavior                  | Seats not rendering / 401 error        |
| Reproduction   | Trigger scenario                   | After entering room / third click      |
| Platform       | Web / iOS / Android / All          | Web                                    |
| Error message  | console / Sentry / alert text      | `TypeError: Cannot read...`            |
| Recent changes | Was related code recently modified | Refactored ConnectionManager yesterday |

Classify symptom into scenario branches (can combine):

| Branch | Scenario                | Typical Symptoms                                                   |
| ------ | ----------------------- | ------------------------------------------------------------------ |
| A      | Client UI anomaly       | Component not rendering, state not updating, style broken, flicker |
| B      | WebSocket/Network issue | Disconnect, message loss, timeout, reconnect loop                  |
| C      | Game logic bug          | Role action result unexpected, state drift, reveal error           |
| D      | API/Worker error        | 4xx/5xx, DO exception, D1 query failure                            |
| E      | E2E test failure        | Playwright spec error, timeout, selector invalid                   |
| F      | Performance issue       | Slow load, render jank, memory leak                                |

---

### Phase 2 — Static Analysis (Preferred)

**Principle: Never use dynamic diagnosis when static analysis can locate the issue.**

1. **Locate code area** — `grep_search` / `semantic_search` to find relevant files
2. **Trace data flow** — Input → Transform → Output, verify step by step
3. **Bidirectional tracing** — When modifying caller, trace callee, and vice versa
4. **Check type constraints** — Schema validation, boundary conditions, `noUncheckedIndexedAccess` index access
5. **Check recent changes** — `git log --oneline -20 -- <path>`
6. **Every affected symbol** — Use `grep_search` or `vscode_listCodeUsages` to verify all consumers

#### First-check Paths by Scenario Branch

**A — Client UI Anomaly:**

| First-check Path        | Investigation Focus                                  |
| ----------------------- | ---------------------------------------------------- |
| `src/screens/<Screen>/` | Policy hooks return values, conditional render logic |
| `src/services/facade/`  | GameState snapshot derivation, selector              |
| `src/contexts/`         | Context Provider mounting, value passing             |
| `src/components/`       | Props types, memo deps, key stability                |

Common root causes: Selector returning new reference causing infinite re-render, Context not mounted, conditional render missing state

**B — WebSocket/Network Issue:**

| First-check Path                          | Investigation Focus                                  |
| ----------------------------------------- | ---------------------------------------------------- |
| `src/services/infra/ConnectionManager.ts` | Reconnect logic, error classification, state machine |
| `src/services/infra/RealtimeService.ts`   | Subscribe/unsubscribe, message routing               |
| `src/services/facade/`                    | applySnapshot timing                                 |
| `packages/api-worker/src/do/`             | DO WebSocket handler, broadcast logic                |

Common root causes: Token expired without refresh, DO cold-start race condition, message sequence number gap

**C — Game Logic Bug:**

| First-check Path                              | Investigation Focus                   |
| --------------------------------------------- | ------------------------------------- |
| `packages/game-engine/src/resolvers/`         | Resolver logic, edge cases            |
| `packages/game-engine/src/models/roles/spec/` | NIGHT_STEPS order, schema constraints |
| `packages/api-worker/src/do/`                 | DO reducer calls, state writes        |
| `src/services/facade/`                        | Client snapshot interpretation        |

Common root causes: Resolver not handling skip case, NIGHT_STEPS order error, DO write race condition

**D — API/Worker Error:**

| First-check Path                      | Investigation Focus                  |
| ------------------------------------- | ------------------------------------ |
| `packages/api-worker/src/routes/`     | Zod schema validation, param passing |
| `packages/api-worker/src/middleware/` | Auth middleware, rate limit          |
| `packages/api-worker/src/do/`         | DO stub calls, SQLite queries        |
| `packages/api-worker/src/d1/`         | D1 migration compatibility           |

Common root causes: Zod schema mismatch with request body, DO id construction error, D1 migration missing column

**E — E2E Test Failure:**

| First-check Path              | Investigation Focus                         |
| ----------------------------- | ------------------------------------------- |
| `e2e/specs/<failing-spec>.ts` | Selector changes, wait logic                |
| `e2e/helpers/night-driver.ts` | Role action helpers matching current UI     |
| `e2e/helpers/waits.ts`        | Wait conditions sufficiency                 |
| `e2e/helpers/diagnostics.ts`  | Whether DiagnosticData captures useful info |

Common root causes: testid changed without sync, WebSocket not ready before action, insufficient timeout

**F — Performance Issue:**

| First-check Path   | Investigation Focus                                |
| ------------------ | -------------------------------------------------- |
| `src/screens/`     | Large lists not virtualized, unnecessary re-render |
| `src/services/`    | Frequent setState, un-debounced operations         |
| `src/hooks/`       | useMemo/useCallback deps too broad                 |
| Worker network tab | Request waterfall, oversized payload               |

Common root causes: Selector returning new object each time, list items without memo, audio preload blocking

---

### Phase 3 — Dynamic Diagnosis (When Static Analysis Cannot Determine Root Cause)

**Only enter this phase when Phase 2 cannot locate the root cause.**

#### 3a. Add `[DIAG]` Diagnostic Logs

```typescript
// Use project logger, console.* is forbidden
import { log } from '@/utils/logger';
const diagLog = log.extend('DIAG');

// Add diagnostics at critical paths
diagLog.info('[DIAG] snapshot applied', { phase, playerCount: state.players.length });
```

Rules:

- Prefix `[DIAG]` ensures E2E diagnostics.ts will forward to Playwright output
- Use `log.extend('DIAG')` or existing module logger
- Record key variable values, branch taken, timing info
- **All `[DIAG]` logs must be removed after the fix**

#### 3b. Run Related Tests

```bash
# Unit test (specific file)
node node_modules/.bin/jest --no-coverage --forceExit --testPathPattern="<pattern>"

# E2E test (specific spec)
pnpm exec playwright test e2e/specs/<spec> --reporter=list

# Type check
npx tsc --noEmit
```

#### 3c. Interpret Diagnostic Output

- Playwright trace: auto-saved in `test-results/` directory
- Sentry: production structured logs (sentryTransport configured)
- Mobile debug panel: 500 in-memory logs, on-screen viewing

---

### Phase 4 — Root Cause Fix

**Band-aid fixes are forbidden.** Do not use conditionals, guard clauses, or `?.` to work around symptoms of structural problems.

#### Before fixing, you must:

1. Clearly state the root cause (one sentence explaining why it's broken)
2. List the change plan:

```
File: <path>
Change: <specific modification>
Risk: <other features that may be affected>
```

3. **Wait for user confirmation before coding**

#### While fixing, you must:

- Verify all consumers of each affected symbol using `grep_search` / `vscode_listCodeUsages`
- Bidirectional trace when changing params/schema (caller ↔ callee)
- Error handling three layers: `log.error()` + `Sentry.captureException()` + `showAlert(Chinese message)`
- Expected errors (401/403/429, user cancellation) only `log.warn()` + UI feedback, no Sentry

#### Forbidden fix patterns:

| Forbidden                             | Correct Approach                          |
| ------------------------------------- | ----------------------------------------- |
| `value?.prop` bypassing required      | Investigate why value might be undefined  |
| `as any` to silence type errors       | Fix the type definition or caller         |
| `try { } catch { }` swallowing errors | Classify handling: expected vs unexpected |
| `if (!x) return` guard masking cause  | Fix why x doesn't exist                   |
| `setTimeout` waiting on races         | Use events/state machine for proper sync  |

---

### Phase 4.5 — Core Principles Self-Check

Run through the core principles checklist 🔍 for all changes made:

1. Any band-aid fixes? (Principle 1)
2. Used third-party API — did you check docs? (Principle 2)
3. Any `as any` / unnecessary `?.`? (Principle 3)
4. Any error-swallowing catch / failure path without feedback? (Principle 4)
5. Do new types/fields propagate through the full pipeline? (Principle 5)

### Phase 5 — Verification Loop

1. **Remove all `[DIAG]` logs** — `grep_search` for `[DIAG]` to confirm zero residuals
2. **Run quality pipeline** — `pnpm run quality` (typecheck + knip + lint + format + test)
3. **Related E2E spec passes** (if applicable) — `pnpm exec playwright test e2e/specs/<spec> --reporter=list`
4. **Confirm no regression** — All tests for affected modules pass

---

## Constraints

- **Static analysis preferred.** Do not add diagnostic logs for issues locatable via grep/read.
- **`console.*` forbidden.** Use `log.extend('DIAG')` + `[DIAG]` prefix for diagnostics.
- **Clean up after fix.** No `[DIAG]` logs may remain.
- **Don't change unrelated code.** Issues found during debugging that are "easy fixes" should be raised separately, not mixed into this fix.
- **Escalation.** Same approach fails 3 times → stop immediately and report status.
