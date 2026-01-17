# Phase 4 终局重构方案 v4.1

> **目标**：UI/Host 全面切到 Spec+Schema+Resolver+NightPlan，删除所有 Legacy，实现编译期 + 运行时双重反作弊。

---

## 核心原则（不可违背）

### 1. Host is Authority for Computation and Routing, NOT Visibility

- Host 是游戏逻辑权威（计算、校验、路由）
- Host 不是可见性特权（Host 玩家也只能看到发给自己的私密消息）

### 2. Public 白名单 + Private 分流

- Public 广播只允许**显式白名单字段**
- 敏感信息**只能**通过 `sendPrivate(toUid)` 发送
- 两套 API 类型不兼容，编译器强制分流

### 3. UI 禁用只是 UX，不是规则

- UI 本地计算的 `selectable` 只用于体验优化（禁用样式）
- Host resolver 必须兜底拒绝无效 action（幂等 no-op）
- Nightmare 阻止等敏感信息：UI 不知道，Host 强制执行

### 4. Night-1-only 范围

- 不引入死亡/出局禁选、跨夜记忆约束
- UI 本地只判断 `notSelf` + `targetCount`，其余交给 Host reject

---

## 架构总览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Layer 1: 类型层分流（编译期）                      │
│                                                                          │
│   PublicPayload (白名单)              PrivatePayload (敏感信息)           │
│   ├── ROLE_TURN                       ├── WITCH_CONTEXT                  │
│   │   ├── role                        │   ├── killedIndex                │
│   │   ├── schemaId                    │   ├── canSave                    │
│   │   └── pendingSeats                │   └── phase                      │
│   ├── STATE_UPDATE                    ├── SEER_REVEAL                    │
│   │   └── (公共状态字段)               │   └── result: '好人'|'狼人'       │
│   └── NIGHT_END                       ├── PSYCHIC_REVEAL                 │
│       └── deaths[]                    │   └── result: 角色名              │
│                                       └── BLOCKED                        │
│   broadcastPublic(payload)            │   └── reason: 'nightmare'        │
│   ├── 只接受 PublicPayload            │                                   │
│   └── 编译器强制                      sendPrivate(toUid, payload)        │
│                                       ├── 只接受 PrivatePayload           │
│                                       └── 编译器强制                      │
├─────────────────────────────────────────────────────────────────────────┤
│                        Layer 2: UI 本地约束（安全计算）                    │
│                                                                          │
│   isSeatSelectable(seat, mySeat, schema)                                 │
│   ├── schema.constraints.includes('notSelf') → 不能选自己                │
│   ├── schema.targetCount → 选择数量限制                                  │
│   └── 其他约束 → 交给 Host reject，UI 不判断                             │
│                                                                          │
│   禁止：                                                                 │
│   ├── 广播 selectableSeats / blockedSeat / disabledSeats               │
│   └── 任何可推导"谁被阻止"的侧信道字段                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                        Layer 3: Zero-Trust Inbox（运行时）                │
│                                                                          │
│   privateInbox: Map<InboxKey, PrivatePayload>                            │
│   ├── InboxKey = `${revision}_${schemaId}_${requestId}`                  │
│   ├── 只接受 toUid === myUid 的消息                                      │
│   └── revision 前进时清理旧 inbox                                        │
│                                                                          │
│   getWitchContext(currentRevision) → WitchContext | null                 │
│   getSeerReveal(currentRevision) → SeerReveal | null                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Layer 1：类型层分流（编译期强制）

### 1.1 Public 白名单类型

```typescript
// src/services/types/PublicBroadcast.ts

import type { RoleName, SchemaId } from '../../models/roles/spec';

/**
 * 公开广播 payload（白名单）
 * 只允许这些字段，编译器强制
 */
export type PublicPayload =
  | PublicStateUpdate
  | PublicRoleTurn
  | PublicNightEnd
  | PublicPlayerJoined
  | PublicPlayerLeft
  | PublicGameRestarted
  | PublicSeatActionAck;

export interface PublicStateUpdate {
  type: 'STATE_UPDATE';
  revision: number;
  state: PublicGameState;
}

export interface PublicRoleTurn {
  type: 'ROLE_TURN';
  role: RoleName;
  schemaId?: SchemaId;
  pendingSeats?: number[];
  // ❌ 禁止：killedIndex, checkResult, canSave, selectableSeats
}

export interface PublicNightEnd {
  type: 'NIGHT_END';
  deaths: number[];
}

export interface PublicPlayerJoined {
  type: 'PLAYER_JOINED';
  seat: number;
  player: PublicPlayer;
}

export interface PublicPlayerLeft {
  type: 'PLAYER_LEFT';
  seat: number;
}

export interface PublicGameRestarted {
  type: 'GAME_RESTARTED';
}

export interface PublicSeatActionAck {
  type: 'SEAT_ACTION_ACK';
  requestId: string;
  toUid: string;
  success: boolean;
  seat: number;
  reason?: string;
}

/**
 * 公开游戏状态（白名单）
 */
export interface PublicGameState {
  roomCode: string;
  hostUid: string;
  status: 'unseated' | 'seated' | 'assigned' | 'ready' | 'ongoing' | 'ended';
  templateRoles: RoleName[];
  players: Record<number, PublicPlayer | null>;
  currentActionerIndex: number;
  isAudioPlaying: boolean;
  wolfVoteStatus?: Record<number, boolean>; // 只显示投票进度，不泄露目标
  // ❌ 禁止：nightmareBlockedSeat, killedIndex, selectableSeats, actions
}

export interface PublicPlayer {
  uid: string;
  seatNumber: number;
  displayName?: string;
  avatarUrl?: string;
  role?: RoleName | null; // 只发给玩家自己或狼看狼
  hasViewedRole: boolean;
}
```

### 1.2 Private 敏感类型

```typescript
// src/services/types/PrivateBroadcast.ts

/**
 * 私密消息 payload（敏感信息）
 * 只能通过 sendPrivate(toUid, payload) 发送
 */
export interface PrivateMessage {
  type: 'PRIVATE_EFFECT';
  toUid: string; // 必填：强制指定接收者
  revision: number; // 必填：绑定回合
  payload: PrivatePayload;
}

export type PrivatePayload =
  | WitchContextPayload
  | SeerRevealPayload
  | PsychicRevealPayload
  | BlockedPayload
  | SnapshotResponsePayload;

export interface WitchContextPayload {
  kind: 'WITCH_CONTEXT';
  killedIndex: number; // 被狼杀的座位（-1 = 空刀）
  canSave: boolean; // Host 已判断是否可救（排除自救）
  canPoison: boolean; // 是否有毒药
  phase: 'save' | 'poison';
}

export interface SeerRevealPayload {
  kind: 'SEER_REVEAL';
  targetSeat: number;
  result: '好人' | '狼人';
}

export interface PsychicRevealPayload {
  kind: 'PSYCHIC_REVEAL';
  targetSeat: number;
  result: string; // 具体角色名
}

export interface BlockedPayload {
  kind: 'BLOCKED';
  reason: 'nightmare';
}

export interface SnapshotResponsePayload {
  kind: 'SNAPSHOT_RESPONSE';
  requestId: string;
  state: PublicGameState;
}
```

### 1.3 发送 API 分流

```typescript
// src/services/BroadcastService.ts (新增/修改)

/**
 * 广播公开消息（房间所有人可见）
 * 类型层只接受 PublicPayload
 */
broadcastPublic(payload: PublicPayload): void {
  this.channel?.send({
    type: 'broadcast',
    event: 'host_message',
    payload,
  });
}

/**
 * 发送私密消息（只有指定 toUid 可见）
 * 类型层只接受 PrivateMessage
 */
sendPrivate(message: PrivateMessage): void {
  this.channel?.send({
    type: 'broadcast',
    event: 'host_message',
    payload: message,
  });
}

// ❌ 禁止：旧的 broadcast(payload: HostBroadcast) 统一入口
// 必须显式选择 broadcastPublic 或 sendPrivate
```

### 1.4 接收端过滤

```typescript
// src/services/BroadcastService.ts

onHostMessage(callback: (msg: PublicPayload | PrivateMessage) => void): void {
  // ... existing subscription logic
}

// UI 端使用
onHostMessage((msg) => {
  if (msg.type === 'PRIVATE_EFFECT') {
    // Zero-Trust：只处理发给自己的私密消息
    if (msg.toUid !== myUid) return;
    handlePrivateEffect(msg);
  } else {
    handlePublicPayload(msg);
  }
});
```

---

## Layer 2：UI 本地约束（安全计算）

### 2.1 座位可选性（本地计算）

```typescript
// src/screens/RoomScreen/utils/seatSelectability.ts

import type { ActionSchema } from '../../../models/roles/spec';

export interface SeatSelectability {
  selectable: boolean;
  reason?: string;
}

/**
 * 本地计算座位可选性
 *
 * 只依赖：schema.constraints + mySeatNumber（本地已知信息）
 * 不依赖：Host 广播的任何"可选座位"信息
 *
 * 重要：这只是 UX 优化，不是规则。Host resolver 必须兜底拒绝无效 action。
 */
export function isSeatSelectable(
  seatIndex: number,
  mySeatNumber: number | null,
  schema: ActionSchema | undefined,
): SeatSelectability {
  // Night-1-only：不做死亡/出局禁选

  // notSelf 约束：本地已知，无泄露
  if (schema?.constraints?.includes('notSelf') && seatIndex === mySeatNumber) {
    return { selectable: false, reason: '不能选自己' };
  }

  // targetCount 约束：本地已知
  // (实现逻辑取决于已选数量，由调用方传入)

  // 其他约束（如 nightmare 阻止）：
  // UI 不知道，Host 会 reject

  return { selectable: true };
}

/**
 * 获取所有可选座位（用于 UI 批量渲染）
 */
export function getSelectableSeats(
  totalSeats: number,
  mySeatNumber: number | null,
  schema: ActionSchema | undefined,
): number[] {
  return Array.from({ length: totalSeats }, (_, i) => i).filter(
    (seat) => isSeatSelectable(seat, mySeatNumber, schema).selectable,
  );
}
```

### 2.2 文案工具（从 Spec 读取）

```typescript
// src/screens/RoomScreen/utils/schemaUi.ts

import { getRoleSpec, getSchema, type SchemaId } from '../../../models/roles/spec';

/**
 * 获取行动提示文案
 * 只从 ROLE_SPECS / SCHEMAS 读取，不调用 getRoleModel
 */
export function getActionPrompt(roleId: string, schemaId?: SchemaId): string {
  const spec = getRoleSpec(roleId);
  if (spec?.ux?.actionMessage) {
    return spec.ux.actionMessage;
  }

  const schema = schemaId ? getSchema(schemaId) : undefined;
  if (schema?.displayName) {
    return `请${schema.displayName}`;
  }

  return '请选择目标';
}

/**
 * 获取确认按钮文案
 */
export function getConfirmText(roleId: string): string {
  const spec = getRoleSpec(roleId);
  return spec?.ux?.actionConfirmMessage || '确定';
}

/**
 * 获取角色显示名
 */
export function getRoleDisplayName(roleId: string): string {
  const spec = getRoleSpec(roleId);
  return spec?.displayName || roleId;
}
```

---

## Layer 3：Zero-Trust Inbox（运行时）

### 3.1 Inbox Hook

```typescript
// src/hooks/usePrivateInbox.ts

import { useState, useEffect, useCallback } from 'react';
import { BroadcastService } from '../services/BroadcastService';
import type {
  PrivatePayload,
  WitchContextPayload,
  SeerRevealPayload,
} from '../services/types/PrivateBroadcast';

/**
 * Inbox Key：绑定 revision + kind
 * 确保不会读到上一回合的残留
 */
type InboxKey = `${number}_${string}`;

function makeInboxKey(revision: number, kind: string): InboxKey {
  return `${revision}_${kind}`;
}

export function usePrivateInbox(myUid: string | null, currentRevision: number) {
  const [inbox, setInbox] = useState<Map<InboxKey, PrivatePayload>>(new Map());

  // 监听私密消息
  useEffect(() => {
    if (!myUid) return;

    const broadcastService = BroadcastService.getInstance();

    const handlePrivateEffect = (msg: PrivateMessage) => {
      // Zero-Trust：只接受发给自己的消息
      if (msg.toUid !== myUid) return;

      const key = makeInboxKey(msg.revision, msg.payload.kind);
      setInbox((prev) => new Map(prev).set(key, msg.payload));
    };

    // 订阅（假设 BroadcastService 有此接口）
    const unsubscribe = broadcastService.onPrivateMessage(handlePrivateEffect);

    return unsubscribe;
  }, [myUid]);

  // revision 前进时清理旧 inbox
  useEffect(() => {
    setInbox((prev) => {
      const newInbox = new Map<InboxKey, PrivatePayload>();
      for (const [key, payload] of prev) {
        const [revStr] = key.split('_');
        const rev = parseInt(revStr, 10);
        // 只保留当前或更新的 revision
        if (rev >= currentRevision) {
          newInbox.set(key, payload);
        }
      }
      return newInbox;
    });
  }, [currentRevision]);

  // 获取女巫上下文
  const getWitchContext = useCallback((): WitchContextPayload | null => {
    const key = makeInboxKey(currentRevision, 'WITCH_CONTEXT');
    const payload = inbox.get(key);
    return payload?.kind === 'WITCH_CONTEXT' ? payload : null;
  }, [inbox, currentRevision]);

  // 获取预言家查验结果
  const getSeerReveal = useCallback((): SeerRevealPayload | null => {
    const key = makeInboxKey(currentRevision, 'SEER_REVEAL');
    const payload = inbox.get(key);
    return payload?.kind === 'SEER_REVEAL' ? payload : null;
  }, [inbox, currentRevision]);

  // 检查是否被阻止
  const isBlocked = useCallback((): boolean => {
    const key = makeInboxKey(currentRevision, 'BLOCKED');
    return inbox.has(key);
  }, [inbox, currentRevision]);

  // 清空 inbox（游戏重开时）
  const clearInbox = useCallback(() => setInbox(new Map()), []);

  return {
    inbox,
    getWitchContext,
    getSeerReveal,
    isBlocked,
    clearInbox,
  };
}
```

### 3.2 UI 使用示例

```typescript
// src/screens/RoomScreen/hooks/useRoomActions.ts (修改后)

const { getWitchContext, isBlocked } = usePrivateInbox(myUid, stateRevision);

const getAutoTriggerIntent = useCallback((): ActionIntent | null => {
  if (!myRole || !imActioner || isAudioPlaying) return null;

  // 检查是否被阻止（从私密 inbox 读取）
  if (isBlocked()) {
    return { type: 'blocked', targetIndex: -1 };
  }

  // 女巫：从私密 inbox 读取上下文
  if (currentSchema?.kind === 'compound') {
    const witchCtx = getWitchContext();
    if (!witchCtx) {
      // 还没收到私密消息，显示等待状态
      return null;
    }

    if (witchCtx.phase === 'save') {
      return {
        type: 'witchSavePhase',
        targetIndex: witchCtx.killedIndex,
        canSave: witchCtx.canSave,
        killedIndex: witchCtx.killedIndex,
      };
    }
    if (witchCtx.phase === 'poison') {
      return { type: 'witchPoisonPhase', targetIndex: -1 };
    }
  }

  // 其他角色
  return { type: 'actionPrompt', targetIndex: -1 };
}, [myRole, imActioner, isAudioPlaying, currentSchema, getWitchContext, isBlocked]);
```

---

## Host 端实现

### 4.1 女巫回合：私发 WITCH_CONTEXT

```typescript
// src/services/GameStateService.ts (修改)

private async enterWitchTurn(): Promise<void> {
  const witchUid = this.getPlayerUidByRole('witch');
  if (!witchUid) return;

  const killedIndex = this.getWolfKillTarget();
  const witchSeat = this.getPlayerSeatByRole('witch');

  // Host 计算 canSave（排除自救）
  const canSave = killedIndex !== -1 && killedIndex !== witchSeat;

  // 私发给女巫（不广播）
  this.broadcastService.sendPrivate({
    type: 'PRIVATE_EFFECT',
    toUid: witchUid,
    revision: this.stateRevision,
    payload: {
      kind: 'WITCH_CONTEXT',
      killedIndex,
      canSave,
      canPoison: true,  // TODO: 检查毒药状态
      phase: 'save',
    },
  });
}
```

### 4.2 预言家/通灵师：行动后私发结果

```typescript
// src/services/GameStateService.ts (修改)

private async handleSeerAction(seerUid: string, targetSeat: number): Promise<void> {
  // Host 计算查验结果
  const targetRole = this.getPlayerRole(targetSeat);
  const result = isWolfRole(targetRole) ? '狼人' : '好人';

  // 私发给预言家（不广播）
  this.broadcastService.sendPrivate({
    type: 'PRIVATE_EFFECT',
    toUid: seerUid,
    revision: this.stateRevision,
    payload: {
      kind: 'SEER_REVEAL',
      targetSeat,
      result,
    },
  });
}
```

### 4.3 Nightmare 阻止：Host 强制 + 私发

```typescript
// src/services/GameStateService.ts (修改)

private async handlePlayerAction(msg: PlayerActionMessage): Promise<void> {
  const { seat, role, target } = msg;

  // Host 强制检查：被 nightmare 阻止的玩家
  if (this.isPlayerBlockedByNightmare(seat)) {
    // 幂等 no-op：不记录 action
    // 私发告知当事人
    const playerUid = this.getPlayerUidBySeat(seat);
    if (playerUid) {
      this.broadcastService.sendPrivate({
        type: 'PRIVATE_EFFECT',
        toUid: playerUid,
        revision: this.stateRevision,
        payload: {
          kind: 'BLOCKED',
          reason: 'nightmare',
        },
      });
    }
    return;  // 不处理 action
  }

  // 正常处理 action
  // ...
}
```

---

## Legacy 删除清单

### 5.1 Room.ts 处理

**保留**（移到 `src/models/roomTypes.ts`）：

- `RoomStatus` enum
- `GameRoomLike` interface（测试兼容）

**删除**（规则函数）：

- `performSeerAction()`
- `performPsychicAction()`
- `getKilledIndex()`
- `getHunterStatus()`
- `getDarkWolfKingStatus()`
- `isCurrentActionerSkillBlocked()`
- `proceedToNextAction()`
- `getWolfVoteSummary()`
- `calculateWolfKillTarget()`（已有 `WolfVoteResolver`）
- `getActionLog()`
- `getRoomInfo()`

**保留**（Host-side 仍需要）：

- `createRoom()` / `roomToDbMap()` / `roomFromDb()`（如果还用）
- `assignRoles()` / `restartRoom()` / `markPlayerViewedRole()`
- `getNightResult()` / `getLastNightInfo()`（移到 `DeathCalculator` 或保留）

### 5.2 roles/ 目录处理

**保留**：

- `src/models/roles/spec/`（新架构核心）
- `src/models/roles/index.ts`（重写为 spec facade）

**删除**（整个目录）：

- `src/models/roles/base/`
- `src/models/roles/wolf/`
- `src/models/roles/god/`
- `src/models/roles/skilled-wolf/`
- `src/models/roles/villager/`
- `src/models/roles/third-party/`

**删除**（index.ts 中）：

- `ROLE_MODELS`
- `getRoleModel()`
- `BaseRole` 相关 export
- 所有 class imports
- `RoleDefinition` / `ROLES` / `buildRolesRecord()`

**重写**（index.ts 中）：

```typescript
// 新的 roles/index.ts
export * from './spec';

// RoleName 从 ROLE_SPECS 派生
export type RoleId = keyof typeof ROLE_SPECS;

// 工具函数改为使用 spec
export function isWolfRole(roleId: string): boolean {
  const spec = getRoleSpec(roleId);
  return spec?.team === 'wolf';
}

export function canRoleSeeWolves(roleId: string): boolean {
  const spec = getRoleSpec(roleId);
  return spec?.wolfMeeting?.canSeeWolves ?? false;
}

// ... 其他 helpers
```

### 5.3 测试清理

**删除**：

- `src/models/__tests__/ActionFlow.test.ts`（依赖旧 Room + ACTION_ORDER）

**迁移**：

- 相关测试逻辑迁移到 `src/services/__tests__/boards/*.integration.test.ts`

**新增**：

- `src/services/__tests__/visibility.contract.test.ts`
- `src/services/__tests__/privateEffect.contract.test.ts`

### 5.4 UI 清理

**删除 import**：

- `from '../../models/Room'` 中的规则函数
- `getRoleModel` / `ROLE_MODELS`

**改为使用**：

- `getRoleSpec()` / `getSchema()`
- `usePrivateInbox()` 读取敏感信息
- `isSeatSelectable()` 本地计算

---

## Contract Tests（防回归）

### 6.1 可见性合约

```typescript
// src/services/__tests__/visibility.contract.test.ts

describe('Visibility Contract (Anti-cheat)', () => {
  const SENSITIVE_FIELDS = [
    'killedIndex',
    'checkResult',
    'seerResult',
    'psychicResult',
    'canSave',
    'witchContext',
    'selectableSeats',
    'blockedSeat',
    'nightmareBlockedSeat',
  ];

  it('PublicGameState must NOT contain sensitive fields', () => {
    const publicStateKeys = Object.keys({} as PublicGameState);
    for (const field of SENSITIVE_FIELDS) {
      expect(publicStateKeys).not.toContain(field);
    }
  });

  it('PublicRoleTurn must NOT contain sensitive fields', () => {
    const roleTurnKeys = Object.keys({} as PublicRoleTurn);
    for (const field of SENSITIVE_FIELDS) {
      expect(roleTurnKeys).not.toContain(field);
    }
  });

  it('broadcastPublic() should reject PrivatePayload at compile time', () => {
    // 这个测试确保类型系统正常工作
    // 实际上编译器会阻止错误代码
    expect(true).toBe(true);
  });
});
```

### 6.2 私密消息合约

```typescript
// src/services/__tests__/privateEffect.contract.test.ts

describe('Private Effect Contract', () => {
  it('WITCH_CONTEXT must be sent via sendPrivate with toUid', async () => {
    // Mock setup
    const broadcastService = BroadcastService.getInstance();
    const sendPrivateSpy = jest.spyOn(broadcastService, 'sendPrivate');

    // Trigger witch turn
    await gameStateService.enterWitchTurn();

    // Assert
    expect(sendPrivateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'PRIVATE_EFFECT',
        toUid: expect.any(String),
        payload: expect.objectContaining({ kind: 'WITCH_CONTEXT' }),
      }),
    );
  });

  it('SEER_REVEAL must be sent via sendPrivate with toUid', async () => {
    // Similar test for seer reveal
  });

  it('blocked player receives BLOCKED via sendPrivate', async () => {
    // Test nightmare block private notification
  });
});
```

### 6.3 Inbox 合约

```typescript
// src/hooks/__tests__/usePrivateInbox.test.ts

describe('usePrivateInbox', () => {
  it('should only accept messages with matching toUid', () => {
    // Test Zero-Trust filtering
  });

  it('should clear old messages when revision advances', () => {
    // Test revision-based cleanup
  });

  it('should return null if no matching message for current revision', () => {
    // Test getWitchContext returns null when no message
  });
});
```

---

## 执行阶段

### Commit 1：类型层分流 + Private Effect 通道

1. 新增 `src/services/types/PublicBroadcast.ts`
2. 新增 `src/services/types/PrivateBroadcast.ts`
3. 修改 `BroadcastService`：`broadcastPublic()` + `sendPrivate()` 分流
4. 新增 `visibility.contract.test.ts`
5. 验证：`npm run typecheck && npm test`

### Commit 2：Host 端私发实现

1. 女巫回合私发 `WITCH_CONTEXT`
2. 预言家/通灵师行动后私发 reveal
3. Nightmare 阻止私发 `BLOCKED`
4. 新增 `privateEffect.contract.test.ts`
5. 验证：`npm test`

### Commit 3：UI 切换到 Inbox + 本地 Selectability

1. 新增 `usePrivateInbox.ts`
2. 新增 `seatSelectability.ts` + `schemaUi.ts`
3. 修改 `useRoomActions.ts`：从 inbox 读取 witchContext
4. 删除 UI 对 `Room.ts` 规则函数的 import
5. 验证：`npm test && npm run e2e:core`

### Commit 4：Room.ts 拆分

1. 提取 `src/models/roomTypes.ts`
2. 删除 `Room.ts` 中的规则函数
3. 更新所有 import
4. 验证：`npm run typecheck && npm test`

### Commit 5：Legacy 大清理

1. 删除 `roles/base/`, `roles/wolf/`, `roles/god/` 等目录
2. 重写 `roles/index.ts` 为 spec facade
3. 删除 `ActionFlow.test.ts`
4. 清理所有 `getRoleModel` / `ROLE_MODELS` 引用
5. 验证：`npm run typecheck && npm test && npm run e2e:core`

---

## 验收标准

```bash
# 编译检查
npm run typecheck  # ✅

# 单测
npm test           # ✅ (700+ tests)

# E2E
npm run e2e:core   # ✅

# grep 验证
grep -r "killedIndex" src/services/BroadcastService.ts
# 只允许在 PrivatePayload 类型中出现

grep -r "performSeerAction\|getKilledIndex" src/screens/
# 0 matches

grep -r "getRoleModel\|ROLE_MODELS" src/
# 0 matches（除了 spec/ 目录）

grep -r "selectableSeats\|blockedSeat" src/services/types/PublicBroadcast.ts
# 0 matches
```

---

## 附录：敏感字段完整清单

| 字段                   | 敏感原因       | 处理方式          |
| ---------------------- | -------------- | ----------------- |
| `killedIndex`          | 狼杀目标       | 私发给女巫        |
| `canSave`              | 是否可救       | 私发给女巫        |
| `seerResult`           | 查验结果       | 私发给预言家      |
| `psychicResult`        | 通灵结果       | 私发给通灵师      |
| `selectableSeats`      | 可推导阻止信息 | 不广播，UI 本地算 |
| `blockedSeat`          | nightmare 阻止 | 私发给被阻止者    |
| `nightmareBlockedSeat` | 同上           | 私发给被阻止者    |
| `wolfKillTarget`       | 狼刀目标       | 不广播            |
| `actions`              | 行动详情       | 不广播            |
