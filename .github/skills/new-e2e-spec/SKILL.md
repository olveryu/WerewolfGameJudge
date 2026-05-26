---
name: new-e2e-spec
description: 'Add a new Playwright E2E spec for a night role, flow, or feature. Use when: adding an e2e test, new playwright spec.'
argument-hint: 'Test target description (e.g., guard protection prevents death, 6-player magician swap)'
---

# New E2E Spec Skill

End-to-end addition of a Playwright E2E test, from defining the test target to local pass.

## When to Use

- User requests adding a new E2E test
- User describes a game flow scenario that needs verification

## Architecture Overview

```
e2e/
├── fixtures/app.fixture.ts    ← test.extend + createPlayerContexts + closeAll
├── pages/                     ← Page Objects (class-based)
│   ├── HomePage.ts
│   ├── RoomPage.ts
│   ├── ConfigPage.ts
│   ├── NightFlowPage.ts
│   └── BoardPickerPage.ts
├── helpers/
│   ├── night-setup.ts         ← withSetup() harness (creates game, runs body, cleans up)
│   ├── night-driver.ts        ← Role-aware night actions (click seat, wolf vote, reveals)
│   ├── multi-player.ts        ← setupNPlayerGame / setupNPlayerGameWithRoles
│   ├── waits.ts               ← ensureConnected, waitForRoomScreenReady
│   ├── home.ts                ← ensureAnonLogin, registerAutoDismissers
│   ├── ui.ts                  ← gotoWithRetry, clickIfVisible, screenshotOnFail
│   └── diagnostics.ts         ← DiagnosticData logger per player
└── specs/                     ← Test files (grouped by topic)
```

## Procedure

### Phase 1 — Define Test Target

1. Extract the test scenario from user input.
2. Determine the following:

| Field           | Description                       | Example                   |
| --------------- | --------------------------------- | ------------------------- |
| Test category   | night-role / flow / feature       | night-role                |
| Involved roles  | Which roles participate           | seer, wolf, villager      |
| Player count    | Minimum players to cover scenario | 3                         |
| Expected result | What to assert                    | reveal shows "好人"       |
| Spec filename   | Which file to add to or create    | night-roles-check.spec.ts |

3. Check existing specs for similar tests (avoid duplication).

### Phase 2 — Choose Test Pattern

**Night-role tests (most common)**: Use `withSetup` + `night-driver`.

```typescript
import { expect, test } from '@playwright/test';
import { /* helpers */ } from '../helpers/night-driver';
import { withSetup } from '../helpers/night-setup';

test('description', async ({ browser }) => {
  await withSetup(
    browser,
    {
      playerCount: N,
      configure: async (c) => c.configureCustomTemplate({ wolves: M, gods: [...], villagers: K }),
    },
    async ({ pages, roleMap }) => {
      // Drive night actions + assert results
    },
  );
});
```

**Non-night tests (room lifecycle, config, etc.)**: Use `app` fixture.

```typescript
import { test } from '../fixtures/app.fixture';

test('description', async ({ app: { page, diag } }) => {
  // Already logged in and on home screen
});
```

### Phase 3 — Implementation

#### Key Rules (see tests.instructions.md)

- **Forbidden** `page.waitForTimeout(N)` (only exception: ≤300ms inside polling loops)
- **Forbidden** `.isVisible({ timeout: N })` (Playwright ignores this param)
- **Forbidden** `console.log` (use `test.step()` + `testInfo.attach()`)
- Each spec creates an independent room (test isolation)
- Timeout setting: night tests recommend `test.setTimeout(180_000)`
- Use `ensureConnected(page)` to ensure WebSocket connection is stable
- Use `waitForRoomScreenReady(page)` to wait for room to load

#### night-driver Common Helpers

| Helper                                      | Purpose                      |
| ------------------------------------------- | ---------------------------- |
| `findRolePageIndex(map, name)`              | Find page index by role name |
| `findAllRolePageIndices(map, name)`         | Find all pages for a role    |
| `waitForRoleTurn(page, keywords, allPages)` | Wait for role's action turn  |
| `clickSeatAndConfirm(page, seat)`           | Click seat + confirm         |
| `driveWolfVote(pages, wolfIndices, seat)`   | Wolf vote                    |
| `waitForNightEnd(pages)`                    | Wait for dawn                |
| `readAlertText(page)`                       | Read alert dialog text       |
| `dismissAlert(page)`                        | Dismiss alert dialog         |
| `viewLastNightInfo(page)`                   | View last night info         |
| `clickBottomButton(page, text)`             | Click bottom button          |

#### ⚠️ Night Step Order (NIGHT_STEPS)

**Roles MUST be driven in the order defined by `NIGHT_STEP_ORDER_INTERNAL` in `packages/game-engine/src/models/roles/spec/plan.ts`.**
`waitForRoleTurn` calls `tryClickAdvanceButton(includeSkip=true)` to advance OTHER pages; wrong order will cause the target role to be auto-skipped.

Check order: `grep -n '' packages/game-engine/src/models/roles/spec/plan.ts`

Common order reference (position):

- `crowCurse` (15) → `wolfKill` (16) → `hiddenWolfReveal` (18) → `seerCheck` (24)
- `guardProtect` (14) → `wolfKill` (16) → `witchSave/witchPoison` (20/21)

#### ⚠️ actionKind Driving Patterns (Critical!)

Different `actionKind` steps have different UI flows. You must drive each according to its pattern:

**`chooseSeat` steps** (seer, crow, wolf, etc. choosing targets):

```typescript
// 1. waitForRoleTurn detects keywords
const turn = await waitForRoleTurn(page, ['查验', '选择'], allPages, 120);
// 2. clickSeatAndConfirm internally dismisses alert then clicks seat
await clickSeatAndConfirm(page, targetSeat);
// 3. Read result alert (if any)
const reveal = await readAlertText(page);
await dismissAlert(page);
```

Reference: `night-roles-check.spec.ts`

**`chooseSeat` + skip (not using ability)**:

```typescript
const turn = await waitForRoleTurn(page, ['诅咒', '选择'], allPages, 120);
// Must dismiss the initial prompt alert first!
await dismissAlert(page);
await clickBottomButton(page, '不用技能');
// Some roles show a confirmation after skip
await dismissAlert(page);
```

Reference: `night-roles-block.spec.ts` seer/guard skip test

**`confirm` steps** (hiddenWolf viewing companions, avenger viewing faction, etc.):

```typescript
const turn = await waitForRoleTurn(page, ['查看', '同伴'], allPages, 120);
// 1. Dismiss initial prompt alert (promptExecutor's showRoleActionPrompt)
await dismissAlert(page);
// 2. Click bottom button to trigger the actual action
await clickBottomButton(page, '查看同伴');
// 3. Read result alert
const reveal = await readAlertText(page);
await dismissAlert(page);
```

Reference: `night-roles-hidden-wolf-crow.spec.ts`, `night-roles-kill.spec.ts` (avenger)

**wolf kill** (dedicated helper):

```typescript
const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, ['袭击', '选择'], allPages, 120);
await driveWolfVote(pages, wolfIndices, targetSeat);
```

#### ConfigPage Template Configuration

```typescript
configure: async (c) =>
  c.configureCustomTemplate({
    wolves: 1,
    goodRoles: ['seer', 'witch'],
    villagers: 2,
    // wolfRoles: ['hiddenWolf']      // Wolf faction special roles
    // specialRoles: ['thief']        // Third-party roles
  });
```

### Phase 3.5 — Core Principles Self-Check

Run through the core principles checklist 🔍 for all changes made:

1. Any band-aid fixes? (Principle 1)
2. Used third-party API — did you check docs? (Principle 2)
3. Any `as any` / unnecessary `?.`? (Principle 3)
4. Any error-swallowing catch / failure path without feedback? (Principle 4)
5. Do new types/fields propagate through the full pipeline? (Principle 5)

### Phase 4 — Verify

1. Run single spec: `pnpm exec playwright test e2e/specs/<file> --reporter=list`
2. Confirm pass, then check if test timeout needs adjusting
3. On failure, use trace (auto-saved in `test-results/`) to diagnose

## Naming Conventions

- Night-role spec filenames: `night-roles-<category>.spec.ts`
  - Categories: check / kill / protect / block / treasure / thief-cupid / piper / gargoyle / eclipse-wolf-queen / hidden-wolf-crow
- Non-night specs: `<feature>.spec.ts` (e.g., `seating.spec.ts`, `reconnect.spec.ts`)
- Test describe/test names use English, describing specific scenario and expected result

## ⚠️ Common Pitfalls (Must Read)

### 1. Step order causing roles to be auto-skipped

`waitForRoleTurn` calls `tryClickAdvanceButton(includeSkip=true)` for OTHER pages, which clicks "不用技能". If you drive a later role first, earlier roles will be auto-skipped during the wait.

❌ Wrong (crow acts before wolf, driving wolf first causes crow to be skipped):

```typescript
await waitForRoleTurn(wolfPage, ['袭击'], pages);
await driveWolfVote(...);
await waitForRoleTurn(crowPage, ['诅咒'], pages); // Never detected: already auto-skipped
```

✅ Correct:

```typescript
await waitForRoleTurn(crowPage, ['诅咒'], pages);
await clickSeatAndConfirm(crowPage, target);
await waitForRoleTurn(wolfPage, ['袭击'], pages);
await driveWolfVote(...);
```

### 2. Initial alert for chooseSeat/confirm steps

All `chooseSeat` and `confirm` steps show a prompt alert on entry ("知道了" button).

- `clickSeatAndConfirm` handles this internally (auto dismissAlert).
- `clickBottomButton` does **NOT** auto dismiss (only dismisses during retry).
- Therefore you must manually `await dismissAlert(page)` before `clickBottomButton`.

### 3. Seat number format

- `roleMap.get(idx)!.seat` — 0-based seat index
- Seer and similar roles' reveal dialog uses 1-indexed display (`formatSeat(seat)` = `${seat+1}号`)
