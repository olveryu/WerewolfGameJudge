---
name: new-board
description: 'Add a new preset board to PRESET_TEMPLATES. Use when: adding a board, creating a template, new preset.'
argument-hint: 'Board name + role list (e.g., Wolf King Seer 4villagers 4wolves seer+witch+hunter+guard)'
---

# New Board Skill

> **输出语言：执行本 skill 过程中，所有面向用户的输出（进度报告、询问、完成通知、错误提示）一律使用中文。**

End-to-end addition of a preset board to `PRESET_TEMPLATES`, from collecting requirements to passing verification.

## When to Use

- User requests adding a new preset board (template)
- User describes a role configuration and wants it added as a preset

## Procedure

### Phase 1 — Collect Information

1. Extract known fields from user input.
2. Check for missing items against the table below, **proactively ask** for all missing required fields (do not guess):

| Required Field | Description                                                        | Example                         |
| -------------- | ------------------------------------------------------------------ | ------------------------------- |
| Board name     | Chinese name (typically 3-6 characters, no player count suffix)    | `狼王魔术师`                    |
| Category       | `TemplateCategory.Classic` / `Advanced` / `Special` / `ThirdParty` | `Advanced`                      |
| Role list      | Complete RoleId array (including duplicated villager/wolf)         | `['villager', 'villager', ...]` |

3. Verify all RoleIds are valid — use `grep_search` to confirm each RoleId exists in `specs.ts`.
4. **If the role list contains a role that doesn't exist in the project → execute `/new-role` skill first to add that role, then continue this skill.**

### Phase 2 — Verify Design

Perform the following checks on the role list:

| Check Item                 | Requirement                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| Player count               | 12 players; `getPlayerCount(roles)` calculates actual count (bottom card roles not counted)         |
| Faction balance            | Wolves typically 3-4, god faction typically 3-4, villagers fill remaining slots                     |
| No duplicate special roles | Except `villager` / `wolf`, each special role appears at most once                                  |
| Bottom cards               | `treasureMaster` needs 3 extra bottom cards, `thief` needs 2 (appended to roles, roles.length > 12) |
| Naming convention          | No player count suffix (count derived from roles), 3-6 Chinese characters                           |

**Output the change plan, wait for user confirmation before coding.**

### Phase 3 — Implementation (After User Confirmation)

#### Step 1 — Add PRESET_TEMPLATES Entry

**File**: `packages/game-engine/src/models/Template.ts`

Add at the end of the corresponding category block:

```typescript
{
  name: '板子名',
  category: TemplateCategory.Advanced, // Classic | Advanced | Special | ThirdParty
  roles: [
    'villager',
    'villager',
    'villager',
    'villager',
    'wolf',
    'wolf',
    'wolf',
    'roleId1',
    'seer',
    'witch',
    'hunter',
    'guard',
  ],
},
```

**Ordering convention**: Villagers first → wolves → special wolves → god faction → special roles → bottom cards (if any).

#### Step 2 — Update guideContent Count (If Needed)

**File**: `src/config/guideContent.ts`

Search `PRESET_TEMPLATES.length`; if the guide text has a hardcoded template count (e.g., `25 个预设板子`), update to the new number.

> Current implementation uses `${PRESET_TEMPLATES.length}` dynamic reference, so usually **no manual update needed**. Only change when the text has a hardcoded number.

### Phase 4 — Integration Test

Create an integration test under `src/services/__tests__/boards/`.

#### 4a. Create Integration Test File

**File**: `src/services/__tests__/boards/night1.<topic>.<role-feature>.12p.integration.test.ts`

Naming example: `night1.guard.blocks_wolfkill.12p.integration.test.ts`

```typescript
import type { RoleId } from '@werewolf/game-engine/models/roles';

import { cleanupGame, createGame, GameContext } from './gameFactory';
import { executeFullNight } from './stepByStepRunner';

const TEMPLATE_NAME = '板子名';

function createRoleAssignment(): Map<number, RoleId> {
  const map = new Map<number, RoleId>();
  // seat 0-3: villager, seat 4-6: wolf, seat 7+: special roles
  map.set(0, 'villager');
  // ...
  return map;
}

describe('Night-1: <topic description> (12p)', () => {
  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  it('<core scenario description>', () => {
    ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

    const result = executeFullNight(ctx, {
      wolf: 0,
      witch: { save: null, poison: null },
      seer: 4,
      // ...other role actions
    });

    expect(result.completed).toBe(true);
    // Assert currentNightResults / reveal / deaths
    expect(ctx.getGameState().currentNightResults?.xxx).toBe(yyy);
  });
});
```

**Must include** at least one topic-specific assertion (not purely deaths):
`currentNightResults?.xxx` / `seerReveal` / `psychicReveal` / `gargoyleReveal` / `actions?.xxx` etc.

#### 4b. Register in Boards Coverage Contract

**File**: `src/services/__tests__/boards/night1.boards.coverage.contract.test.ts`

1. Add the board name to `REQUIRED_12P_TEMPLATES` array
2. Add the corresponding regex to `TEMPLATE_TO_TEST_PATTERN`

```typescript
// REQUIRED_12P_TEMPLATES
'新板子名',

// TEMPLATE_TO_TEST_PATTERN
新板子名: /TEMPLATE_NAME\s*=\s*['"]新板子名['"]/,
```

### Phase 4.5 — Core Principles Self-Check

Run through the core principles checklist 🔍 for all changes made:

1. Any band-aid fixes? (Principle 1)
2. Used third-party API — did you check docs? (Principle 2)
3. Any `as any` / unnecessary `?.`? (Principle 3)
4. Any error-swallowing catch / failure path without feedback? (Principle 4)
5. Do new types/fields propagate through the full pipeline? (Principle 5)

### Phase 5 — Verify

1. **Run contract tests** to ensure data consistency:

   ```bash
   pnpm exec jest --testPathPattern="Template.contract" --no-coverage
   ```

   Contract tests automatically verify:
   - All RoleIds are valid
   - No duplicate special roles
   - numberOfPlayers matches getPlayerCount
   - actionOrder follows NightPlan order
   - Name has no player count suffix

2. **Run boards coverage contract** to ensure integration test is registered correctly:

   ```bash
   pnpm exec jest --testPathPattern="night1.boards.coverage.contract" --no-coverage
   ```

3. **Run nightPlanSchemas contract test** to ensure night plan is valid:

   ```bash
   pnpm exec jest --testPathPattern="nightPlanSchemas.contract" --no-coverage
   ```

4. **Full verification**:
   ```bash
   pnpm run quality
   ```
   For snapshot changes use `pnpm exec jest --updateSnapshot`.

### Phase 6 — E2E Test

If the board contains special role combinations or new roles, add a Playwright E2E spec covering the Night 1 flow.

1. Add or append to an appropriate `night-roles-*.spec.ts` file under `e2e/specs/`
2. Use `withSetup` + `BoardPickerPage.selectPreset('板子名')` to select the new board
3. Cover at least one core scenario (special role action + result assertion)
4. Run locally to confirm pass: `pnpm run e2e:core`

> If the board only contains roles already covered by E2E and has no new interactions, this step can be skipped (state the reason in wrap-up).

### Phase 7 — Wrap-up

- Confirm `pnpm run quality` passes
- **Add a strategy entry in `src/components/BoardStrategy/boardStrategyData.ts`** under `BOARD_STRATEGY` (key = `PresetTemplate.name`), including `difficulty`, `recommendLevel`, `tags`, `summary`, `goodStrategy`, `wolfStrategy` (add `thirdStrategy` if third-party faction present), `firstNight`, `pitfalls`, `meta`
- Update preset board count in `README.md` and `README.en.md` (e.g., "27 preset boards" → "28 preset boards")
- Update `docs/PRESET_BOARDS.md` preset boards reference doc (append to corresponding category table)
- Summarize changed file list
- Prompt user to commit: `feat(models): add <boardName> preset template`

---

## Category Selection Guide

| Category     | Applicable Scenario                               | Examples                              |
| ------------ | ------------------------------------------------- | ------------------------------------- |
| `Classic`    | Beginner/classic configurations                   | Seer+Witch+Hunter+Guard, Wolf+Beauty  |
| `Advanced`   | Contains advanced roles (gargoyle/nightmare/etc.) | Gargoyle+Gravekeeper, Nightmare+Guard |
| `Special`    | Special gameplay/unique mechanic combos           | PureWhite+Shadow, Masquerade          |
| `ThirdParty` | Contains third-party faction roles                | Piper, Shadow+Avenger                 |

---

## Role Index Reference (By Faction)

| Faction      | Available Roles                                                                                                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Villager     | `villager` (repeatable)                                                                                                                                                                                                |
| Wolf         | `wolf` (repeatable), `wolfQueen`, `wolfKing`, `darkWolfKing`, `wolfWitch`, `wolfRobot`, `bloodMoon`                                                                                                                    |
| God          | `seer`, `witch`, `hunter`, `guard`, `idiot`, `knight`, `witcher`, `mirrorSeer`, `drunkSeer`, `psychic`, `gargoyle`, `graveyardKeeper`, `silenceElder`, `votebanElder`, `pureWhite`, `spiritKnight`, `dancer`, `warden` |
| Utility      | `magician`, `nightmare`, `dreamcatcher`, `slacker`, `wildChild`, `avenger`, `shadow`, `masquerade`                                                                                                                     |
| Awakened     | `awakenedGargoyle`                                                                                                                                                                                                     |
| Third-party  | `piper`                                                                                                                                                                                                                |
| Bottom cards | `treasureMaster` (+3 bottom cards), `thief` (+2 bottom cards)                                                                                                                                                          |

> This index may change across versions. If unsure whether a RoleId exists, use `grep_search` to verify in `specs.ts`.

---

## Key Constraints

- Board name **must NOT** include player count suffix (count derived from `roles.length`)
- Except `villager` / `wolf`, **special roles must not repeat**
- `treasureMaster` requires 3 extra bottom card roles, `thief` requires 2
- All RoleIds must exist in `ROLE_SPECS`
