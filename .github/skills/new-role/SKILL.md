---
name: new-role
description: 'Add a new werewolf role end-to-end: spec, night step, resolver, audio, badge, config, tests. Use when: adding a role, creating a character, new role SOP.'
argument-hint: 'Role name + faction + skill summary (e.g., Fox, God faction, can check one player each night)'
---

# New Role Skill (V2 Architecture)

> **输出语言：执行本 skill 过程中，所有面向用户的输出（进度报告、询问、完成通知、错误提示）一律使用中文。**

Add a werewolf role end-to-end. In V2 architecture, all role declarations (abilities/effects/nightSteps/UI) are embedded in the ROLE_SPECS entry in `specs.ts`; there is no longer a separate `schemas.ts` or `nightSteps.ts`.

## When to Use

- User requests adding a new werewolf role
- User describes a new role's abilities and wants them implemented

---

## Procedure

### Phase 1 — Gather Information

1. Extract known fields from user input.
2. Check for missing items against the table below, **proactively ask** for all missing required fields (do not guess):

| Required Field           | Description                                                                                             | Example                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Role name                | Chinese name + camelCase id                                                                             | 隐狼 / `hiddenWolf`          |
| Faction                  | `Faction.God` / `Faction.Wolf` / `Faction.Villager` / `Faction.Special`                                 | `Faction.Wolf`               |
| team                     | `Team.Good` / `Team.Wolf` / `Team.Third` (determines seer check result)                                 | `Team.Good`                  |
| shortName                | Single-character abbreviation (globally unique)                                                         | `隐`                         |
| emoji                    | Role icon emoji                                                                                         | `👤🐺`                       |
| description              | Rule description (follow copywriting standards)                                                         | 与其他狼人互不相认；…        |
| structuredDescription    | Segmented description (passive/skill/special/restriction/trigger/winCondition)                          | See template                 |
| tags                     | Ability tags array                                                                                      | `['check']`                  |
| Night-1 action?          | `true` / `false`                                                                                        | `true`                       |
| Action type (actionKind) | `chooseSeat` / `confirm` / `compound` / `swap` / `wolfVote` / `multiChooseSeat` / `groupConfirm` / none | `confirm`                    |
| Constraints              | `[]` / `[TargetConstraint.NotSelf]` / `[TargetConstraint.NotWolfFaction]` etc.                          | `[TargetConstraint.NotSelf]` |
| Skippable?               | `true` / `false`                                                                                        | `true`                       |
| effects                  | `[{ kind: 'check', resultType: 'faction' }]` etc.                                                       | See effects quick reference  |
| Night action order       | Before/after which existing step (reference plan.ts NIGHT_STEP_ORDER_INTERNAL)                          | After wolfQueenCharm         |
| recognition (Wolf only)  | `{ canSeeWolves: bool, participatesInWolfVote: bool }`                                                  | `{ canSeeWolves: false, … }` |
| Special mechanism        | confirm pipeline / reveal / death calc / immunity / displayAs / none                                    | confirm pipeline             |

3. Use `grep_search` to verify `shortName` is globally unique.
4. Confirm description follows copywriting standards (see "description Copywriting Standards" section below).

> **NOTE**: Whether a role has a night action is determined by the `nightSteps` array (`hasNightAction()` is derived from `nightSteps.length > 0`).

### Phase 2 — Define Change Plan

Based on the Resolver Decision Table and conditional steps, determine:

- genericResolver or standalone resolver (refer to decision table)
- Which conditional steps are needed (C1-C10)
- List the complete file change inventory + change points per file

**Output the change plan, wait for user confirmation before coding.**

### Phase 3 — Implementation (After User Confirmation)

Implement step by step in SOP order.

#### Core Steps (Roles with night actions)

| #   | Step                                  | File                                                  |
| --- | ------------------------------------- | ----------------------------------------------------- |
| 1   | Add ROLE_SPECS entry                  | `packages/game-engine/src/models/roles/spec/specs.ts` |
| 2   | Insert into NIGHT_STEP_ORDER_INTERNAL | `packages/game-engine/src/models/roles/spec/plan.ts`  |
| 3   | Register Resolver                     | `packages/game-engine/src/resolvers/index.ts`         |
| 4   | Generate audio files                  | See "Step 4 — Audio Generation"                       |
| 5   | Register audio                        | `src/services/infra/audio/audioRegistry.ts`           |
| 6   | Add to ConfigScreen                   | `src/screens/ConfigScreen/configData.ts`              |
| 6b  | Role badge                            | See "Step 6b — Badge Generation"                      |

#### Roles without night actions

Only steps 1, 7-9.

#### Conditional steps (as needed)

Select C1-C10 based on the role's special mechanism (see "Conditional Steps Reference" section below).

### Phase 3.5 — Core Principles Self-Check

Go through each core principle 🔍 self-check for all changes in this session:

1. Any band-aid fixes? (Principle 1)
2. Did you check docs for any third-party API? (Principle 2)
3. Any `as any` / unnecessary `?.`? (Principle 3)
4. Any swallowed errors in catch / failure paths with no feedback? (Principle 4)
5. Do new types/fields flow through the full pipeline? (Principle 5)

### Phase 4 — Testing & Verification

| #   | Step                | Method                                                                                                   |
| --- | ------------------- | -------------------------------------------------------------------------------------------------------- |
| 7   | Integration test    | Create test based on role-specific logic (confirm → confirmContext.test.ts / check type → resolver test) |
| 8   | Contract test count | `roles.registry.contract.test.ts` + `v2Specs.contract.test.ts` role total +1                             |
| 9   | Full verification   | `pnpm run quality`; for snapshot changes use `pnpm exec jest --updateSnapshot`                           |

### Phase 5 — Wrap Up

- Confirm `pnpm run quality` passes completely
- Update role count, faction count, and role list in `README.md` and `README.en.md`
- Update step order table and role behavior matrix in `docs/NIGHT1_ROLE_ALIGNMENT_MATRIX.md`
- Confirm new role prompt appended to `docs/avatar-generation-prompts.md` (step 6b.10)
- Confirm `scripts/badge-config.mjs` EMOJI_MAP has new role mapping added (step 6b.5)
- Confirm `rewardCatalog.ts` HAND_DRAWN_AVATAR_IDS + AVATAR_RARITY added (step 6b.6-7)
- Confirm `avatarImages.ts` + `avatarImages.web.ts` registered (step 6b.8-9)
- **If a preset board was also added** (via new-board skill or directly), the following must also be done in sync:
  - Add strategy entry in `BOARD_STRATEGY` in `src/components/BoardStrategy/boardStrategyData.ts` (key = board name), including difficulty / recommendLevel / tags / summary / goodStrategy / wolfStrategy / thirdStrategy (if third-party) / firstNight / pitfalls / meta
  - Update preset board count in `README.md` and `README.en.md`
  - Update `docs/PRESET_BOARDS.md` preset board reference doc
- Summarize change file inventory
- Prompt user to commit (Conventional Commits: `feat(game-engine): add <roleName> role`)

---

## V2 Architecture Key Knowledge

### Single-file Definition

In V2, all declarations for each role are in a single entry in `specs.ts`:

```
ROLE_SPECS.<roleId> = {
  id, displayName, shortName, emoji,
  faction, team,
  description, structuredDescription,
  tags,
  recognition?,           // Wolf faction: { canSeeWolves, participatesInWolfVote }
  abilities[],            // Ability declarations (active/passive/triggered)
  nightSteps[],           // Night steps (stepId + displayName + audioKey + actionKind + ui)
  resources?,             // Resource limits (bullet/antidote/poison)
  immunities?,            // Immunity declarations
  deathCalcRole?,         // Death calculation role
  displayAs?,             // Disguised identity
  groups?,                // Role groups (seerFamily, etc.)
}
```

There is no separate `schemas.ts` or `nightSteps.ts`. Schema information is embedded in `nightSteps[].ui`, and night order is controlled by `NIGHT_STEP_ORDER_INTERNAL` in `plan.ts`.

### Type Auto-inference

- `RoleId` = `keyof typeof ROLE_SPECS` (new entries are included automatically)
- `SchemaId` = collected from all `ROLE_SPECS[*].nightSteps[*].stepId`

### abilities and effects

abilities declares the role's ability types and effects:

```typescript
abilities: [
  {
    type: 'active',              // 'active' | 'passive' | 'triggered'
    timing: 'night',             // 'night' | 'day'
    actionKind: 'chooseSeat',    // matches nightSteps[].actionKind
    target: {
      count: { min: 1, max: 1 },
      constraints: [TargetConstraint.NotSelf],
    },
    canSkip: true,
    effects: [{ kind: 'check', resultType: 'faction' }],
    activeOnNight1: true,
  },
],
```

### effects Quick Reference

| kind          | Parameters                                                 | Purpose                             | Reference Roles         |
| ------------- | ---------------------------------------------------------- | ----------------------------------- | ----------------------- |
| `writeSlot`   | `slot: string`                                             | Write night result slot             | guard, dreamcatcher     |
| `check`       | `resultType: 'faction' \| 'identity'`                      | Check faction/identity              | seer, psychic, gargoyle |
| `check`       | `resultType: 'faction', transformer: 'invert' \| 'random'` | Inverted/random check               | mirrorSeer, drunkSeer   |
| `charm`       | —                                                          | Charm link                          | wolfQueen               |
| `chooseIdol`  | —                                                          | Choose idol                         | slacker, wildChild      |
| `block`       | `disablesWolfKillOnWolfTarget?: bool`                      | Block skill                         | nightmare               |
| `learn`       | `gateTriggersOnRoles?: string[]`                           | Learn skill + identity              | wolfRobot               |
| `confirm`     | `confirmType: 'shoot' \| 'faction' \| ...`                 | Confirm type (see confirm pipeline) | hunter, avenger         |
| `swap`        | —                                                          | Swap seat numbers                   | magician                |
| `hypnotize`   | —                                                          | Hypnotize                           | piper                   |
| `groupReveal` | —                                                          | Group reveal                        | piper                   |
| `mimic`       | `pairedRole: string`                                       | Mimic                               | shadow                  |
| `convert`     | —                                                          | Convert faction                     | awakenedGargoyle        |
| `chooseCard`  | —                                                          | Choose bottom card                  | thief, treasureMaster   |

### nightSteps Structure

```typescript
nightSteps: [
  {
    stepId: 'seerCheck',         // globally unique, i.e. SchemaId
    displayName: '查验',         // UI display name
    audioKey: 'seer',            // audio key (default === roleId)
    actionKind: 'chooseSeat',    // matches abilities[].actionKind
    ui: {
      confirmTitle: '确认查验',
      prompt: '请选择要查验的玩家，如不使用请点击「不用技能」',
      confirmText: '查验此玩家？',
      revealTitlePrefix: '查验结果',
      revealResultFormat: 'factionCheck',  // 'factionCheck' | 'roleName'
      bottomActionText: '不用技能',
      // confirm-type extra fields:
      confirmStatusUi: { kind: 'shoot', statusDialogTitle: '…', canText: '…', cannotText: '…' },
    },
  },
],
```

---

## Resolver Decision Table

| Pattern                                       | genericResolver                                                            | Standalone Resolver                |
| --------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------- |
| chooseSeat + writeSlot                        | ✅ guard, dreamcatcher, silenceElder, votebanElder, wolfQueen, crow        |                                    |
| chooseSeat + check                            | ✅ seer family, psychic, gargoyle, pureWhite, wolfWitch                    |                                    |
| chooseIdol / confirm / block / learn          | ✅ slacker, wildChild, hunter, darkWolfKing, avenger, nightmare, wolfRobot |                                    |
| compound / wolfVote / swap                    |                                                                            | ✅ witch, wolf, magician           |
| Cross-role interaction / multi-target+cascade |                                                                            | ✅ shadow, piper, awakenedGargoyle |

**genericResolver path**: no new file needed. `createGenericResolver('roleId')` reads abilities from ROLE_SPECS → automatically dispatches to the corresponding effect processor (`processWriteSlot` / `processCheck` / `processConfirm`, etc.).

**Standalone resolver path**: create new file `packages/game-engine/src/resolvers/<newRole>.ts`.

---

## description Copywriting Standards

### General Rules

- **Sentence structure**: Semicolons (；) separate independent rule clauses
- **Length**: 15–80 characters; **no period at end of sentence**
- **Standard terminology**: 袭击 (not 猎杀/刀人), 出局 (not 死亡), 查验阵营/身份, 免疫, 首夜, Arabic numerals
- **Tone**: Objective third person, no self-referencing by role name (use 「自身」)
- **Punctuation**: Chinese full-width; comma separates list items, semicolon separates rules
- **No GM narration**: Do not write "睁眼" "闭眼" "请看手机" — those are for audio narration

### Fixed Pattern Quick Reference

```text
# Check faction type
每晚可查验一名玩家的阵营，获知其是好人还是狼人
# Check identity type
每晚可查验一名玩家的身份，获知其具体角色名称
# Choose target type
每晚可选择一名玩家进行[动作]，[效果描述]；[限制条件]
# Passive type
[触发条件]时[效果]；[限制条件]
# Elimination-triggered type
出局时可[动作]；仅[条件]时可发动
```

### Wolf Faction-specific Patterns

The following are standard phrases for Wolf faction roles. **Must be reused exactly — no rewording:**

| Semantics               | Standard Phrase                                                                     | Example Roles       |
| ----------------------- | ----------------------------------------------------------------------------------- | ------------------- |
| Not in wolf team        | `与其他狼人互不相认`                                                                | gargoyle, wolfRobot |
| Inherit attack          | `其他狼人全部出局后可主导袭击`                                                      | gargoyle, wolfRobot |
| No self-destruct        | `不能自爆`                                                                          | wolfRobot           |
| Seer checks as villager | `预言家查验为好人`                                                                  | avenger (team=Good) |
| No wolf vote            | Not written in description (implied by `recognition.participatesInWolfVote: false`) | —                   |

### structuredDescription Fields

Split description by semantics into the following keys (only write keys with content):

| key            | Semantics         | Example                                |
| -------------- | ----------------- | -------------------------------------- |
| `passive`      | Passive/status    | 与其他狼人互不相认；预言家查验为好人   |
| `skill`        | Active skill      | 首夜可获知狼同伴身份                   |
| `trigger`      | Triggered effect  | 出局时可开枪带走一名玩家               |
| `special`      | Special condition | 其他狼人全部出局后可主导袭击           |
| `restriction`  | Restriction       | 不能自爆                               |
| `winCondition` | Win condition     | 与榜样阵营共同胜利（third-party only） |

---

## Confirm Step Full Pipeline

When a new role uses `actionKind: 'confirm'`, the following full pipeline must be implemented:

### 1. Type Definitions

**`packages/game-engine/src/protocol/types.ts`** — Add ConfirmStatus variant:

```typescript
// existing: ShootConfirmStatus | FactionConfirmStatus
// add new variant to discriminated union:
export interface NewRoleConfirmStatus {
  readonly role: 'newRole';
  readonly someField: SomeType;
}
export type ConfirmStatus = ShootConfirmStatus | FactionConfirmStatus | NewRoleConfirmStatus;
```

**`packages/game-engine/src/models/roles/spec/schema.types.ts`** — Add ConfirmStatusUi variant:

```typescript
// existing: ShootConfirmUi | FactionConfirmUi
// add:
export interface NewRoleConfirmUi {
  readonly kind: 'newKind'; // discriminant tag
  readonly statusDialogTitle: string;
  readonly someUiField: string;
}
export type ConfirmStatusUi = ShootConfirmUi | FactionConfirmUi | NewRoleConfirmUi;
```

### 2. Server-side Computation (`confirmContext.ts`)

**File**: `packages/game-engine/src/engine/handlers/confirmContext.ts`

```typescript
// 1. Extend ConfirmRole type
type ConfirmRole = 'hunter' | 'darkWolfKing' | 'avenger' | 'newRole';

// 2. deriveConfirmStepRoleMap() auto-scans (no manual mapping needed)
//    traverses all ROLE_SPECS nightSteps looking for actionKind === 'confirm'

// 3. Add branch to computeConfirmStatus
function computeConfirmStatus(role: ConfirmRole, state: NonNullState): ConfirmStatus {
  if (role === 'avenger') return computeAvengerConfirmStatus(state);
  if (role === 'newRole') return computeNewRoleConfirmStatus(state);
  // Hunter / DarkWolfKing (default shoot)
  ...
}

// 4. Implement computation function
function computeNewRoleConfirmStatus(state: NonNullState): NewRoleConfirmStatus {
  // Pure function, computes confirmation info from state
  return { role: 'newRole', someField: computedValue };
}
```

**Pipeline trigger chain**: `stepTransitionHandler.handleAdvanceNight()` → detects nextStepId → `maybeCreateConfirmStatusAction(nextStepId, state)` → looks up `CONFIRM_STEP_ROLE[stepId]` → `computeConfirmStatus()` → returns `SET_CONFIRM_STATUS` action → reducer writes to `GameState.confirmStatus` → broadcast.

### 3. Client-side Display (`promptExecutor.ts`)

**File**: `src/screens/RoomScreen/executors/promptExecutor.ts`

Dispatch by `statusUi.kind` in `confirmTriggerExecutor`:

```typescript
if (statusUi.kind === 'newKind') {
  // Read server-computed data from confirmStatus
  const data = confirmStatus?.role === 'newRole' ? confirmStatus.someField : fallback;
  statusMessage = formatMessage(statusUi, data);
} else if (statusUi.kind === 'faction') {
  // ...existing avenger
} else {
  // ...existing shoot (hunter/darkWolfKing)
}
```

### 4. Resolver

Confirm-type resolver uses `createGenericResolver()`; its internal `processConfirm` is a no-op (confirm type produces no state changes; state was pre-computed by `confirmContext`).

### Existing Confirm Variant Reference

| Role         | confirmType | ConfirmStatus          | ConfirmStatusUi    | Display Content  |
| ------------ | ----------- | ---------------------- | ------------------ | ---------------- |
| hunter       | `'shoot'`   | `ShootConfirmStatus`   | `ShootConfirmUi`   | Can/cannot shoot |
| darkWolfKing | `'shoot'`   | `ShootConfirmStatus`   | `ShootConfirmUi`   | Can/cannot shoot |
| avenger      | `'faction'` | `FactionConfirmStatus` | `FactionConfirmUi` | Faction          |

---

## Code Templates

### ROLE_SPECS — chooseSeat type (most common)

```typescript
newRole: {
  id: 'newRole',
  displayName: '中文名',
  shortName: '字',
  emoji: '🎭',
  faction: Faction.God,
  team: Team.Good,
  description: '每晚可查验一名玩家的阵营，获知其是好人还是狼人',
  structuredDescription: {
    skill: '每晚可查验一名玩家的阵营，获知其是好人还是狼人',
  },
  tags: ['check'],
  abilities: [
    {
      type: 'active',
      timing: 'night',
      actionKind: 'chooseSeat',
      target: {
        count: { min: 1, max: 1 },
        constraints: [TargetConstraint.NotSelf],
      },
      canSkip: true,
      effects: [{ kind: 'check', resultType: 'faction' }],
      activeOnNight1: true,
    },
  ],
  nightSteps: [
    {
      stepId: 'newRoleCheck',
      displayName: '查验',
      audioKey: 'newRole',
      actionKind: 'chooseSeat',
      ui: {
        confirmTitle: '确认查验',
        prompt: '请选择要查验的玩家，如不使用请点击「不用技能」',
        confirmText: '查验此玩家？',
        revealTitlePrefix: '查验结果',
        revealResultFormat: 'factionCheck',
        bottomActionText: '不用技能',
      },
    },
  ],
},
```

### ROLE_SPECS — Stealth Wolf type (not in wolf team)

```typescript
newWolf: {
  id: 'newWolf',
  displayName: '中文名',
  shortName: '字',
  emoji: '👤🐺',
  faction: Faction.Wolf,
  team: Team.Good,  // or Team.Wolf, depending on seer check result
  description: '与其他狼人互不相认；[技能]；其他狼人全部出局后可主导袭击；不能自爆',
  structuredDescription: {
    passive: '与其他狼人互不相认；预言家查验为好人',
    skill: '[首夜/每晚]可[动作]',
    special: '其他狼人全部出局后可主导袭击',
    restriction: '不能自爆',
  },
  tags: ['confirm'],  // or ['check'] etc.
  recognition: { canSeeWolves: false, participatesInWolfVote: false },
  abilities: [...],
  nightSteps: [...],
},
```

### ROLE_SPECS — Regular Wolf type (in wolf team)

```typescript
newWolf: {
  id: 'newWolf',
  displayName: '中文名',
  shortName: '字',
  emoji: '👸🐺',
  faction: Faction.Wolf,
  team: Team.Wolf,
  description: '[技能描述]；不能自爆',
  structuredDescription: {
    skill: '[技能描述]',
    restriction: '不能自爆',
  },
  tags: ['control'],
  recognition: { canSeeWolves: true, participatesInWolfVote: true },
  abilities: [...],
  nightSteps: [...],
},
```

### ROLE_SPECS — confirm type

```typescript
newRole: {
  id: 'newRole',
  displayName: '中文名',
  shortName: '字',
  emoji: '🎭',
  faction: Faction.Wolf,
  team: Team.Good,
  description: '技能描述',
  structuredDescription: { ... },
  tags: ['confirm'],
  recognition: { canSeeWolves: false, participatesInWolfVote: false },
  abilities: [
    {
      type: 'active',
      timing: 'night',
      actionKind: 'confirm',
      canSkip: true,
      effects: [{ kind: 'confirm', confirmType: 'newConfirmType' }],
      activeOnNight1: true,
    },
  ],
  nightSteps: [
    {
      stepId: 'newRoleConfirm',
      displayName: '确认信息',
      audioKey: 'newRole',
      actionKind: 'confirm',
      ui: {
        confirmTitle: '确认行动',
        prompt: '请点击下方按钮查看信息',
        confirmText: '查看信息？',
        bottomActionText: '查看信息',
        confirmStatusUi: {
          kind: 'newKind',
          statusDialogTitle: '信息标题',
          // ...kind-specific UI fields
        },
      },
    },
  ],
},
```

### plan.ts — Step Order

**File**: `packages/game-engine/src/models/roles/spec/plan.ts`

```typescript
export const NIGHT_STEP_ORDER_INTERNAL = [
  // === First actions (magician/slacker/wildChild/shadow/avenger) ===
  'magicianSwap',
  'slackerChooseIdol',
  'wildChildChooseIdol',
  'shadowChooseMimic',
  'avengerConfirm',

  // === Eclipse Wolf Queen exile ===
  'eclipseWolfQueenShelter',

  // === Guard/check type (before attack) ===
  'nightmareBlock',
  'dreamcatcherDream',
  'guardProtect',
  'silenceElderSilence',
  'votebanElderBan',
  'crowCurse',

  // === Wolf meeting phase ===
  'wolfKill',
  'wolfQueenCharm',
  // ← Insert stealth wolf confirm steps here (e.g., hiddenWolfReveal)

  // === Witch / Poisoner ===
  'witchAction',
  'poisonerPoison',

  // === Confirm type (hunter/darkWolfKing shoot status) ===
  'hunterConfirm',
  'darkWolfKingConfirm',

  // === Check type (last four + gargoyle, etc.) ===
  'wolfRobotLearn',
  'seerCheck',
  'mirrorSeerCheck',
  'drunkSeerCheck',
  'wolfWitchCheck',
  'gargoyleCheck',
  'pureWhiteCheck',
  'psychicCheck',

  // === Awakened Gargoyle convert ===
  'awakenedGargoyleConvert',

  // === Piper ===
  'piperHypnotize',
  'piperHypnotizedReveal',

  // === Awakened Gargoyle convert reveal ===
  'awakenedGargoyleConvertReveal',
] as const;
```

Insert the new stepId at the appropriate position.

### Resolver Registration

**File**: `packages/game-engine/src/resolvers/index.ts`

```typescript
// Generic resolver (most roles)
newRoleAction: createGenericResolver('newRole'),

// or with abilityIndex (non-first ability for multi-ability roles)
newRoleSecond: createGenericResolver('newRole', 1),
```

### Standalone Resolver

**New file**: `packages/game-engine/src/resolvers/<newRole>.ts`

```typescript
/**
 * NewRole Resolver — [Role name] action validation + result computation
 *
 * Pure function, no IO.
 */

import type { ResolverFn } from './types';

export const newRoleActionResolver: ResolverFn = (context, input) => {
  const target = input.target ?? input.targets?.[0] ?? null;

  if (target === null || target === undefined) {
    return { valid: true, result: {} };
  }

  if (!context.players.has(target)) {
    return { valid: false, rejectReason: 'TARGET_NOT_FOUND' };
  }

  // Role-specific logic...

  return {
    valid: true,
    result: {
      /* ... */
    },
  };
};
```

### Step 4 — Audio Generation

**Naming**: camelCase roleId → snake_case (`wolfQueen` → `wolf_queen`)

1. Add narration text in `scripts/generate_audio_edge_tts.py`:
   - `BEGIN_TEXT["<snake_case>"]` — `"XX请睁眼，请[行动描述]。"`
   - `END_TEXT["<snake_case>"]` — `"XX请闭眼。"`
2. **Auto-execute** generation command (requires `.venv` activated):
   ```bash
   python3 scripts/generate_audio_edge_tts.py --only <snake_case_key>
   ```
3. Confirm `assets/audio/<snake_case>.mp3` and `assets/audio_end/<snake_case>.mp3` were generated.

**Default params**: voice=`zh-CN-YunjianNeural` / pitch=`-20Hz` / rate=`-20%` / volume=`+100%` / boost=`10dB`

### Register Audio

**File**: `src/services/infra/audio/audioRegistry.ts`

```typescript
newRole: {
  begin: require('../../../../assets/audio/new_role.mp3'),
  end: require('../../../../assets/audio_end/new_role.mp3'),
},
```

Multi-step role's second step is registered in `STEP_AUDIO`. Lookup chain: `AUDIO_REGISTRY[roleId]` → `SEER_LABEL_AUDIO` → `STEP_AUDIO[audioKey]`.

### Step 6b — Role Badge Generation

**Method A**: User provides ready PNG → skip to "Placement & Registration".

**Method B**: AI image generation.

**Tool**: Doubao AI image generation (or any other AI tool supporting transparent background)

**Settings**: 1:1 square / 24-30 steps / CFG 8-10 / DPM++ 2M Karras / no template

**Prompt** = Universal prefix + role feature description (30-80 characters)

Universal prefix (shared by all roles):

```
狼人杀官方卡牌插画，蒂姆·波顿式暗黑怪诞童话风格，美式复古手绘插画，铅笔手绘松弛线条，水彩晕染上色，做旧粗糙纸张纹理，画面带细腻颗粒噪点，夸张变形的人物造型，长脸尖下巴，戏剧化的五官与肢体动作，粗粝手绘排线做阴影，暗黑诡异又诙谐的氛围感，高清细节，手绘质感拉满，PNG格式透明背景，alpha通道透明，纯透明无背景，无任何底色、场景、环境元素，背景完全空白透明，1:1正方形画幅，居中构图，半身像紧凑裁切，单个人物主体占画面80%，所有人物尺寸比例统一。
```

Negative Prompt (shared by all roles):

```
文字、水印、logo、签名、多余边框、画框、相框、模糊、低画质、低分辨率、变形、比例失调、五官扭曲、多余肢体、缺手指、多手指、Q版、萌系、二次元动漫、真实照片、3D渲染、平滑数字绘画、赛璐珞上色、霓虹色、赛博朋克、高饱和荧光色、任何背景、底色、纯色背景、渐变背景、纸张背景、场景背景、环境背景、纹理背景、白色背景、黑色背景、带背景的画面、画面杂色、主体边缘白边、干净光滑的画面、无纹理、矢量图、线条僵硬、画面过曝、画面过暗、元素堆砌
```

Write a 30-80 character role description and append it after the universal prefix. See existing role prompts in `docs/avatar-generation-prompts.md`.

**Placement & Registration**:

1. Save original image to `assets/avatars/raw/<roleId>.png` (transparent background RGBA PNG)
2. Run `python3 scripts/process_avatars.py` to auto-generate:
   - `assets/badges/png/512/role_<roleId>.png` (512px badge)
   - `assets/avatars/web/<roleId>.webp` (512px WebP avatar)
   - `assets/badges/web/role_<roleId>.webp` (128px WebP badge thumbnail)
3. `src/utils/roleBadges.ts` → `BADGE_MAP`: add native badge import
4. `src/utils/roleBadges.web.ts` → `BADGE_MAP`: add web badge import
5. `scripts/badge-config.mjs` → `EMOJI_MAP`: add `roleId: [folderName, fileName, hasSkinTone]` mapping (Fluent Emoji 3D assets)
6. `packages/game-engine/src/growth/rewardCatalog.ts` → `HAND_DRAWN_AVATAR_IDS`: insert roleId in alphabetical order
7. `packages/game-engine/src/growth/rewardCatalog.ts` → `AVATAR_RARITY`: insert in rarity block (`legendary` / `epic`)
8. `src/utils/avatarImages.ts` → add raw PNG import + badge PNG thumbnail import + `AVATAR_IMAGE_MAP` + `AVATAR_THUMB_MAP` entries
9. `src/utils/avatarImages.web.ts` → add WebP avatar import + WebP badge thumbnail import + `AVATAR_IMAGE_MAP` + `AVATAR_THUMB_MAP` entries
10. Append generated prompt to `docs/avatar-generation-prompts.md` (continue numbering, insert by faction block)

---

## Conditional Steps Reference

| Conditional Step       | When to Use                               | Key Files                                                         | Notes                                                           |
| ---------------------- | ----------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| C1 Reveal              | Check type                                | `schema.types.ts` RevealKind + resolver `result: { checkResult }` | Use `resolveRoleForChecks()`                                    |
| C2 Death Calculation   | Guard/chain-death/immunity                | `deathCalcRole` field + DeathCalculator                           | Add `deathCalcRole` to spec                                     |
| C3 Confirm Pipeline    | Confirm type                              | See "Confirm Step Full Pipeline" section                          | protocol types + schema.types + confirmContext + promptExecutor |
| C4 New GameState Field | Need to store new info in GameState       | `protocol/types.ts` + `normalize.ts`                              | Compile guard                                                   |
| C5 Preset Template     | Preset board containing new role          | `packages/game-engine/src/models/templates/presetTemplates.ts`    | Use new-board skill                                             |
| C6 E2E                 | By behavior category                      | `e2e/specs/night-roles-*.spec.ts`                                 | Use new-e2e-spec skill                                          |
| C7 multiChooseSeat     | Multi-target selection                    | abilities `target.count.max > 1` + resolver reads `input.targets` |                                                                 |
| C8 groupConfirm        | Group reveal                              | Second `nightStep` + `STEP_AUDIO` registration                    |                                                                 |
| C9 Multi-step          | Same role has multiple nightSteps entries | Each step needs its own resolver + audio                          | Second step `audioKey` typically !== roleId                     |
| C10 Immunity           | Immune to wolf attack/poison/etc.         | `immunities: [{ kind: 'wolfAttack' }]` + DeathCalculator          |                                                                 |

---

## Reference Role Index

| Action Type           | Reference Roles                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `chooseSeat` (check)  | seer, mirrorSeer, drunkSeer, psychic, gargoyle, pureWhite, wolfWitch                                             |
| `chooseSeat` (effect) | guard, nightmare, dreamcatcher, wolfQueen, silenceElder, votebanElder, crow                                      |
| `chooseSeat` (learn)  | wolfRobot                                                                                                        |
| `chooseSeat` (choose) | slacker, wildChild, shadow                                                                                       |
| `confirm` (shoot)     | hunter, darkWolfKing                                                                                             |
| `confirm` (faction)   | avenger                                                                                                          |
| `compound`            | witch                                                                                                            |
| `swap`                | magician                                                                                                         |
| `wolfVote`            | wolf                                                                                                             |
| `multiChooseSeat`     | piper, cupid                                                                                                     |
| `groupConfirm`        | piper (2nd step), cupid (2nd step), awakenedGargoyle (2nd step)                                                  |
| `chooseCard`          | thief, treasureMaster                                                                                            |
| No night action       | villager, idiot, knight, witcher, wolfKing, bloodMoon, spiritKnight, graveyardKeeper, dancer, masquerade, warden |

---

## Key Constraints

Violating any of the following will cause contract test failures (must check each one):

- `nightSteps[*].stepId` globally unique (i.e. SchemaId)
- `nightSteps[*].audioKey` defaults to **===** `roleId` (exception: non-first step in multi-step roles)
- `nightSteps[*].actionKind` **===** corresponding `abilities[*].actionKind`
- For roles with `nightSteps`, `stepId` **must** appear in `NIGHT_STEP_ORDER_INTERNAL` in `plan.ts`
- Resolver **must** be registered in the `RESOLVERS` registry in `resolvers/index.ts`
- New `GameState` fields must be synced to `normalizeState`
- `shortName` globally unique (single character)
- `bottomActionText` ≤ 4 Chinese characters
- `AUDIO_REGISTRY` must cover all unique `audioKey` values in nightSteps
- `TargetConstraint` use enum references, not strings
- Wolf faction roles **must** have a `recognition` field
- `confirm`-type roles: `abilities[].effects[].confirmType` must semantically correspond to `nightSteps[].ui.confirmStatusUi.kind`

## Quality Checklist

Confirm each item after implementation:

- [ ] ROLE_SPECS entry is complete (id/displayName/shortName/emoji/faction/team/description/structuredDescription/tags/abilities/nightSteps)
- [ ] description follows copywriting standards (unified terminology, no GM narration, no period)
- [ ] structuredDescription is correctly categorized by semantics
- [ ] abilities effects kind correct, constraints correct
- [ ] nightSteps ui fields complete, confirmStatusUi (if confirm type) correct
- [ ] plan.ts step order correct
- [ ] Resolver registered in resolvers/index.ts
- [ ] confirm pipeline implemented end-to-end (if applicable): protocol types + schema.types + confirmContext + promptExecutor
- [ ] Audio generated + registered in AUDIO_REGISTRY
- [ ] ConfigScreen group added
- [ ] Contract test counts updated
- [ ] `README.md` + `README.en.md` role count/faction count/role list updated
- [ ] `docs/NIGHT1_ROLE_ALIGNMENT_MATRIX.md` step order table + role behavior matrix updated
- [ ] `pnpm run quality` passes completely
