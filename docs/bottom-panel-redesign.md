# BottomActionPanel 重构方案：声明式三层布局

## 动机

当前 RoomScreen 底部按钮区存在三个问题：

1. **横排 pill 按钮过时** — 同一时刻 2-4 个同等视觉权重按钮横排，用户无明确操作焦点。
2. **按钮逻辑散落 JSX** — RoomScreen.tsx 内 ~110 行条件渲染 + HostControlButtons 组件各自判断显隐，无统一决策点。
3. **不符合品类惯例** — 狼人杀竞品（网易狼人杀/天天狼人杀/Werewolf Online）均采用"单 CTA 全宽 + 次级文字按钮"模式。

## 目标布局

每个阶段只突出 1 个全宽 primary CTA，次要操作降级为 secondary/ghost。

```
┌────────────────────────────────┐
│       信息/提示文字              │  ← actionMessage
│ ┌────────────────────────────┐ │
│ │     Primary CTA（全宽 lg）   │ │  ← 最重要操作
│ └────────────────────────────┘ │
│ ┌────────────────────────────┐ │
│ │     Secondary（全宽 md）     │ │  ← 可选替代操作
│ └────────────────────────────┘ │
│      ghost  ·  ghost  ·  ghost │  ← 低优先级操作
└────────────────────────────────┘
```

## 架构

```
bottomLayoutConfig.ts   声明式规则表 LAYOUT_RULES
        │
        ▼
resolveBottomLayout.ts  纯函数：匹配规则 + 合并 schema 按钮 → BottomLayout
        │
        ▼
useBottomLayout.ts      Hook：包装 resolveBottomLayout + buildBottomAction
        │
        ▼
BottomActionPanel.tsx   纯渲染：接收 BottomLayout，三区垂直布局
```

### 关注点分离

| 文件                     | 职责                                |
| ------------------------ | ----------------------------------- |
| `bottomLayoutConfig.ts`  | 什么阶段放什么按钮（声明式配置）    |
| `resolveBottomLayout.ts` | 规则匹配 + slot 物化（纯函数）      |
| `buildBottomAction.ts`   | schema 按钮的动态逻辑（已有，不改） |
| `BottomActionPanel.tsx`  | 怎么渲染三层布局（纯 UI）           |

## 类型定义

```ts
// ── 输出 ──

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
  intent?: ActionIntent; // schema 按钮
  action?: StaticButtonId; // 静态按钮
  testID?: string;
  disabled?: boolean;
  fireWhenDisabled?: boolean;
  /** ghost 按钮文字颜色覆盖（如 danger 色的"重新开始"） */
  textColor?: string;
}

// ── 规则表 ──

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

## 完整布局矩阵

### 非 Ongoing 阶段

| 阶段         | Host                                                                 | Player（有座位）                        | Spectator     |
| ------------ | -------------------------------------------------------------------- | --------------------------------------- | ------------- |
| **Unseated** | P: `房间配置`                                                        | P: `等待房主开始` (disabled)            | 不显示面板    |
| **Seated**   | P: `分配角色` · G: `房间配置`                                        | P: `等待房主开始` (disabled)            | 不显示面板    |
| **Assigned** | P: `查看身份` · G: `重新开始`(danger色)                              | P: `查看身份`                           | 不显示面板    |
| **Ready**    | P: `开始游戏` · G: `查看身份` `重新开始`(danger色)                   | P: `查看身份`                           | 不显示面板    |
| **Ended**    | P: `重新开始`(primary variant) · G: `查看身份` `详细信息` `昨夜信息` | P: `查看身份` · G: `详细信息`(如有权限) | P: `详细信息` |

> P = primary 层, S = secondary 层, G = ghost 层

### Ongoing 阶段 — 非 actioner

| 角色        | Host                                    | Player        | Spectator  |
| ----------- | --------------------------------------- | ------------- | ---------- |
| 非 actioner | P: `查看身份` · G: `重新开始`(danger色) | P: `查看身份` | 不显示面板 |

### Ongoing 阶段 — actioner（按 schema kind）

所有 actioner 场景的 ghost 行：Host 为 `查看身份 · 重新开始`，Player 为 `查看身份`。

#### wolfVote（狼人/狼美人/狼王/噩梦/血月/典狱长/狼巫/恶灵骑士）

| 状态   | Primary    | Secondary  |
| ------ | ---------- | ---------- |
| 投票前 | —          | `放弃袭击` |
| 投票后 | `取消投票` | `放弃袭击` |

#### chooseSeat — canSkip: true（预言家/守卫/毒师/禁言长老/禁票长老/乌鸦/摄梦人/噩梦/石像鬼/机械狼人/狼巫/狼美人/灯影预言家/酒鬼预言家/通灵师/纯白之女）

| Primary | Secondary  |
| ------- | ---------- |
| —       | `不用技能` |

#### chooseSeat — canSkip: false（混血儿/野孩子/影子/觉醒石像鬼）

无按钮（必须点座位）。

#### swap — 魔术师

| Primary | Secondary  |
| ------- | ---------- |
| —       | `不用技能` |

#### compound — 女巫

| 状态     | Primary       | Secondary  |
| -------- | ------------- | ---------- |
| 可救人   | `对N号用解药` | `不用技能` |
| 不可救人 | `不用技能`    | —          |

#### confirm — 猎人/狼王/复仇者

| Primary                 |
| ----------------------- |
| `发动状态` / `查看阵营` |

#### groupConfirm — 吹笛者催眠/觉醒石像鬼转化/丘比特情侣（全员）

| 状态   | Primary                              |
| ------ | ------------------------------------ |
| 未确认 | `催眠状态` / `转化状态` / `情侣状态` |
| 已确认 | 无按钮                               |

#### multiChooseSeat — 吹笛者催眠（canSkip: true）

| 状态   | Primary         | Secondary  |
| ------ | --------------- | ---------- |
| 未选人 | —               | `不用技能` |
| 已选人 | `确认催眠(N人)` | `不用技能` |

#### multiChooseSeat — 丘比特连接（canSkip: false）

| 状态      | Primary         |
| --------- | --------------- |
| 未选满    | —               |
| 选满 2 人 | `确认连接(2人)` |

#### chooseCard — 盗贼/盗宝大师

| Primary    |
| ---------- |
| `选择底牌` |

#### wolfRobotLearn 猎人门控 — 机械狼人

| Primary        |
| -------------- |
| `查看技能状态` |

#### UI Hint 封锁

| 类型                | Primary              |
| ------------------- | -------------------- |
| 技能被封锁          | `跳过（技能被封锁）` |
| 狼人被封锁/首夜毒师 | `放弃袭击（被封锁）` |

### Schema 按钮 tier 推导规则

tier 不在 game-engine spec 中声明，由 UI 层在 `resolveBottomLayout.materialize()` 中推导：

| 条件                                                    | Tier                             |
| ------------------------------------------------------- | -------------------------------- |
| 单按钮且 `key` 为 skip/wolfEmpty 类                     | secondary（主操作是点座位）      |
| 单按钮且 `key` 为 confirm/groupConfirmAck/chooseCard 类 | primary                          |
| 双按钮                                                  | 第一个 primary，第二个 secondary |
| hint override 单按钮                                    | primary                          |

## 变更文件清单

| 文件                                                       | 操作     | 内容                                                                               |
| ---------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| `src/screens/RoomScreen/hooks/bottomLayoutConfig.ts`       | **新增** | 类型定义 + `STATIC_BUTTONS` 映射表 + `LAYOUT_RULES` 规则表                         |
| `src/screens/RoomScreen/hooks/resolveBottomLayout.ts`      | **新增** | 纯函数：规则匹配 + slot 物化                                                       |
| `src/screens/RoomScreen/hooks/resolveBottomLayout.test.ts` | **新增** | 每个阶段×角色组合的 `it.each` 断言                                                 |
| `src/screens/RoomScreen/hooks/useBottomLayout.ts`          | **新增** | Hook 包装                                                                          |
| `src/screens/RoomScreen/hooks/bottomActionBuilder.ts`      | **不改** | 被 `resolveBottomLayout` 调用                                                      |
| `src/screens/RoomScreen/components/BottomActionPanel.tsx`  | **改**   | 接口改为 `layout: BottomLayout`，三区渲染                                          |
| `src/screens/RoomScreen/components/styles.ts`              | **改**   | `BottomActionPanelStyles` 加 `ghostRow`                                            |
| `src/screens/RoomScreen/components/statusPanels.styles.ts` | **改**   | `buttonRow` → `flexDirection: 'column'` + `alignItems: 'stretch'`；新增 `ghostRow` |
| `src/screens/RoomScreen/RoomScreen.tsx`                    | **改**   | 删 ~110 行按钮 JSX，改为 `useBottomLayout` + `layout={bottomLayout}`               |
| `src/screens/RoomScreen/components/HostControlButtons.tsx` | **删除** | 逻辑归入 `LAYOUT_RULES` + `STATIC_BUTTONS`                                         |

## E2E 影响

**无需修改。** E2E 通过 `[data-testid]` 和 `panel.getByText()` 定位按钮，改造不改 testID、按钮文字、容器层级。ghost 行仍在 `[data-testid="bottom-action-panel"]` 内部。

## Commit 计划

| #   | Message                                                          | 内容                               |
| --- | ---------------------------------------------------------------- | ---------------------------------- |
| 1   | `feat(room): add BottomLayout types and static button registry`  | 类型 + `STATIC_BUTTONS`            |
| 2   | `feat(room): add declarative LAYOUT_RULES config table`          | `bottomLayoutConfig.ts` 规则表     |
| 3   | `feat(room): add resolveBottomLayout pure function + tests`      | `resolveBottomLayout.ts` + 单测    |
| 4   | `feat(room): add useBottomLayout hook`                           | Hook 包装                          |
| 5   | `refactor(room): BottomActionPanel accepts BottomLayout`         | 改接口 + 三区渲染                  |
| 6   | `refactor(room): styles — vertical full-width + ghostRow`        | 样式改造                           |
| 7   | `refactor(room): replace inline button JSX with useBottomLayout` | RoomScreen.tsx 核心重构            |
| 8   | `refactor(room): delete HostControlButtons component`            | 删文件 + 清理 import               |
| 9   | `style(room): ended restart uses primary variant`                | Ended「重新开始」 danger → primary |
