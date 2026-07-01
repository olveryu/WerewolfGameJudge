> ⚠️ Historical document — refactoring completed, for reference only

# BottomActionPanel Refactoring: Declarative Three-Layer Layout

## Motivation

The current RoomScreen bottom button area has three problems:

1. **Horizontal pill buttons are outdated** — 2-4 buttons with equal visual weight displayed side by side at the same time; users have no clear action focus.
2. **Button logic scattered in JSX** — ~110 lines of conditional rendering in RoomScreen.tsx + HostControlButtons component each deciding visibility independently; no unified decision point.
3. **Doesn't follow genre conventions** — Werewolf competitors (NetEase Werewolf / Daily Werewolf / Werewolf Online) all use "single full-width CTA + secondary text buttons" pattern.

## Target Layout

Each phase highlights only 1 full-width primary CTA; secondary actions are demoted to secondary/ghost.

```
┌────────────────────────────────┐
│       Info/hint text            │  ← actionMessage
│ ┌────────────────────────────┐ │
│ │     Primary CTA (full-width lg) │ │  ← most important action
│ └────────────────────────────┘ │
│ ┌────────────────────────────┐ │
│ │     Secondary (full-width md)   │ │  ← optional alternative action
│ └────────────────────────────┘ │
│      ghost  ·  ghost  ·  ghost │  ← low-priority actions
└────────────────────────────────┘
```

## Architecture

```
bottomLayoutConfig.ts   Declarative rule table LAYOUT_RULES
        │
        ▼
resolveBottomLayout.ts  Pure function: match rules + merge schema buttons → BottomLayout
        │
        ▼
useBottomLayout.ts      Hook: wraps resolveBottomLayout + buildBottomAction
        │
        ▼
BottomActionPanel.tsx   Pure render: receives BottomLayout, three-zone vertical layout
```

### Separation of Concerns

| File                     | Responsibility                                       |
| ------------------------ | ---------------------------------------------------- |
| `bottomLayoutConfig.ts`  | What buttons go in what phase (declarative config)   |
| `resolveBottomLayout.ts` | Rule matching + slot materialization (pure function) |
| `buildBottomAction.ts`   | Schema button dynamic logic (existing, unchanged)    |
| `BottomActionPanel.tsx`  | How to render three-layer layout (pure UI)           |

## Type Definitions

```ts
// ── Output ──

interface BottomLayout {
  primary: ButtonConfig[];
  secondary: ButtonConfig[];
  ghost: ButtonConfig[];
}

interface ButtonConfig {
  key: string;
  label: string;
  variant: 'primary' | 'secondary' | 'ghost';
  size: 'lg' | 'md';
  intent?: ActionIntent; // schema button
  action?: StaticButtonId; // static button
  testID?: string;
  disabled?: boolean;
  fireWhenDisabled?: boolean;
  /** Ghost button text color override (e.g., danger color for "restart") */
  textColor?: string;
}

// ── Rule Table ──

interface LayoutRule {
  match: {
    status: GameStatus | GameStatus[];
    role: 'host' | 'player' | 'spectator';
    when?: (ctx: LayoutContext) => boolean;
  };
  layout: {
    primary: ButtonSlot[];
    secondary: ButtonSlot[];
    ghost: ButtonSlot[];
  };
}

type ButtonSlot =
  | { source: 'schema'; tier: 'primary' | 'secondary' }
  | { source: 'static'; button: StaticButtonId };

type StaticButtonId =
  | 'viewRole'
  | 'waitForHost'
  | 'settings'
  | 'prepareToFlip'
  | 'startGame'
  | 'restart'
  | 'lastNightInfo'
  | 'nightReview';
```

## Complete Layout Matrix

### Non-Ongoing Phases

| Phase        | Host                                                                 | Player (seated)                              | Spectator      |
| ------------ | -------------------------------------------------------------------- | -------------------------------------------- | -------------- |
| **Unseated** | P: `房间配置`                                                        | P: `等待房主开始` (disabled)                 | No panel shown |
| **Seated**   | P: `分配角色` · G: `房间配置`                                        | P: `等待房主开始` (disabled)                 | No panel shown |
| **Assigned** | P: `查看身份` · G: `重新开始`(danger color)                          | P: `查看身份`                                | No panel shown |
| **Ready**    | P: `开始游戏` · G: `查看身份` `重新开始`(danger color)               | P: `查看身份`                                | No panel shown |
| **Ended**    | P: `重新开始`(primary variant) · G: `查看身份` `详细信息` `昨夜信息` | P: `查看身份` · G: `详细信息`(if authorized) | P: `详细信息`  |

> P = primary layer, S = secondary layer, G = ghost layer

### Ongoing Phase — Non-actioner

| Role         | Host                                        | Player        | Spectator      |
| ------------ | ------------------------------------------- | ------------- | -------------- |
| Non-actioner | P: `查看身份` · G: `重新开始`(danger color) | P: `查看身份` | No panel shown |

### Ongoing Phase — Actioner (by schema kind)

All actioner scenarios ghost row: Host has `查看身份 · 重新开始`, Player has `查看身份`.

#### wolfVote (Wolf / Wolf Queen / Dark Wolf King / Nightmare / Blood Moon / Jailer / Wolf Witch / Evil Spirit Knight)

| State       | Primary    | Secondary  |
| ----------- | ---------- | ---------- |
| Before vote | —          | `放弃袭击` |
| After vote  | `取消投票` | `放弃袭击` |

#### chooseSeat — canSkip: true (Seer / Guard / Poisoner / Silence Elder / Voteban Elder / Crow / Dreamcatcher / Nightmare / Gargoyle / Wolf Robot / Wolf Witch / Wolf Queen / Mirror Seer / Drunk Seer / Psychic / Pure White)

| Primary | Secondary  |
| ------- | ---------- |
| —       | `不用技能` |

#### chooseSeat — canSkip: false (Half-blood / Wild Child / Shadow / Awakened Gargoyle)

No buttons (must tap a seat).

#### swap — Magician

| Primary | Secondary  |
| ------- | ---------- |
| —       | `不用技能` |

#### compound — Witch

| State       | Primary       | Secondary  |
| ----------- | ------------- | ---------- |
| Can save    | `对N号用解药` | `不用技能` |
| Cannot save | `不用技能`    | —          |

#### confirm — Hunter / Dark Wolf King / Avenger

| Primary                 |
| ----------------------- |
| `发动状态` / `查看阵营` |

#### groupConfirm — Piper hypnotize / Awakened Gargoyle convert / Cupid lovers (all players)

| State       | Primary                              |
| ----------- | ------------------------------------ |
| Unconfirmed | `催眠状态` / `转化状态` / `情侣状态` |
| Confirmed   | No buttons                           |

#### multiChooseSeat — Piper hypnotize (canSkip: true)

| State       | Primary         | Secondary  |
| ----------- | --------------- | ---------- |
| None chosen | —               | `不用技能` |
| Some chosen | `确认催眠(N人)` | `不用技能` |

#### multiChooseSeat — Cupid link (canSkip: false)

| State      | Primary         |
| ---------- | --------------- |
| Not full   | —               |
| 2 selected | `确认连接(2人)` |

#### chooseCard — Thief / Treasure Master

| Primary    |
| ---------- |
| `选择底牌` |

#### wolfRobotLearn Hunter gate — Wolf Robot

| Primary        |
| -------------- |
| `查看技能状态` |

#### UI Hint Blocking

| Type                            | Primary              |
| ------------------------------- | -------------------- |
| Skill blocked                   | `跳过（技能被封锁）` |
| Wolf blocked / Night-1 Poisoner | `放弃袭击（被封锁）` |

### Schema Button Tier Derivation Rules

Tier is not declared in game-engine spec; it's derived by the UI layer in `resolveBottomLayout.materialize()`:

| Condition                                                          | Tier                                         |
| ------------------------------------------------------------------ | -------------------------------------------- |
| Single button and `key` is skip/wolfEmpty type                     | secondary (primary action is tapping a seat) |
| Single button and `key` is confirm/groupConfirmAck/chooseCard type | primary                                      |
| Two buttons                                                        | First is primary, second is secondary        |
| Hint override single button                                        | primary                                      |

## File Change List

| File                                                       | Action        | Content                                                                                   |
| ---------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------- |
| `src/screens/RoomScreen/hooks/bottomLayoutConfig.ts`       | **New**       | Type definitions + `STATIC_BUTTONS` mapping + `LAYOUT_RULES` rule table                   |
| `src/screens/RoomScreen/hooks/resolveBottomLayout.ts`      | **New**       | Pure function: rule matching + slot materialization                                       |
| `src/screens/RoomScreen/hooks/resolveBottomLayout.test.ts` | **New**       | `it.each` assertions for each phase×role combination                                      |
| `src/screens/RoomScreen/hooks/useBottomLayout.ts`          | **New**       | Hook wrapper                                                                              |
| `src/screens/RoomScreen/hooks/bottomActionBuilder.ts`      | **No change** | Called by `resolveBottomLayout`                                                           |
| `src/components/room/RoomBottomActionPanel.tsx`            | **Modify**    | Interface changed to `layout: BottomLayout`, three-zone render                            |
| `src/screens/RoomScreen/components/styles.ts`              | **Modify**    | `BottomActionPanelStyles` add `ghostRow`                                                  |
| `src/components/room/roomStatusPanelStyles.ts`             | **Modify**    | `buttonRow` → `flexDirection: 'column'` + `alignItems: 'stretch'`; add `ghostRow`         |
| `src/screens/RoomScreen/RoomScreen.tsx`                    | **Modify**    | Remove ~110 lines of button JSX, replace with `useBottomLayout` + `layout={bottomLayout}` |
| `src/screens/RoomScreen/components/HostControlButtons.tsx` | **Delete**    | Logic merged into `LAYOUT_RULES` + `STATIC_BUTTONS`                                       |

## E2E Impact

**No changes needed.** E2E tests locate buttons via `[data-testid]` and `panel.getByText()`. The refactoring doesn't change testIDs, button text, or container hierarchy. Ghost row is still inside `[data-testid="bottom-action-panel"]`.

## Commit Plan

| #   | Message                                                          | Content                              |
| --- | ---------------------------------------------------------------- | ------------------------------------ |
| 1   | `feat(room): add BottomLayout types and static button registry`  | Types + `STATIC_BUTTONS`             |
| 2   | `feat(room): add declarative LAYOUT_RULES config table`          | `bottomLayoutConfig.ts` rule table   |
| 3   | `feat(room): add resolveBottomLayout pure function + tests`      | `resolveBottomLayout.ts` + tests     |
| 4   | `feat(room): add useBottomLayout hook`                           | Hook wrapper                         |
| 5   | `refactor(room): BottomActionPanel accepts BottomLayout`         | Interface change + three-zone render |
| 6   | `refactor(room): styles — vertical full-width + ghostRow`        | Style changes                        |
| 7   | `refactor(room): replace inline button JSX with useBottomLayout` | RoomScreen.tsx core refactoring      |
| 8   | `refactor(room): delete HostControlButtons component`            | Delete file + clean imports          |
