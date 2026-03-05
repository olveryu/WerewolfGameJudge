# Code Review 变更计划

> **分支**: `feature/optimize_1`
> **影响范围**: game-engine (handlers/reducer/state) + client services/screens
> **风险**: 低 — 均为类型安全加固、DRY 提取、防御性校验，无功能行为变更

---

## Commit 计划

| Commit                                                                | 范围           | 包含变更            |
| --------------------------------------------------------------------- | -------------- | ------------------- |
| **C1** `fix(game-engine): type-safety & DRY improvements`             | game-engine    | #1, #4, #5          |
| **C2** `fix(facade): useFocusEffect + remove listener tracking`       | facade + hooks | #2, #13             |
| **C3** `fix(services): defensive validation & naming`                 | services       | #3, #6, #7, #8, #10 |
| **C4** `fix(theme): replace hardcoded rgba with shadow token`         | theme + styles | #9                  |
| **C5** `test(resolvers): add coverage contract test`                  | test           | #11                 |
| **C6** `refactor(game-engine): extract player iteration helpers`      | game-engine    | #12                 |
| **C7** `refactor(facade): extract reconnection manager`               | facade         | #14                 |
| **C8** `refactor(screens): split ConfigScreen state + helpers`        | screens        | #15                 |
| **C9** `refactor(screens): extract actionIntentHandlers`              | screens        | #16                 |
| **C10** `refactor(screens): extract bottomActionBuilder`              | screens        | #17                 |
| **C11** `refactor(screens): extract countdown + speaking-order hooks` | screens        | #18                 |

---

## 变更总览

| #   | 优先级 | Finding                                                     | 文件                                      | 变更类型    | Commit |
| --- | ------ | ----------------------------------------------------------- | ----------------------------------------- | ----------- | ------ |
| 1   | P0     | handleRestartGame 缺 `satisfies Complete<GameState>`        | `normalize.ts` + `gameReducer.ts`         | 类型安全    | C1     |
| 2   | P0     | `useFocusEffect` + 移除 facade listener 追踪                | `useGameRoom.ts` + `GameFacade.ts` + test | 社区标准    | C2     |
| 3   | P0     | `callApiOnce` 200+text/html 场景未拦截                      | `apiUtils.ts`                             | Bug fix     | C3     |
| 4   | P1     | `STANDARD_SIDE_EFFECTS` 共享可变数组                        | `handlers/types.ts`                       | 防御性加固  | C1     |
| 5   | P1     | `NonNullState` 重复定义 4 处                                | `handlers/types.ts` + 4 handler 文件      | DRY         | C1     |
| 6   | P1     | SettingsService 缺 boolean 字段校验                         | `SettingsService.ts`                      | 防御性加固  | C3     |
| 7   | P1     | `_userId` 命名有误导                                        | `RealtimeService.ts`                      | 命名修正    | C3     |
| 8   | P1     | `playNightBeginAudio` 重复实现                              | `AudioService.ts`                         | DRY         | C3     |
| 9   | P2     | hardcoded rgba in styles.ts                                 | `styles.ts` + `tokens.ts`                 | Theme token | C4     |
| 10  | P2     | `x-region` 硬编码魔法值                                     | `apiUtils.ts`                             | 命名常量    | C3     |
| 11  | P1     | Resolver 覆盖率合约测试                                     | 新文件                                    | 测试        | C5     |
| 12  | P1     | `Object.entries(state.players)` 重复 10 处，替换 7 处       | game-engine 8 文件                        | DRY         | C6     |
| 13  | P1     | `getListenerCount` 硬编码 `-1`                              | `GameFacade.ts`                           | 防御性加固  | C2     |
| 14  | P2     | GameFacade 925 行 → 拆分 reconnection manager               | `GameFacade.ts` → 新文件                  | SRP 拆分    | C7     |
| 15  | P2     | ConfigScreen 877 行 → 拆分 state + helpers                  | `ConfigScreen.tsx` → 新文件               | SRP 拆分    | C8     |
| 16  | P2     | useActionOrchestrator 818 行 → 提取 intent handlers         | `useActionOrchestrator.ts` → 新文件       | SRP 拆分    | C9     |
| 17  | P2     | useRoomActions 771 行 → 提取 bottom action builder          | `useRoomActions.ts` → 新文件              | SRP 拆分    | C10    |
| 18  | P2     | useRoomScreenState 877 行 → 提取 countdown + speaking order | `useRoomScreenState.ts` → 新文件          | SRP 拆分    | C11    |

---

## 变更 #1 — P0: `handleRestartGame` 缺编译时完备性守卫

### 问题

`handleRestartGame` 使用 `{ ...state, <overrides> }`。新增 GameState 字段时如果忘记在此处列出重置值，旧值会通过 spread 静默泄漏到新局——`normalizeState` 有 `satisfies Complete<GameState>` 守卫，但 reducer 没有。

### 文件 1: `packages/game-engine/src/engine/state/normalize.ts`

**Before** (line 20):

```typescript
type Complete<T> = Record<keyof T, unknown>;
```

**After**:

```typescript
export type Complete<T> = Record<keyof T, unknown>;
```

### 文件 2: `packages/game-engine/src/engine/reducer/gameReducer.ts`

**Before** (line 12-16) — 添加 import:

```typescript
import { GameStatus } from '../../models/GameStatus';
import type { ResolvedRoleRevealAnimation } from '../../types/RoleRevealAnimation';
import { resolveRandomAnimation } from '../../types/RoleRevealAnimation';
import type { GameState } from '../store/types';
```

**After**:

```typescript
import { GameStatus } from '../../models/GameStatus';
import type { ResolvedRoleRevealAnimation } from '../../types/RoleRevealAnimation';
import { resolveRandomAnimation } from '../../types/RoleRevealAnimation';
import type { Complete } from '../state/normalize';
import type { GameState } from '../store/types';
```

**Before** (line 61-138) — 替换 handleRestartGame 的 return 语句:

```typescript
return {
  ...state,
  players,
  status: GameStatus.Seated, // v1: 重置到 seated，不是 unseated
  currentStepIndex: -1, // 与 buildInitialGameState 一致
  isAudioPlaying: false,
  currentStepId: undefined, // 清除夜晚步骤
  actions: [],
  currentNightResults: undefined,
  lastNightDeaths: undefined,
  witchContext: undefined,
  seerReveal: undefined,
  psychicReveal: undefined,
  gargoyleReveal: undefined,
  pureWhiteReveal: undefined,
  wolfWitchReveal: undefined,
  wolfRobotReveal: undefined,
  wolfRobotContext: undefined,
  wolfRobotHunterStatusViewed: undefined,
  confirmStatus: undefined,
  actionRejected: undefined,
  nightmareBlockedSeat: undefined,
  wolfKillDisabled: undefined,
  pendingRevealAcks: [],
  // 重开时清除上局残留的 reveal / 音频 / 计时器 / UI 状态
  mirrorSeerReveal: undefined,
  drunkSeerReveal: undefined,
  pendingAudioEffects: undefined,
  wolfVoteDeadline: undefined,
  ui: undefined,
  // 重开时更新 nonce 和 resolved 动画
  roleRevealRandomNonce: newNonce,
  resolvedRoleRevealAnimation: resolvedAnimation,
  // 重开时清除详细信息分享权限
  nightReviewAllowedSeats: undefined,
  // 重开时清除上局残留的 seer 标签
  seerLabelMap: undefined,
  // 重开时清除吹笛者相关状态
  hypnotizedSeats: undefined,
  piperRevealAcks: undefined,
};
```

**After** (使用 `satisfies Complete<GameState>` 显式列出所有字段，不再使用 `...state` spread;
reveal 类字段按类别集中排列——纯风格调整，无语义变化):

```typescript
return {
  // ── 保留字段（跨局不变） ──────────────────────────────
  roomCode: state.roomCode,
  hostUid: state.hostUid,
  templateRoles: state.templateRoles,
  roleRevealAnimation: state.roleRevealAnimation,
  debugMode: state.debugMode,

  // ── 重置字段 ─────────────────────────────────────────
  players,
  status: GameStatus.Seated, // v1: 重置到 seated，不是 unseated
  currentStepIndex: -1, // 与 buildInitialGameState 一致
  isAudioPlaying: false,
  currentStepId: undefined, // 清除夜晚步骤
  actions: [],
  currentNightResults: undefined,
  lastNightDeaths: undefined,
  witchContext: undefined,
  seerReveal: undefined,
  mirrorSeerReveal: undefined,
  drunkSeerReveal: undefined,
  psychicReveal: undefined,
  gargoyleReveal: undefined,
  pureWhiteReveal: undefined,
  wolfWitchReveal: undefined,
  wolfRobotReveal: undefined,
  wolfRobotContext: undefined,
  wolfRobotHunterStatusViewed: undefined,
  confirmStatus: undefined,
  actionRejected: undefined,
  nightmareBlockedSeat: undefined,
  wolfKillDisabled: undefined,
  pendingRevealAcks: [],
  pendingAudioEffects: undefined,
  wolfVoteDeadline: undefined,
  ui: undefined,
  nightReviewAllowedSeats: undefined,
  seerLabelMap: undefined,
  hypnotizedSeats: undefined,
  piperRevealAcks: undefined,

  // ── 重开时更新 nonce 和 resolved 动画 ─────────────────
  roleRevealRandomNonce: newNonce,
  resolvedRoleRevealAnimation: resolvedAnimation,
} satisfies Complete<GameState>;
```

---

## 变更 #2 — P0: `useFocusEffect` 替换 `useEffect` + 移除 facade 侧 listener 追踪

### 问题

Web 上 `NativeStackNavigator` 不卸载前 screen（只隐藏），`useEffect` cleanup 不跑，旧 screen 的 store listener 泄漏。
当前方案用 facade 侧 `#externalUnsubscribes` + `#clearExternalListeners()` 兜底，但：

- 在 `createRoom`/`joinRoom` 中调用会误杀新 screen 刚注册的 listener（时序冲突，参考 commit `b5fa380`）
- facade 不应关心 React 组件生命周期（违反关注点分离）
- YAGNI：`useFocusEffect` 完整覆盖此场景，无需 defense-in-depth

### 社区标准

React Navigation 官方推荐：屏幕级订阅使用 `useFocusEffect`（blur 时 cleanup，focus 时 re-subscribe），不依赖 unmount。

### 文件 1: `src/hooks/useGameRoom.ts` — `useEffect` → `useFocusEffect`

**Before** (import 区):

```typescript
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { ActionSchema, SchemaId } from '@werewolf/game-engine/models/roles/spec';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
```

**After**:

```typescript
import { useFocusEffect } from '@react-navigation/native';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { ActionSchema, SchemaId } from '@werewolf/game-engine/models/roles/spec';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
```

**Before** (facade subscription, line ~195):

```typescript
  useEffect(() => {
    const unsubscribe = facade.addListener((snapshot) => {
      ...
    });
    return () => {
      unsubscribe();
    };
  }, [facade, setStateRevision, onStateReceived, setLastStateReceivedAt]);
```

**After**:

```typescript
  useFocusEffect(
    useCallback(() => {
      const unsubscribe = facade.addListener((snapshot) => {
        ...
      });
      return () => {
        unsubscribe();
      };
    }, [facade, setStateRevision, onStateReceived, setLastStateReceivedAt]),
  );
```

> `useCallback` 已通过现有 import 获得（文件顶部已有 `import { useCallback, ... } from 'react'`）。

### 文件 2: `src/services/facade/GameFacade.ts` — 移除 listener 追踪机制

**删除字段** `#externalUnsubscribes` (line ~113-120):

```typescript
  /**
   * 外部 listener 的 unsubscribe 函数集合。
   * addListener() 注册，leaveRoom/createRoom/joinRoom 时自动清除。
   * Web 上 NativeStackNavigator 不保证 screen unmount（navigate 只隐藏），
   * 因此不能依赖 useEffect cleanup 清除 store listeners，必须在会话边界主动清理。
   */
  #externalUnsubscribes = new Set<() => void>();
```

**简化 `addListener`** (line ~176):

**Before**:

```typescript
  addListener(fn: FacadeStateListener): () => void {
    const unsub = this.#store.subscribe((_state, _rev) => {
      fn(this.#store.getState());
    });
    const wrappedUnsub = () => {
      unsub();
      this.#externalUnsubscribes.delete(wrappedUnsub);
    };
    this.#externalUnsubscribes.add(wrappedUnsub);
    return wrappedUnsub;
  }
```

**After**:

```typescript
  addListener(fn: FacadeStateListener): () => void {
    const unsub = this.#store.subscribe((_state, _rev) => {
      fn(this.#store.getState());
    });
    return unsub;
  }
```

**删除 `#clearExternalListeners` 方法** (line ~250-259):

```typescript
  /**
   * 清除所有通过 addListener() 注册的外部 store listeners。
   * 在会话边界（leaveRoom/createRoom/joinRoom）调用。
   */
  #clearExternalListeners(): void {
    for (const unsub of this.#externalUnsubscribes) {
      unsub();
    }
    // unsub() 内部已 delete，但 defensive clear
    this.#externalUnsubscribes.clear();
  }
```

**删除 `leaveRoom` 中的调用** (line ~683-684):

```typescript
// 清除外部 listeners（Web 上 screen 可能不 unmount，不能依赖 useEffect cleanup）
this.#clearExternalListeners();
```

### 文件 3: `src/services/facade/__tests__/leaveRoom.contract.test.ts` — 回退测试

`leaveRoom` 不再主动清除 listeners。回退到测试 `store.reset` 的原始行为。

> **#1（手动 unsubscribe 后 leaveRoom）和 #3（double unsubscribe）无需修改。**
> `addListener` 去掉 wrapper 后直接返回 `GameStore.subscribe` 的 unsub（基于 `Set.delete`），幂等安全，两个 case 行为不变。

以下 2 个 case 需要改写：

**Before**:

```typescript
  it('should clear external listeners after leaveRoom', async () => {
    ...
    // leaveRoom 主动清除所有外部 listeners，防止 Web 上 screen 不 unmount 导致泄漏
    expect(facade.getListenerCount()).toBe(0);
  });
```

**After**:

```typescript
it('should preserve listeners after leaveRoom (store.reset does not clear listeners)', async () => {
  const facade = createTestFacade();

  // 订阅但不取消
  facade.addListener(() => {});
  facade.addListener(() => {});

  expect(facade.getListenerCount()).toBe(2);

  await facade.leaveRoom();

  // store.reset() 不清除 listeners — React 组件生命周期（useFocusEffect）自行管理
  expect(facade.getListenerCount()).toBe(2);
});
```

**Before**:

```typescript
  it('should not notify external listeners after leaveRoom (cleared before reset)', async () => {
    ...
    // 外部 listener 不应收到 reset 的 null 通知
    expect(listener).not.toHaveBeenCalled();
  });
```

**After**:

```typescript
it('should notify listeners with null state on leaveRoom (store.reset)', async () => {
  const facade = createTestFacade();
  const listener = jest.fn();

  facade.addListener(listener);
  listener.mockClear();

  await facade.leaveRoom();

  // store.reset() 通知 listeners state 变为 null
  expect(listener).toHaveBeenCalledWith(null);
});
```

---

## 变更 #3 — P0: `callApiOnce` content-type 检查缺口

### 问题

Content-type 守卫仅在 `!res.ok` 分支中。若反代返回 `200 + text/html`（如 CDN 默认页），`.json()` 会抛 `SyntaxError`，被 catch 兜住但日志误导（显示 "network error"）。

### 文件: `src/services/facade/apiUtils.ts`

**Before** (line ~70-78):

```typescript
// Guard: non-JSON error pages (502/503) would throw SyntaxError in .json()
if (!res.ok && !res.headers.get('content-type')?.includes('application/json')) {
  facadeLog.error(`${label} non-JSON error`, { path, status: res.status });
  if (store) store.rollbackOptimistic();
  return { success: false, reason: 'SERVER_ERROR' };
}

const result = (await res.json()) as ApiResponse;
```

**After**:

```typescript
// Guard: non-JSON responses (502/503 error pages OR 200+text/html from proxy misconfiguration)
if (!res.headers.get('content-type')?.includes('application/json')) {
  facadeLog.error(`${label} non-JSON response`, { path, status: res.status });
  if (store) store.rollbackOptimistic();
  return { success: false, reason: 'SERVER_ERROR' };
}

const result = (await res.json()) as ApiResponse;
```

---

## 变更 #4 — P1: `STANDARD_SIDE_EFFECTS` 共享可变数组

### 问题

`STANDARD_SIDE_EFFECTS` 是 `SideEffect[]`（可变），多个 handler 共享同一引用。若任一 handler 不慎 `.push()` 会污染全局。

### 文件: `packages/game-engine/src/engine/handlers/types.ts`

**Before** (line 44):

```typescript
  /** 副作用（如需要播放音频、发送消息等） */
  sideEffects?: SideEffect[];
```

**After**:

```typescript
  /** 副作用（如需要播放音频、发送消息等） */
  sideEffects?: readonly SideEffect[];
```

**Before** (line 64-67):

```typescript
export const STANDARD_SIDE_EFFECTS: SideEffect[] = [
  { type: 'BROADCAST_STATE' },
  { type: 'SAVE_STATE' },
];
```

**After**:

```typescript
export const STANDARD_SIDE_EFFECTS: readonly SideEffect[] = Object.freeze([
  { type: 'BROADCAST_STATE' },
  { type: 'SAVE_STATE' },
] as const);
```

---

## 变更 #5 — P1: `NonNullState` 重复定义 4 处 → 提取到 `types.ts`

### 问题

`type NonNullState = NonNullable<HandlerContext['state']>` / `NonNullable<GameState>` 在 4 个文件重复定义。DRY 原则——集中到 `handlers/types.ts`。

### 文件 1: `packages/game-engine/src/engine/handlers/types.ts` — 新增 export

**Before** (文件末尾, line 67 后):

```typescript
export const STANDARD_SIDE_EFFECTS: readonly SideEffect[] = Object.freeze([
  { type: 'BROADCAST_STATE' },
  { type: 'SAVE_STATE' },
] as const);
```

**After** (在 STANDARD_SIDE_EFFECTS 之后追加):

```typescript
export const STANDARD_SIDE_EFFECTS: readonly SideEffect[] = Object.freeze([
  { type: 'BROADCAST_STATE' },
  { type: 'SAVE_STATE' },
] as const);

/**
 * 非 null 的 GameState 类型（通过 handler validation 后使用）
 */
export type NonNullState = NonNullable<HandlerContext['state']>;
```

### 文件 2: `packages/game-engine/src/engine/handlers/actionHandler.ts` — 删除本地定义 + 更新 import

**Before** (line 31-32):

```typescript
import type { HandlerContext, HandlerResult } from './types';
import { STANDARD_SIDE_EFFECTS } from './types';
```

**After**:

```typescript
import type { HandlerContext, HandlerResult, NonNullState } from './types';
import { STANDARD_SIDE_EFFECTS } from './types';
```

**删除** (line 34-37):

```typescript
/**
 * 非 null 的 state 类型（通过 validation 后使用）
 */
type NonNullState = NonNullable<HandlerContext['state']>;
```

### 文件 3: `packages/game-engine/src/engine/handlers/stepTransitionHandler.ts` — 删除本地定义 + 更新 import

**Before** (line 46):

```typescript
import type { HandlerContext, HandlerResult } from './types';
```

**After**:

```typescript
import type { HandlerContext, HandlerResult, NonNullState } from './types';
```

**删除** (line 50-53):

```typescript
/**
 * 非 null 的 state 类型
 */
type NonNullState = NonNullable<HandlerContext['state']>;
```

### 文件 4: `packages/game-engine/src/engine/handlers/confirmContext.ts` — 删除本地定义 + 更新 import

需先确认 import 行。当前无 `./types` import，需添加。

**Before** (line 17-18):

```typescript
import type { GameState } from '../../protocol/types';
import type { SetConfirmStatusAction } from '../reducer/types';
```

**After**:

```typescript
import type { GameState } from '../../protocol/types';
import type { SetConfirmStatusAction } from '../reducer/types';
import type { NonNullState } from './types';
```

**删除** (line 20-23):

```typescript
/**
 * 非 null 的 state 类型
 */
type NonNullState = NonNullable<GameState>;
```

### 文件 5: `packages/game-engine/src/engine/handlers/witchContext.ts` — 删除本地定义 + 更新 import

**Before** (line 16-17):

```typescript
import type { GameState } from '../../protocol/types';
import type { SetWitchContextAction } from '../reducer/types';
```

**After**:

```typescript
import type { GameState } from '../../protocol/types';
import type { SetWitchContextAction } from '../reducer/types';
import type { NonNullState } from './types';
```

**删除** (line 20-23):

```typescript
/**
 * 非 null 的 state 类型
 */
type NonNullState = NonNullable<GameState>;
```

> **注意**: `confirmContext.ts` 和 `witchContext.ts` 原定义是 `NonNullable<GameState>`，而 `types.ts` 导出的是 `NonNullable<HandlerContext['state']>`。两者等价：`HandlerContext['state']` 的类型是 `GameState | null`，`NonNullable<GameState | null>` = `GameState`；`NonNullable<GameState>` = `GameState`（因为 GameState 本身不含 null/undefined）。语义完全一致。

---

## 变更 #6 — P1: SettingsService 缺 boolean 字段校验

### 问题

`themeKey` 和 `roleRevealAnimation` 有校验，但 `bgmEnabled` 和 `hasSeenAssistantHint`（boolean）没有。若 AsyncStorage 中被篡改为非 boolean，会传入应用逻辑。

### 文件: `src/services/feature/SettingsService.ts`

**Before** (line 92-97):

```typescript
if (!VALID_ROLE_REVEAL_ANIMATIONS.has(merged.roleRevealAnimation)) {
  settingsServiceLog.warn(
    'Invalid persisted roleRevealAnimation, resetting to default:',
    merged.roleRevealAnimation,
  );
  merged.roleRevealAnimation = DEFAULT_SETTINGS.roleRevealAnimation;
}
this.#settings = merged;
```

**After**:

```typescript
if (!VALID_ROLE_REVEAL_ANIMATIONS.has(merged.roleRevealAnimation)) {
  settingsServiceLog.warn(
    'Invalid persisted roleRevealAnimation, resetting to default:',
    merged.roleRevealAnimation,
  );
  merged.roleRevealAnimation = DEFAULT_SETTINGS.roleRevealAnimation;
}
// Validate boolean fields (guard against corrupted persisted data)
if (typeof merged.bgmEnabled !== 'boolean') {
  settingsServiceLog.warn('Invalid persisted bgmEnabled, resetting to default:', merged.bgmEnabled);
  merged.bgmEnabled = DEFAULT_SETTINGS.bgmEnabled;
}
if (typeof merged.hasSeenAssistantHint !== 'boolean') {
  settingsServiceLog.warn(
    'Invalid persisted hasSeenAssistantHint, resetting to default:',
    merged.hasSeenAssistantHint,
  );
  merged.hasSeenAssistantHint = DEFAULT_SETTINGS.hasSeenAssistantHint;
}
this.#settings = merged;
```

---

## 变更 #7 — P1: `_userId` 命名误导

### 问题

参数 `_userId` 以 `_` 前缀命名（TypeScript 惯例表示"未使用"），但实际在 L104 被使用 (`userId: _userId`)。

### 文件: `src/services/transport/RealtimeService.ts`

**Before** (line 83):

```typescript
    _userId: string,
```

**After**:

```typescript
    userId: string,
```

**Before** (line 104):

```typescript
      userId: _userId,
```

**After**:

```typescript
      userId,
```

---

## 变更 #8 — P1: `playNightBeginAudio` 重复实现

### 问题

`playNightBeginAudio()` 的函数体与 `playNightAudio()` 完全相同。应委托调用。

### 文件: `src/services/infra/AudioService.ts`

**Before** (line 84-86):

```typescript
  async playNightBeginAudio(): Promise<void> {
    return this.#strategy.play(NIGHT_AUDIO, 'night');
  }
```

**After**:

```typescript
  async playNightBeginAudio(): Promise<void> {
    return this.playNightAudio();
  }
```

---

## 变更 #9 — P2: hardcoded rgba

### 问题

`boxShadow: '0 -3px 12px rgba(0, 0, 0, 0.08)'` 未使用 theme shadow token。需要向上方向的阴影（` -3px`），现有 token 都是向下的，需新增 `shadows.upward` token。

### 文件 1: `src/theme/tokens.ts`

**Before** (line 335-337):

```typescript
  md: { boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' } as ViewStyle,
  lg: { boxShadow: '0px 4px 8px rgba(0,0,0,0.15)' } as ViewStyle,
} as const;
```

**After**:

```typescript
  md: { boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' } as ViewStyle,
  lg: { boxShadow: '0px 4px 8px rgba(0,0,0,0.15)' } as ViewStyle,
  /** Upward shadow for bottom panels */
  upward: { boxShadow: '0px -3px 12px rgba(0,0,0,0.08)' } as ViewStyle,
} as const;
```

### 文件 2: `src/screens/RoomScreen/components/styles.ts`

**Before** (line 305):

```typescript
        boxShadow: '0 -3px 12px rgba(0, 0, 0, 0.08)',
```

**After**:

```typescript
        ...shadows.upward,
```

> `shadows` 已在 L12 通过 `import { borderRadius, shadows, spacing, ... } from '@/theme'` 引入，无需额外修改。

---

## 变更 #10 — P2: `x-region` 硬编码魔法值

### 文件: `src/services/facade/apiUtils.ts`

**Before** (line 14 附近，imports 之后):

```typescript
import { facadeLog } from '@/utils/logger';
```

**After**:

```typescript
import { facadeLog } from '@/utils/logger';

/** Default region value for x-region header (Supabase Edge Functions regional routing) */
const DEFAULT_REGION = 'us-west-1';
```

**Before** (line 64):

```typescript
        'x-region': 'us-west-1',
```

**After**:

```typescript
        'x-region': DEFAULT_REGION,
```

---

## 变更 #11 — P1: Resolver 覆盖率合约测试

### 问题

新 resolver 注册后若忘记写单测，不会有任何告警。需合约测试确保 `RESOLVERS` 中每个 key 在 `__tests__/` 中都有对应 `*.resolver.test.ts`。

### 新文件: `packages/game-engine/src/resolvers/__tests__/resolversCoverage.contract.test.ts`

```typescript
/**
 * Resolver Coverage Contract Test
 *
 * 确保 resolvers/ 目录下每个源文件都有对应的 *.resolver.test.ts。
 * 新增 resolver 源文件但忘记写测试 → 此测试失败。
 *
 * 策略：扫描源文件而非 RESOLVERS registry key，避免 key 名称
 * 与文件名不匹配（如 seerCheck → seer.ts）导致的大量误报。
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Resolver test coverage contract', () => {
  const resolverDir = path.resolve(__dirname, '..');
  const testDir = path.resolve(__dirname);

  // Source: resolvers/*.ts (exclude index.ts, types.ts)
  const sourceFiles = fs
    .readdirSync(resolverDir)
    .filter((f) => f.endsWith('.ts') && f !== 'index.ts' && f !== 'types.ts');
  const sourceNames = new Set(sourceFiles.map((f) => f.replace('.ts', '')));

  // Tests: __tests__/*.resolver.test.ts
  const testFiles = fs.readdirSync(testDir).filter((f) => f.endsWith('.resolver.test.ts'));
  const testedResolvers = new Set(testFiles.map((f) => f.replace('.resolver.test.ts', '')));

  it('every resolver source file should have a corresponding test file', () => {
    const missing = [...sourceNames].filter((name) => !testedResolvers.has(name));
    expect(missing).toEqual([]);
  });

  it('resolver source directory should not be empty', () => {
    expect(sourceNames.size).toBeGreaterThan(0);
  });
});
```

---

## 变更 #12 — P1: `Object.entries(state.players)` 重复 10 处，替换 7 处 (C6)

### 问题

`Object.entries(state.players)` + `Number.parseInt(seatStr, 10)` 模式在 game-engine 中重复 10 次，分布于 8 个文件。每次都要手动转 key 类型，易出错。其中 7 处可用 helper 替换，3 处因逻辑特殊保留原写法。

### 方案

在 `packages/game-engine/src/utils/` 新建 `playerHelpers.ts`，提取 3 个常用模式：

```typescript
/**
 * Player Iteration Helpers — 消除 Object.entries(state.players) 样板代码
 */
import type { RoleId } from '../models/roles';
import type { GameState } from '../protocol/types';

type Players = GameState['players'];

/** 构建 seat → RoleId 映射（仅含已分配角色的座位） */
export function buildSeatRoleMap(players: Players): Map<number, RoleId> {
  const map = new Map<number, RoleId>();
  for (const [seatStr, player] of Object.entries(players)) {
    if (player?.role) {
      map.set(Number.parseInt(seatStr, 10), player.role);
    }
  }
  return map;
}

/** 查找拥有指定角色的座位号（未找到返回 null） */
export function findSeatByRole(players: Players, roleId: RoleId): number | null {
  for (const [seatStr, player] of Object.entries(players)) {
    if (player?.role === roleId) {
      return Number.parseInt(seatStr, 10);
    }
  }
  return null;
}

/** 遍历所有非空座位，回调 (seat, player) */
export function forEachSeatedPlayer(
  players: Players,
  callback: (seat: number, player: NonNullable<Players[number]>) => void,
): void {
  for (const [seatStr, player] of Object.entries(players)) {
    if (player !== null) {
      callback(Number.parseInt(seatStr, 10), player);
    }
  }
}
```

### 替换清单（10 处）

| 文件                       | 行   | 当前模式                    | 替换为                                                                                         |
| -------------------------- | ---- | --------------------------- | ---------------------------------------------------------------------------------------------- |
| `actionHandler.ts`         | L48  | build `Map<number, RoleId>` | `buildSeatRoleMap(state.players)`                                                              |
| `stepTransitionHandler.ts` | L165 | build `Map<number, RoleId>` | `buildSeatRoleMap(state.players)`                                                              |
| `confirmContext.ts`        | L47  | find seat by role           | `findSeatByRole(state.players, role)`                                                          |
| `witchContext.ts`          | L60  | find seat by role='witch'   | `findSeatByRole(state.players, 'witch')`                                                       |
| `stepTransitionHandler.ts` | L216 | find seat by roleId         | `findSeatByRole(state.players, roleId)` + **删除本地 `findSeatByRoleId` 函数定义**（L216-222） |
| `progressionEvaluator.ts`  | L38  | iterate seated with role    | 保留（逻辑特殊：fail-closed + doesRoleParticipate）                                            |
| `seatHandler.ts`           | L83  | find player by uid          | 保留（按 uid 查找，非按 role）                                                                 |
| `seatHandler.ts`           | L202 | iterate all non-null        | `forEachSeatedPlayer(state.players, ...)`                                                      |
| `gameControlHandler.ts`    | L345 | filter non-null seats       | `forEachSeatedPlayer` 或保留（链式 filter+map）                                                |
| `gameReducer.ts`           | L398 | iterate bots                | 保留（特殊 isBot 过滤）                                                                        |

> 10 处中 **5 处**可直接替换，**2 处**用 `forEachSeatedPlayer`，**3 处**因逻辑特殊保留原写法。
>
> **额外注意**：`stepTransitionHandler.ts` 中 `buildRoleSeatMap` 函数（L161）开头 4 行构建 `players Map` 的代码被 `buildSeatRoleMap` 替换后，应同步删除为 helper 取代的那段循环代码。`findSeatByRoleId` 本地函数定义（L216-222）在所有调用替换后也应一并删除。

---

## 变更 #13 — P1: `getListenerCount` 硬编码 `-1` (C2)

### 问题

`getListenerCount()` 返回 `this.#store.getListenerCount() - 1`。注释说"排除 constructor 内部的 pendingAudioEffects reactive 订阅（固定 1 个）"。但如果有人在 constructor 加第二个 store listener，这个 `-1` 就 drift 了。

### 方案

提取为命名常量，放在 constructor 旁边，命名和注释强制维护者同步更新：

**Before**:

```typescript
  getListenerCount(): number {
    return this.#store.getListenerCount() - 1;
  }
```

**After**:

```typescript
  /**
   * Constructor 注册的内部 store listener 数量。
   * 若在 constructor 中新增/删除 store.subscribe()，必须同步更新此值。
   */
  static readonly #INTERNAL_STORE_LISTENER_COUNT = 1;

  getListenerCount(): number {
    return this.#store.getListenerCount() - GameFacade.#INTERNAL_STORE_LISTENER_COUNT;
  }
```

> 位置：`#INTERNAL_STORE_LISTENER_COUNT` 声明放在 constructor 正上方的字段区域。

---

## 变更 #14 — P2: GameFacade 925 行 → 拆分 reconnection manager (C7)

### 问题

GameFacade 承担了房间生命周期 + 音频编排 + 断连恢复 + API 委派 4 大职责，超过 400 行信号线。

### 拆分方案

**提取 `reconnectionManager.ts`（~220 行）**：

| 方法                       | 行数 | 说明                              |
| -------------------------- | ---- | --------------------------------- |
| `#playPendingAudioEffects` | ~49  | Host-only reactive 音频消费       |
| `#retryPendingAudioAck`    | ~47  | ack 重试执行                      |
| `#registerOnlineRetry`     | ~30  | L3 online event → ack 重试        |
| `#startPollFallback`       | ~20  | navigator.onLine poll             |
| `#unregisterOnlineRetry`   | ~30  | 清理 online handler + timer       |
| `#registerOnlineFetch`     | ~20  | L3 通用 online → fetchStateFromDB |
| `#unregisterOnlineFetch`   | ~15  | 清理                              |

新模块签名：

```typescript
export class ReconnectionManager {
  constructor(deps: {
    store: GameStore;
    audioService: IAudioService;
    realtimeService: RealtimeService;
    roomService: Pick<RoomService, 'getGameState'>;
    getIsHost: () => boolean;
    getRoomCode: () => string | null;
    getAborted: () => boolean;
  }) {}
  // ... 上述方法变为 public
}
```

GameFacade constructor 中 2 个 `realtimeService.addStatusListener` 回调逻辑也移入 `ReconnectionManager`。

**拆分后 GameFacade ~700 行**，主要剩下：房间生命周期 + thin delegate + identity。

---

## 变更 #15 — P2: ConfigScreen 877 行 → 拆分 state + helpers (C8)

### 问题

ConfigScreen 是 monolithic component，混合了纯函数 helpers + 状态管理 + JSX 渲染。

### 拆分方案

遵循 RoomScreen 已有模式（`RoomScreen.tsx` + `useRoomScreenState.ts`）：

**1. 新建 `configHelpers.ts`（~110 行）** — 提取 module-level 纯函数：

```
getInitialSelection, selectionToRoles, VARIANT_TO_BASE,
restoreFromTemplateRoles, FACTION_COLOR_MAP, computeTotalCount,
expandSlotToChipEntries
```

**2. 新建 `useConfigScreenState.ts`（~480 行）** — 提取组件内状态 + callbacks：

```
所有 useState, useEffect, useCallback handlers:
handleGoBack, toggleRole, handlePresetSelect, handleClearSelection,
handleCreateRoom, dropdown handlers, variant picker, role info sheet,
settings sheet, template dropdown, bulk role stepper
```

**3. ConfigScreen.tsx 简化为 ~280 行**（imports + JSX render-only）

---

## 变更 #16 — P2: useActionOrchestrator 818 行 → 提取 intent handlers (C9)

### 问题

`handleActionIntent` 的 switch 语句占 **505 行**，每个 case 分支独立。

### 拆分方案

**新建 `actionIntentHandlers.ts`** — 按 intent type 提取纯函数：

```typescript
// 每个 handler 接收统一的 context 对象
interface IntentHandlerContext {
  gameContext: GameContext;
  actionDeps: ActionDeps;
  state: LocalGameState;
  // ... 其他共享依赖
}

export const INTENT_HANDLERS: Record<
  IntentType,
  (ctx: IntentHandlerContext, intent: ActionIntent) => void
> = {
  magicianFirst: handleMagicianFirst,
  reveal: handleReveal, // ~95 lines
  wolfVote: handleWolfVote, // ~45 lines
  actionConfirm: handleActionConfirm, // ~75 lines
  skip: handleSkip, // ~40 lines
  actionPrompt: handleActionPrompt,
  confirmTrigger: handleConfirmTrigger,
  wolfRobotViewHunterStatus: handleWolfRobotViewHunterStatus, // ~50 lines
  multiSelectToggle: handleMultiSelectToggle,
  multiSelectConfirm: handleMultiSelectConfirm,
  groupConfirmAck: handleGroupConfirmAck,
};
```

**useActionOrchestrator.ts 简化为 ~310 行**（local state + refs + rejection effect + auto-trigger + dispatcher）。

---

## 变更 #17 — P2: useRoomActions 771 行 → 提取 bottom action builder (C10)

### 问题

`getBottomAction` 函数占 **229 行**，是一个大 if/else 链（per schema kind）。

### 拆分方案

**新建 `bottomActionBuilder.ts`** — 纯函数，按 schema kind 拆分子函数：

```typescript
export function buildBottomAction(ctx: BottomActionContext): BottomActionVM | null {
  // UI hint override
  if (ctx.ui?.currentActorHint) return buildUiHintAction(ctx);
  // schema-driven
  switch (ctx.schemaKind) {
    case 'wolfVote':
      return buildWolfVoteAction(ctx);
    case 'chooseSeat':
      return buildChooseSeatAction(ctx);
    case 'compound':
      return buildCompoundAction(ctx);
    case 'confirm':
      return buildConfirmAction(ctx);
    case 'groupConfirm':
      return buildGroupConfirmAction(ctx);
    case 'multiChooseSeat':
      return buildMultiChooseSeatAction(ctx);
    default:
      return null;
  }
}
```

**useRoomActions.ts 简化为 ~540 行**。

---

## 变更 #18 — P2: useRoomScreenState 877 行 → 提取 countdown + speaking order (C11)

### 问题

useRoomScreenState 是 wiring hub，大部分已委派给子 hooks。但仍有 2 块内联逻辑可提取。

### 拆分方案

**1. 新建 `useWolfVoteCountdown.ts`（~45 行）** — 提取 L192-237 的倒计时 tick + postProgression 触发：

```typescript
export function useWolfVoteCountdown(
  wolfVoteDeadline: number | undefined,
  postProgression: () => Promise<...>,
) {
  const [wolfVoteCountdown, setWolfVoteCountdown] = useState<number | null>(null);
  // ... tick effect + auto-trigger
  return wolfVoteCountdown;
}
```

**2. 新建 `useSpeakingOrder.ts`（~35 行）** — 提取 L686-714 的发言顺序计算：

```typescript
export function useSpeakingOrder(
  lastNightDeaths: number[] | undefined,
  totalSeats: number,
  roomStatus: GameStatus,
) {
  // ... speaking order derivation
  return speakingOrder;
}
```

**useRoomScreenState.ts 简化为 ~800 行**（降幅不大，但职责更清晰）。

---

## 受影响文件清单

### C1: type-safety & DRY (game-engine)

| 文件                                                                | 修改类型                                |
| ------------------------------------------------------------------- | --------------------------------------- |
| `packages/game-engine/src/engine/state/normalize.ts`                | 添加 `export`                           |
| `packages/game-engine/src/engine/reducer/gameReducer.ts`            | import + rewrite return                 |
| `packages/game-engine/src/engine/handlers/types.ts`                 | readonly + freeze + export NonNullState |
| `packages/game-engine/src/engine/handlers/actionHandler.ts`         | import 更新 + 删除本地 type             |
| `packages/game-engine/src/engine/handlers/stepTransitionHandler.ts` | import 更新 + 删除本地 type             |
| `packages/game-engine/src/engine/handlers/confirmContext.ts`        | import 添加 + 删除本地 type             |
| `packages/game-engine/src/engine/handlers/witchContext.ts`          | import 添加 + 删除本地 type             |

### C2: useFocusEffect + listener tracking removal

| 文件                                                       | 修改类型                                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/hooks/useGameRoom.ts`                                 | `useEffect` → `useFocusEffect`                                                                   |
| `src/services/facade/GameFacade.ts`                        | 删除 `#externalUnsubscribes` + `#clearExternalListeners` + 提取 `#INTERNAL_STORE_LISTENER_COUNT` |
| `src/services/facade/__tests__/leaveRoom.contract.test.ts` | 回退 listener 测试                                                                               |

### C3: services defensive fixes

| 文件                                        | 修改类型                                         |
| ------------------------------------------- | ------------------------------------------------ |
| `src/services/facade/apiUtils.ts`           | content-type guard 统一 + `X_REGION_HEADER` 常量 |
| `src/services/feature/SettingsService.ts`   | boolean 字段校验                                 |
| `src/services/transport/RealtimeService.ts` | `_userId` → `userId`                             |
| `src/services/infra/AudioService.ts`        | 委托调用                                         |

### C4: theme token

| 文件                                          | 修改类型              |
| --------------------------------------------- | --------------------- |
| `src/theme/tokens.ts`                         | 新增 `shadows.upward` |
| `src/screens/RoomScreen/components/styles.ts` | 使用 shadow token     |

### C5: contract test

| 文件                                                                              | 修改类型   |
| --------------------------------------------------------------------------------- | ---------- |
| `packages/game-engine/src/resolvers/__tests__/resolversCoverage.contract.test.ts` | **新文件** |

### C6: player iteration helpers

| 文件                                                                | 修改类型                                   |
| ------------------------------------------------------------------- | ------------------------------------------ |
| `packages/game-engine/src/utils/playerHelpers.ts`                   | **新文件**                                 |
| `packages/game-engine/src/engine/handlers/actionHandler.ts`         | 使用 `buildSeatRoleMap`                    |
| `packages/game-engine/src/engine/handlers/stepTransitionHandler.ts` | 使用 `buildSeatRoleMap` + `findSeatByRole` |
| `packages/game-engine/src/engine/handlers/confirmContext.ts`        | 使用 `findSeatByRole`                      |
| `packages/game-engine/src/engine/handlers/witchContext.ts`          | 使用 `findSeatByRole`                      |
| `packages/game-engine/src/engine/handlers/seatHandler.ts`           | 使用 `forEachSeatedPlayer`（L202）         |

### C7: reconnection manager extraction

| 文件                                         | 修改类型               |
| -------------------------------------------- | ---------------------- |
| `src/services/facade/reconnectionManager.ts` | **新文件**（~220 行）  |
| `src/services/facade/GameFacade.ts`          | 委托 reconnection 逻辑 |

### C8: ConfigScreen split

| 文件                                               | 修改类型                      |
| -------------------------------------------------- | ----------------------------- |
| `src/screens/ConfigScreen/configHelpers.ts`        | **新文件**（~110 行）         |
| `src/screens/ConfigScreen/useConfigScreenState.ts` | **新文件**（~480 行）         |
| `src/screens/ConfigScreen/ConfigScreen.tsx`        | 简化为 render-only（~280 行） |

### C9: action intent handlers extraction

| 文件                                                    | 修改类型                     |
| ------------------------------------------------------- | ---------------------------- |
| `src/screens/RoomScreen/hooks/actionIntentHandlers.ts`  | **新文件**（~510 行）        |
| `src/screens/RoomScreen/hooks/useActionOrchestrator.ts` | 简化为 dispatcher（~310 行） |

### C10: bottom action builder extraction

| 文件                                                  | 修改类型              |
| ----------------------------------------------------- | --------------------- |
| `src/screens/RoomScreen/hooks/bottomActionBuilder.ts` | **新文件**（~230 行） |
| `src/screens/RoomScreen/hooks/useRoomActions.ts`      | 简化（~540 行）       |

### C11: countdown + speaking order hooks

| 文件                                                   | 修改类型             |
| ------------------------------------------------------ | -------------------- |
| `src/screens/RoomScreen/hooks/useWolfVoteCountdown.ts` | **新文件**（~45 行） |
| `src/screens/RoomScreen/hooks/useSpeakingOrder.ts`     | **新文件**（~35 行） |
| `src/screens/RoomScreen/hooks/useRoomScreenState.ts`   | 简化（~800 行）      |

---

## 验证计划

每个 commit 后运行：

1. `npx tsc --noEmit` — 类型检查
2. `pnpm run test:all` — 全量单测
3. `pnpm run quality` — 完整质量流水线

C7-C11（SRP 拆分）额外验证：4. `npx knip --no-exit-code` — 确认无新增 unused exports 5. E2E smoke test — 确认 UI 功能不受影响
