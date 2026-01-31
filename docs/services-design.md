# 服务层设计文档（仅第一夜 + 遵守 Guardrails）

> **版本**: v5.1（Phase 1 可落地版）
> **状态**: 已批准，可执行 Phase 1 实现
> **范围**: 仅第一夜（Night-1 only）；不涉及跨夜状态
> **最后更新**: 2026-01-21

---

## 目录

1. [摘要（Executive Summary）](#1-摘要executive-summary)
2. [架构总览](#2-架构总览)
3. [决策日志（Decision Log）](#3-决策日志decision-log)
4. [协议层契约（Protocol Layer Contract）](#4-协议层契约protocol-layer-contract)
5. [状态归一化契约（Normalization Contract）](#5-状态归一化契约normalization-contract)
6. [边界规则（Boundary Rules）](#6-边界规则boundary-rules)
7. [目录结构](#7-目录结构)
8. [Phase 1 实现补丁清单（Implementation Patchlist）](#8-phase-1-实现补丁清单implementation-patchlist)
9. [测试清单（Test Checklist）](#9-测试清单test-checklist)
10. [迁移计划（Migration Plan）](#10-迁移计划migration-plan)
11. [风险登记表（Risk Registry）](#11-风险登记表risk-registry)
12. [验收清单（Acceptance Checklist）](#12-验收清单acceptance-checklist)
13. [术语表（Glossary）](#13-术语表glossary)

---

## 1. 摘要（Executive Summary）

### 问题陈述

- **上帝类（God Class）**: `GameStateService.ts` 有 2724 行代码，承担 12+ 项职责
- **主机/玩家状态分裂**: 40+ 处 `isHost` 分支导致"经常漏 host state / UI render"
- **无快照恢复能力**: 执行状态（actions、currentNightResults）未包含在线协议（wire protocol）中

### 解决方案

- **单一状态形态（Single State Shape）**: `GameState ≡ BroadcastGameState`（广播游戏状态），主机和玩家持有完全相同的类型
- **单一职责模块（SRP Modules）**: 将上帝类拆分为 store、handlers、intents、reducer
- **协议优先（Protocol-first）**: 所有执行状态都包含在 `BroadcastGameState` 中，支持快照恢复
- **工厂依赖注入（Factory DI）**: 使用 `ServiceFactory` 模式切换实现

### 硬性约束（不可违反）

- ❌ 不得引入仅主机状态字段（host-only state）
- ❌ 不得发明平行的线协议（wire protocol）；一切在"线上传输"仍以 `PlayerMessage`（玩家消息）/ `HostBroadcast`（主机广播消息）作为唯一合约
  - ✅ 可选字段的语义说明：`BroadcastGameState` 中的可选字段是**业务语义上可选**的，而非"迁移期临时可选"：
    - 状态依赖字段（`currentStepId`、`actions`、`currentNightResults`）：仅在 `status=ongoing` 时存在
    - 角色依赖字段（`witchContext`、`seerReveal`、`wolfRobotContext` 等）：仅在该角色参与时存在
    - 事件驱动字段（`pendingRevealAcks`、`actionRejected`）：仅在特定事件发生时存在
  - �� 禁止：引入 `NewPlayerMessage` / `NewHostBroadcast` / `PrivateEffect` 等平行协议，或同时维护两份 state shape
- ❌ 运行时不得从 legacy 导入
- ❌ 玩家（Player）不得执行 resolver/reducer/夜晚推进/死亡结算
- ✅ 所有现有测试必须通过

---

## 2. 架构总览
## 2. 架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                         主机设备（HOST DEVICE）                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Intent (UI 动作)                                               │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────┐                                            │
│  │ IntentDispatcher │ ─── 验证 intent 形态                      │
│  └────────┬────────┘                                            │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                            │
│  │    Handler      │ ─── 调用 resolver（纯函数）                 │
│  │  （仅主机）      │     计算状态增量（state delta）            │
│  └────────┬────────┘                                            │
│           │ 返回 StateAction                                    │
│           ▼                                                     │
│  ┌─────────────────┐                                            │
│  │    Reducer      │ ─── 纯函数: (state, action) => newState    │
│  │  （仅主机）      │                                            │
│  └────────┬────────┘                                            │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐      ┌────────────────────┐                │
│  │   GameStore     │─────▶│  normalizeState()  │                │
│  │ （状态持有者）   │      │  （core/state/）    │                │
│  └────────┬────────┘      └────────────────────┘                │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                            │
│  │   Transport     │ ─── 包装 BroadcastService                  │
│  │   Adapter       │     发送 STATE_UPDATE                      │
│  └────────┬────────┘                                            │
│           │                                                     │
└───────────┼─────────────────────────────────────────────────────┘
            │
            │  Supabase Realtime Broadcast
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       玩家设备（PLAYER DEVICE）                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐                                            │
│  │   Transport     │ ─── 接收 STATE_UPDATE                      │
│  │   Adapter       │                                            │
│  └────────┬────────┘                                            │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                            │
│  │   GameStore     │ ─── 版本号检查:                            │
│  │ （状态持有者）   │     if (incoming.rev > local.rev)          │
│  └────────┬────────┘         applySnapshot(incoming)            │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                            │
│  │       UI        │ ─── 读取状态，按 myRole 过滤显示            │
│  └─────────────────┘                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 决策日志（Decision Log）

### 决策 A：协议类型的单一真相（Single Source of Truth）

| 选项   | 描述                             | 结论                        |
| ------ | -------------------------------- | --------------------------- |
| A1     | 类型保留在 `BroadcastService.ts` | ❌ 拒绝：耦合传输层与协议层 |
| **A2** | 提取到 `protocol/types.ts`       | ✅ **选定**：清晰分离       |

**迁移规则**:

1. `protocol/types.ts` 成为 `BroadcastGameState`、`HostBroadcast`、`PlayerMessage` 的**唯一权威定义**
2. `BroadcastService.ts` **删除**本地类型定义，从 protocol 导入
3. **所有其他文件**从 `services/protocol` 导入，禁止从 `BroadcastService` 导入这些类型

### 决策 B：ProtocolAction（协议动作记录）键策略

| 选项   | 描述                                                               | 结论                                    |
| ------ | ------------------------------------------------------------------ | --------------------------------------- |
| B1     | `Record<SchemaId, ProtocolAction>`                                 | ❌ 拒绝：同一 schemaId 可能有多个 actor |
| B2     | `Record<string, ProtocolAction>`，key = `${schemaId}:${actorSeat}` | ⚠️ 可行但需解析复杂 key                 |
| **B3** | `ProtocolAction[]` 数组                                            | ✅ **选定**：最稳定，无 key 冲突        |

**理由**: 数组最稳定——无键冲突、无需解析、易于遍历。

### 决策 C：Seat-map 线协议键规范

| 选项   | 描述                                 | 结论                                          |
| ------ | ------------------------------------ | --------------------------------------------- |
| C1     | 使用 `Record<number, T>`             | ❌ 拒绝：JSON 序列化后 number key 变成 string |
| **C2** | **新增字段**使用 `Record<string, T>` | ✅ **选定**：显式，无 TS 假象                 |

**Phase 1 迁移期策略（重要）**:

| 字段             | Phase 1 类型                              | 说明                                                        |
| ---------------- | ----------------------------------------- | ----------------------------------------------------------- |
| `players`        | `Record<number, BroadcastPlayer \| null>` | **保持现状不改**（现有代码/测试大量依赖）                   |
| `currentNightResults.wolfVotesBySeat` | `Record<string, number>`     | wolf 投票 seat-map（seat → target），string key             |

**后续 Phase（可选）**: 如果要把 `players` 也改成 `Record<string, ...>`，必须作为**单独 migration PR**，全量修改测试；不属于 Phase 1 范围。

### 决策 D：Resolver 目录不移动

| 选项   | 描述                                              | 结论                              |
| ------ | ------------------------------------------------- | --------------------------------- |
| D1     | Phase 1 移动 `night/resolvers` → `core/resolvers` | ❌ 拒绝：大量测试依赖路径         |
| **D2** | Phase 1 **不移动** resolver 目录                  | ✅ **选定**：遵守 repo guardrails |

**规则**:

- `src/services/night/resolvers/**` 保持原位
- 如果未来需要重组目录，放到 Phase 3+（可选），且必须：
  - 作为纯重构 PR，不改变行为
  - 先有 import-boundary/contract tests 保驾护航

---

## 4. 协议层契约（Protocol Layer Contract）

### 4.1 类型权威（单一定义）

```typescript
// src/services/protocol/types.ts — 唯一权威定义

// ⚠️ 以现有 repo 导出路径为准
import type { RoleId } from '../../models/roles'; // 从 models/roles 导入（现有导出）
import type { SchemaId } from '../../models/roles/spec'; // 从 models/roles/spec 导入（现有导出）
import type { CurrentNightResults } from '../night/resolvers/types'; // 单一真相（保持原位）

// =============================================================================
// 协议动作记录（ProtocolAction）— 线安全、稳定
// =============================================================================

/** 用于线传输的动作记录 */
export interface ProtocolAction {
  readonly schemaId: SchemaId; // type-only import，稳定契约
  readonly actorSeat: number;
  readonly targetSeat?: number;
  readonly timestamp: number;
}

// =============================================================================
// 广播玩家（BroadcastPlayer）
// =============================================================================

export interface BroadcastPlayer {
  uid: string;
  seatNumber: number;
  displayName?: string;
  avatarUrl?: string;
  role?: RoleId | null;
  hasViewedRole: boolean;
}

// =============================================================================
// 广播游戏状态（BroadcastGameState）— 线协议
// =============================================================================

export interface BroadcastGameState {
  // --- 核心字段（现有） ---
  roomCode: string;
  hostUid: string;
  status: 'unseated' | 'seated' | 'assigned' | 'ready' | 'ongoing' | 'ended';
  templateRoles: RoleId[];

  // ⚠️ Phase 1: players 保持 Record<number, ...> 不改，与现有实现一致
  players: Record<number, BroadcastPlayer | null>;

  currentActionerIndex: number;
  isAudioPlaying: boolean;

  // --- 执行状态（可选，向后兼容） ---
  /** 第一夜动作记录 */
  actions?: ProtocolAction[];

  /** 当前夜晚累积结果（type-only from resolver types，单一真相） */
  currentNightResults?: CurrentNightResults;

  /** 待确认的揭示确认 */
  pendingRevealAcks?: string[];

  /** 上一夜死亡 */
  lastNightDeaths?: number[];

  // --- 梦魇封锁 ---
  nightmareBlockedSeat?: number;
  wolfKillDisabled?: boolean;

  // --- 角色特定上下文（全部公开，UI 按 myRole 过滤） ---
  witchContext?: {
    killedIndex: number;
    canSave: boolean;
    canPoison: boolean;
  };

  seerReveal?: {
    targetSeat: number;
    result: '好人' | '狼人';
  };

  psychicReveal?: {
    targetSeat: number;
    result: string;
  };

  gargoyleReveal?: {
    targetSeat: number;
    result: string;
  };

  wolfRobotReveal?: {
    targetSeat: number;
    result: string;
  };

  confirmStatus?: {
    role: 'hunter' | 'darkWolfKing';
    canShoot: boolean;
  };

  actionRejected?: {
    action: string;
    reason: string;
    targetUid: string;
  };
}

// =============================================================================
// 主机广播消息（HostBroadcast）
// =============================================================================

export type HostBroadcast =
  | { type: 'STATE_UPDATE'; state: BroadcastGameState; revision: number }
  | {
      type: 'ROLE_TURN';
      role: RoleId;
      pendingSeats: number[];
      killedIndex?: number;
      stepId?: SchemaId;
    }
  | { type: 'NIGHT_END'; deaths: number[] }
  | { type: 'PLAYER_JOINED'; seat: number; player: BroadcastPlayer }
  | { type: 'PLAYER_LEFT'; seat: number }
  | { type: 'GAME_RESTARTED' }
  | { type: 'SEAT_REJECTED'; seat: number; requestUid: string; reason: 'seat_taken' }
  | {
      type: 'SEAT_ACTION_ACK';
      requestId: string;
      toUid: string;
      success: boolean;
      seat: number;
      reason?: string;
    }
  | {
      type: 'SNAPSHOT_RESPONSE';
      requestId: string;
      toUid: string;
      state: BroadcastGameState;
      revision: number;
    };

// =============================================================================
// 玩家消息（PlayerMessage）
// =============================================================================

export type PlayerMessage =
  | { type: 'REQUEST_STATE'; uid: string }
  | { type: 'JOIN'; seat: number; uid: string; displayName: string; avatarUrl?: string }
  | { type: 'LEAVE'; seat: number; uid: string }
  | { type: 'ACTION'; seat: number; role: RoleId; target: number | null; extra?: any }
  | { type: 'WOLF_VOTE'; seat: number; target: number }
  | { type: 'VIEWED_ROLE'; seat: number }
  | { type: 'REVEAL_ACK'; seat: number; role: RoleId; revision: number }
  | {
      type: 'SEAT_ACTION_REQUEST';
      requestId: string;
      action: 'sit' | 'standup';
      seat: number;
      uid: string;
      displayName?: string;
      avatarUrl?: string;
    }
  | { type: 'SNAPSHOT_REQUEST'; requestId: string; uid: string; lastRevision?: number };
```

### 4.2 ProtocolAction 稳定性保证

**为什么不会漂移（drift）**:

1. `SchemaId` 是从 `models/roles/spec` 的 type-only import（单一真相）
2. `ProtocolAction[]` 数组无 key 冲突问题
3. 所有字段都是原始类型 + 稳定类型引用
4. 边界契约测试（boundary test）验证 `ProtocolAction` 只使用线安全类型

---

## 5. 状态归一化契约（Normalization Contract）

### 5.1 位置

```
src/services/core/state/normalize.ts  ← 运行时代码（不在 protocol/）
```

### 5.2 实现

```typescript
// src/services/core/state/normalize.ts

import type { BroadcastGameState } from '../../protocol/types';

/**
 * 规范化座位键记录（canonicalize），确保所有 key 都是 string。
 * 用于任何 Record<string, T> 在运行时可能收到 number key 的场景。
 */
export function canonicalizeSeatKeyRecord<T>(
  record: Record<string | number, T> | undefined,
): Record<string, T> | undefined {
  if (record === undefined) return undefined;
  const result: Record<string, T> = {};
  for (const [k, v] of Object.entries(record)) {
    result[String(k)] = v;
  }
  return result;
}

/**
 * 广播前归一化状态（normalizeState）。
 * - 填充可选字段的默认值
 * - 规范化 seat-map 键为 string（仅新增字段）
 */
export function normalizeState(raw: Partial<BroadcastGameState>): BroadcastGameState {
  // ⚠️ 设计意图（Phase 1）
  // - normalize 的核心职责是：形态规范化（canonicalize keys）
  // - 对“旧的核心必填字段”（roomCode/hostUid/status 等）在真实运行中更推荐 fail-fast，避免用默认值掩盖状态损坏
  // - 如果需要为测试工厂提供便捷默认值，建议拆分：
  //   - normalizeStateForBroadcast(state: BroadcastGameState): BroadcastGameState
  //   - normalizeStateForTests(partial: Partial<BroadcastGameState>): BroadcastGameState

  // 规范化 seat-map 字段（仅新增字段）
  const currentNightResults = raw.currentNightResults;
  const wolfVotesBySeat = canonicalizeSeatKeyRecord(currentNightResults?.wolfVotesBySeat);

  return {
    // 必填字段默认值
    roomCode: raw.roomCode ?? '',
    hostUid: raw.hostUid ?? '',
    status: raw.status ?? 'unseated',
    templateRoles: raw.templateRoles ?? [],
    // ⚠️ Phase 1: players 保持原样，不做 key 规范化
    players: raw.players ?? {},
    currentActionerIndex: raw.currentActionerIndex ?? -1,
    isAudioPlaying: raw.isAudioPlaying ?? false,

    // 执行状态（可选，无需默认值）
    actions: raw.actions,
    currentNightResults: {
      ...currentNightResults,
      wolfVotesBySeat,
    },
    pendingRevealAcks: raw.pendingRevealAcks,
    lastNightDeaths: raw.lastNightDeaths,

    // 其他可选字段（透传）
    nightmareBlockedSeat: raw.nightmareBlockedSeat,
    wolfKillDisabled: raw.wolfKillDisabled,
    witchContext: raw.witchContext,
    seerReveal: raw.seerReveal,
    psychicReveal: raw.psychicReveal,
    gargoyleReveal: raw.gargoyleReveal,
    wolfRobotReveal: raw.wolfRobotReveal,
    confirmStatus: raw.confirmStatus,
    actionRejected: raw.actionRejected,
  };
}
```

### 5.3 不变量

| 规则                           | 描述                                                               |
| ------------------------------ | ------------------------------------------------------------------ |
| **新增字段 keys 是 string**    | `currentNightResults.wolfVotesBySeat` 等 seat-map 字段的 key 是 string |
| **players 保持现状**           | Phase 1 不改动 `players` 的 key 类型                               |
| **seat-map keys 规范化**       | 对 `currentNightResults.wolfVotesBySeat` 等 seat-map 做 key canonicalization（number → string） |
| **广播前归一化**               | 主机在每次 `STATE_UPDATE` 前调用 `normalizeState(state)`           |

> 注：`normalizeState()` 不是“容错恢复器”。
> 它的职责是“形态规范化 + 派生字段”。如果核心必填状态缺失，更推荐在主机的存储/恢复路径 fail-fast 并打日志。

---

## 6. 边界规则（Boundary Rules）

### 6.1 模块边界矩阵

| 模块         | 允许的导入                                                       | 禁止的导入                          |
| ------------ | ---------------------------------------------------------------- | ----------------------------------- |
| `protocol/`  | `import type` from `models/**`, `services/night/resolvers/types` | 任何运行时导入；任何 transport 导入 |
| `core/`      | `import type` from protocol；import from `models/**`             | 运行时导入 transport                |
| `transport/` | 从 protocol 导入（types）；导入 supabase                         | 从 engine、legacy 导入                  |
| `legacy/`    | 任意（迁移期豁免）                                               | —                                   |
| `engine/        | 从 protocol、core 导入                                           | 运行时导入 legacy                   |

### 6.2 执法策略

```typescript
// src/services/__tests__/boundary.contract.test.ts

import * as fs from 'fs';
import * as path from 'path';

const SERVICES_DIR = path.join(__dirname, '..');

// 正则模式
const RUNTIME_IMPORT = /^import\s+(?!type\s)/; // "import X" 但不是 "import type X"
const TYPE_ONLY_IMPORT = /^import\s+type\s/;

function getImports(filePath: string): { runtime: string[]; typeOnly: string[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const runtime: string[] = [];
  const typeOnly: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (TYPE_ONLY_IMPORT.test(trimmed)) {
      typeOnly.push(trimmed);
    } else if (RUNTIME_IMPORT.test(trimmed)) {
      runtime.push(trimmed);
    }
  }
  return { runtime, typeOnly };
}

describe('模块边界契约（Module Boundary Contract）', () => {
  describe('protocol/ 层', () => {
    const protocolDir = path.join(SERVICES_DIR, 'protocol');

    it('types.ts 无运行时导入', () => {
      const typesPath = path.join(protocolDir, 'types.ts');
      if (!fs.existsSync(typesPath)) return; // Phase 0 跳过

      const { runtime } = getImports(typesPath);
      expect(runtime).toEqual([]);
    });

    it('types.ts 不导出函数', () => {
      const typesPath = path.join(protocolDir, 'types.ts');
      if (!fs.existsSync(typesPath)) return;

      const content = fs.readFileSync(typesPath, 'utf-8');
      // 不应有 "export function" 或 "export const ... = (...) =>"
      expect(content).not.toMatch(/export\s+(async\s+)?function\s/);
      expect(content).not.toMatch(/export\s+const\s+\w+\s*=\s*\([^)]*\)\s*=>/);

      // protocol/ 必须是纯类型层：禁止任何 value export
      expect(content).not.toMatch(/export\s+enum\s/);
      // e.g. "export const X = 1" / "export const X = {}"（但不误伤 "export const X = () =>"，后者已在上一条覆盖）
      expect(content).not.toMatch(/export\s+const\s+\w+\s*=\s*(?!\s*\()/);
    });
  });

  describe('core/ 层', () => {
    it('core/ 不运行时导入 transport/', () => {
      const coreDir = path.join(SERVICES_DIR, 'core');
      if (!fs.existsSync(coreDir)) return;

      const files = getAllTsFiles(coreDir);
      for (const filePath of files) {
        const { runtime } = getImports(filePath);
        for (const imp of runtime) {
          expect(imp).not.toMatch(/from\s+['"].*transport/);
        }
      }
    });
  });

  describe('engine/ 层', () => {
    it('engine/ 不运行时导入 legacy/', () => {
      const engineDir = path.join(SERVICES_DIR, 'engine');
      if (!fs.existsSync(engineDir)) return;

      const files = getAllTsFiles(engineDir);
      for (const filePath of files) {
        const { runtime } = getImports(filePath);
        for (const imp of runtime) {
          expect(imp).not.toMatch(/from\s+['"].*legacy/);
        }
      }
    });
  });

  describe('BroadcastService 类型迁移', () => {
    it('BroadcastService.ts 不导出 BroadcastGameState 接口', () => {
      const bsPath = path.join(SERVICES_DIR, 'BroadcastService.ts');
      const content = fs.readFileSync(bsPath, 'utf-8');
      // 迁移完成后，这些应该被删除
      expect(content).not.toMatch(/export\s+interface\s+BroadcastGameState\b/);
    });

    it('BroadcastService.ts 不导出 HostBroadcast 类型', () => {
      const bsPath = path.join(SERVICES_DIR, 'BroadcastService.ts');
      const content = fs.readFileSync(bsPath, 'utf-8');
      expect(content).not.toMatch(/export\s+type\s+HostBroadcast\b/);
    });

    it('BroadcastService.ts 不导出 PlayerMessage 类型', () => {
      const bsPath = path.join(SERVICES_DIR, 'BroadcastService.ts');
      const content = fs.readFileSync(bsPath, 'utf-8');
      expect(content).not.toMatch(/export\s+type\s+PlayerMessage\b/);
    });

    it('protocol/types.ts 导出 BroadcastGameState', () => {
      const typesPath = path.join(SERVICES_DIR, 'protocol', 'types.ts');
      if (!fs.existsSync(typesPath)) return; // Phase 0 跳过

      const content = fs.readFileSync(typesPath, 'utf-8');
      expect(content).toMatch(/export\s+interface\s+BroadcastGameState\b/);
    });
  });
});

// 辅助函数：递归获取所有 .ts 文件（排除 .test.ts）
function getAllTsFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}
```

### 6.3 关键区分

| 模式                           | 含义                   | 在 protocol/ 中允许？ |
| ------------------------------ | ---------------------- | --------------------- |
| `import type { X } from '...'` | 仅类型导入，运行时擦除 | ✅ 是                 |
| `import { X } from '...'`      | 运行时导入             | ❌ 否                 |
| `export function X() {}`       | 运行时导出             | ❌ 否                 |
| `export interface X {}`        | 类型导出               | ✅ 是                 |

---

## 7. 目录结构

```
src/services/
├── protocol/                          # 纯类型，无运行时代码
│   └── types.ts                       # BroadcastGameState, HostBroadcast, PlayerMessage, ProtocolAction
│
├── transport/                         # Supabase Realtime（有副作用）
│   └── index.ts                       # 重导出 BroadcastService
│
├── core/                              # 纯逻辑，可被任何层使用
│   ├── state/
│   │   ├── normalize.ts               # normalizeState(), canonicalizeSeatKeyRecord()
│   │   └── __tests__/
│   │       └── normalize.contract.test.ts
│   └── index.ts                       # 重导出
│
├── night/
│   └── resolvers/                     # ⚠️ Phase 1 保持原位，不移动
│       ├── types.ts                   # CurrentNightResults 等（单一真相）
│       └── *.ts
│
├── legacy/                            # 仅旧 God Service（迁移期）
│   └── GameStateService.ts            # 从现有位置移入
│
├── engine/                                # 新实现（Phase 5）
│   ├── store/
│   ├── handlers/
│   ├── intents/
│   ├── reducer/
│   └── index.ts
│
├── factory.ts                         # ServiceFactory 依赖注入
├── BroadcastService.ts                # 保留，但删除类型定义
├── NightFlowController.ts             # Phase 1 保持原位
├── DeathCalculator.ts                 # Phase 1 保持原位
└── __tests__/
    ├── boundary.contract.test.ts      # 边界规则测试
    └── ...现有测试...
```

---

## 8. Phase 1 实现补丁清单（Implementation Patchlist）

### Phase 1A：协议提取 + 边界测试

| 文件                                                       | 动作     | 改动点                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/protocol/types.ts`                           | **新建** | 定义 `BroadcastGameState`、`HostBroadcast`、`PlayerMessage`、`ProtocolAction`、`BroadcastPlayer`；import 路径以 repo 现有导出为准                                                                                                                                                                                                   |
| `src/services/BroadcastService.ts`                         | **修改** | 1. 删除 `interface BroadcastPlayer`（约 96-103 行）<br>2. 删除 `interface BroadcastGameState`（约 106-167 行）<br>3. 删除 `type HostBroadcast`（约 37-63 行）<br>4. 删除 `type PlayerMessage`（约 66-85 行）<br>5. 添加 `import type { BroadcastGameState, HostBroadcast, PlayerMessage, BroadcastPlayer } from './protocol/types'` |
| `src/services/__tests__/GameStateService.recovery.test.ts` | **修改** | `import type { BroadcastGameState } from '../BroadcastService'` → `import type { BroadcastGameState } from '../protocol/types'`                                                                                                                                                                                                     |
| `src/services/__tests__/boards/hostGameFactory.ts`         | **修改** | `import type { PlayerMessage } from '../../BroadcastService'` → `import type { PlayerMessage } from '../../protocol/types'`                                                                                                                                                                                                         |
| `src/services/__tests__/boundary.contract.test.ts`         | **新建** | 边界执法测试（见第 6.2 节）                                                                                                                                                                                                                                                                                                         |

### Phase 1B：归一化层

| 文件                                                           | 动作     | 改动点                                                                      |
| -------------------------------------------------------------- | -------- | --------------------------------------------------------------------------- |
| `src/services/core/state/normalize.ts`                         | **新建** | `normalizeState()`、`canonicalizeSeatKeyRecord()` |
| `src/services/core/state/__tests__/normalize.contract.test.ts` | **新建** | 归一化测试（见第 9 节）                                                     |
| `src/services/core/index.ts`                                   | **新建** | 重导出 normalize 函数                                                       |

### Phase 1C：Legacy 隔离

| 文件                                      | 动作     | 改动点                                                  |
| ----------------------------------------- | -------- | ------------------------------------------------------- |
| `src/services/legacy/GameStateService.ts` | **移动** | 从 `src/services/GameStateService.ts`                   |
| `src/services/GameStateService.ts`        | **修改** | 改为重导出：`export * from './legacy/GameStateService'` |

### Phase 1 不做的事情

| 事项                          | 原因                                       |
| ----------------------------- | ------------------------------------------ |
| 移动 `night/resolvers/**`     | Repo guardrails 明确禁止；大量测试依赖路径 |
| 移动 `NightFlowController.ts` | Phase 1 不需要；可选 Phase 3+              |
| 移动 `DeathCalculator.ts`     | Phase 1 不需要；可选 Phase 3+              |
| 修改 `players` 的 key 类型    | 现有代码/测试大量依赖；需单独 migration PR |

---

## 9. 测试清单（Test Checklist）

### 9.1 新增测试

| 文件                         | 测试用例                                             | 断言                                                 |
| ---------------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| `boundary.contract.test.ts`  | `protocol/types.ts 无运行时导入`                     | Regex 扫描找不到 `import X from`（仅 `import type`） |
| `boundary.contract.test.ts`  | `protocol/types.ts 不导出函数`                       | 无 `export function` 或 `export const = () =>`       |
| `boundary.contract.test.ts`  | `BroadcastService.ts 不导出 BroadcastGameState 接口` | Phase 1 完成后通过                                   |
| `boundary.contract.test.ts`  | `BroadcastService.ts 不导出 HostBroadcast 类型`      | Phase 1 完成后通过                                   |
| `boundary.contract.test.ts`  | `BroadcastService.ts 不导出 PlayerMessage 类型`      | Phase 1 完成后通过                                   |
| `boundary.contract.test.ts`  | `protocol/types.ts 导出 BroadcastGameState`          | Regex 找到 `export interface BroadcastGameState`     |
| `boundary.contract.test.ts`  | `engine/ 不运行时导入 legacy/`                           | 扫描所有 engine/ 文件                                    |
| `boundary.contract.test.ts`  | `core/ 不运行时导入 transport/`                      | 扫描所有 core/ 文件                                  |
| `normalize.contract.test.ts` | `规范化 wolfVotesBySeat keys 为 string`             | `{ 1: 3 }` → `{ '1': 3 }`                            |
| `normalize.contract.test.ts` | `填充必填字段默认值`                                 | 空输入 → 有效的 BroadcastGameState                   |
| `normalize.contract.test.ts` | `players 不做 key 规范化`                            | Phase 1 保持 number key 不变                         |

### 9.2 现有测试验证

Phase 1 完成后，所有 `src/services/__tests__/` 现有测试必须继续通过：

```bash
npm test -- --testPathPattern="src/services/__tests__"
```

---

## 10. 迁移计划（Migration Plan）

### Phase 1：协议提取 + 边界测试（第 1 周）

1. 创建 `src/services/protocol/types.ts`
2. 从 `BroadcastService.ts` 迁移类型
3. 更新所有导入路径
4. 添加边界契约测试
5. **门槛**: 所有现有测试通过 + 边界测试通过

### Phase 2：归一化层（第 1-2 周）

1. 创建 `src/services/core/state/normalize.ts`
2. 添加归一化契约测试
3. 在主机广播路径集成 normalize
4. **门槛**: 归一化测试通过 + 现有测试通过

### Phase 3：Legacy 隔离（第 2 周）

1. 移动 `GameStateService.ts` → `legacy/`
2. 添加重导出 shim
3. **门槛**: 所有现有测试通过

### Phase 4：Cutover & Legacy Removal ✅

> **状态**: 已完成（2026-01-24）

目标：运行时只剩当前路径，删除所有 legacy runtime 代码与测试。

**Batch 1+2**: 删除 legacy boards integration + 旧 runtime tests
- **Commit**: `e2463f5`
- **删除内容**: `src/services/__tests__/boards/**` (10 integration tests + hostGameFactory.ts)、`GameStateService.*.test.ts` (11 files)、`NightFlowController.test.ts`、`WolfVoteResolver.test.ts`、`boundary.contract.test.ts`、`wolfKillNeutral.contract.test.ts`
- **diff stat**: 27 files changed, 7125 deletions

**Batch 3**: 删除 legacy GameStateService 代码
- **Commit**: `487bb33`
- **删除内容**: `src/services/legacy/GameStateService.ts` (2733 lines)、`src/services/GameStateService.ts` (re-export)
- **diff stat**: 6 files changed, 2902 deletions

**门禁验证**:
- `grep -rn "services/legacy" src App.tsx` → 0 matches（仅 legacyRuntimeGate.contract.test.ts 断言）
- `ls src/services/legacy/` → Directory does not exist
- `ls src/services/__tests__/boards/` → Directory does not exist
- `npm test` → 95 suites, 1543 tests PASS
- 集成测试门禁 → 3 suites, 28 tests PASS

**门槛**: legacy 目录不存在 + 全量测试通过 + 集成测试门禁 通过

### Phase 5：Core 整合（可选，第 3 周+）

1. 移动 `NightFlowController.ts` → `core/`
2. 移动 `DeathCalculator.ts` → `core/`
3. 添加重导出 shims
4. **门槛**: 所有现有测试通过

### Phase 6：实现完善（第 3-4 周）

1. 实现 `GameStore`、`Reducer`、`Handlers`
2. 实现 `ServiceFactory`
3. 添加专用测试
4. **门槛**: 所有测试通过，feature-flag 生效

---

## 11. 风险登记表（Risk Registry）

| #   | 风险                                              | 可能性 | 影响 | 缓解措施                                     | 验证方式                                            |
| --- | ------------------------------------------------- | ------ | ---- | -------------------------------------------- | --------------------------------------------------- |
| 1   | 类型提取后导入路径断裂                            | 中     | 高   | 重导出 shims + grep 验证所有导入             | `grep -r "from.*BroadcastService" --include="*.ts"` |
| 2   | `Record<number, T>` 的 number key 残留在 fixtures | 中     | 中   | 归一化所有输入；在 normalize 中 canonicalize | `npm test -- normalize.contract`                    |
| 3   | seat-map key 规范化错误（drift）                  | 高     | 高   | 统一走 `canonicalizeSeatKeyRecord()`          | `npm test -- normalize.contract`                    |
| 4   | `CurrentNightResults` 被作为运行时导入            | 低     | 高   | 边界测试扫描运行时导入                       | `npm test -- boundary.contract`                     |
| 5   | 意外导入 legacy                                | 低     | 严重 | ESLint 规则 + 边界测试                       | `npm test -- boundary.contract`                     |

---

## 12. 验收清单（Acceptance Checklist）

| #   | 标准                                          | 验证命令                         |
| --- | --------------------------------------------- | -------------------------------- |
| 1   | `protocol/types.ts` 无运行时代码              | `npm test -- boundary.contract`  |
| 2   | `BroadcastService.ts` 不再导出协议类型        | `npm test -- boundary.contract`  |
| 3   | 新增 seat-map 字段 keys 是 string             | `npm test -- normalize.contract` |
| 4   | `players` key 类型保持 number（Phase 1）      | 现有测试通过                     |
| 5   | 旧协议字段误用（代码/文档未清理）                | `npm test -- normalize.contract` |
| 6   | `CurrentNightResults` type-only 导入          | Grep + 边界测试                  |
| 7   | 不运行时导入 legacy                        | `npm test -- boundary.contract`  |
| 8   | core 不运行时导入 transport                   | `npm test -- boundary.contract`  |
| 9   | 主机每次广播递增 revision                     | 集成测试                         |
| 10  | 玩家丢弃旧 revision                           | 集成测试                         |
| 11  | 所有现有测试通过                              | `npm test`                       |

---

## 13. 术语表（Glossary）

| 英文术语                              | 中文         | 说明                                                              |
| ------------------------------------- | ------------ | ----------------------------------------------------------------- |
| BroadcastGameState                    | 广播游戏状态 | 通过 Supabase Realtime 广播的完整游戏状态；主机和玩家持有相同形态 |
| HostBroadcast                         | 主机广播消息 | 主机发送给所有玩家的消息类型联合                                  |
| PlayerMessage                         | 玩家消息     | 玩家发送给主机的消息类型联合                                      |
| ProtocolAction                        | 协议动作记录 | 用于线传输的动作记录，只包含线安全字段                            |
| normalizeState                        | 状态归一化   | 广播前处理状态：填充默认值、规范化 keys、派生字段                 |
| canonicalize                          | 键规范化     | 将 seat-map 的 key 统一转换为 string 类型                         |
| boundary test                         | 边界契约测试 | 验证模块间导入规则的自动化测试                                    |
| single source of truth                | 单一真相     | 某个概念/类型只在一处定义，其他地方引用                           |
| wire protocol                         | 线协议       | 通过网络传输的数据格式和消息定义                                  |
| God Class                             | 上帝类       | 承担过多职责的大型类，违反单一职责原则                            |
| SRP (Single Responsibility Principle) | 单一职责原则 | 每个类/模块只应有一个职责                                         |
| resolver                              | 解析器       | 验证和计算动作结果的纯函数                                        |
| reducer                               | 归约器       | 纯函数：(state, action) => newState                               |
| type-only import                      | 仅类型导入   | `import type { X }`，运行时被擦除                                 |
| runtime import                        | 运行时导入   | `import { X }`，保留在运行时                                      |
| drift                                 | 漂移         | 多处定义导致不一致的问题                                          |
| shim                                  | 垫片         | 提供向后兼容的重导出文件                                          |

---

## 附录：快速参考

### 导入模式

```typescript
// ✅ 正确：从 protocol 导入
import type { BroadcastGameState, HostBroadcast, PlayerMessage } from '@/services/protocol/types';

// ❌ 错误：从 BroadcastService 导入（迁移后）
import type { BroadcastGameState } from '@/services/BroadcastService';

// ✅ 正确：protocol 中仅类型导入
import type { SchemaId } from '@/models/roles/spec';

// ❌ 错误：protocol 中运行时导入
import { SCHEMAS } from '@/models/roles/spec';
```

### Seat-map Key 规范（Phase 1）

```typescript
// 线协议（JSON 序列化后）
{
  "players": { "0": {...}, "1": {...} },      // Phase 1: 保持 number key（TS 类型）
  "currentNightResults": {
    "wolfVotesBySeat": { "0": 2, "1": 2 }
  }
}

// 内部/UI（转换后使用）
const seatNumber: number = parseInt(key, 10);
```

### Phase 1 字段 Key 类型一览

| 字段             | Phase 1 TS 类型                           | 说明              |
| ---------------- | ----------------------------------------- | ----------------- |
| `players`        | `Record<number, BroadcastPlayer \| null>` | 保持现状          |
| `currentNightResults.wolfVotesBySeat` | `Record<string, number>`     | seat → target（string key） |
