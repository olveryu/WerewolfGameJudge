# WerewolfGameJudge V2 Services 终极重构设计文档

> **版本**: 3.0 (Final)  
> **日期**: 2026-01-21  
> **状态**: 设计锁定 - 执行前最终版本

---

## ⚠️ 如何使用本文档

**这是执行合约，不是设计草稿。**

1. 每个模块有精确的 **MUST DO / MUST NOT DO** 清单
2. 每个模块有 **行数上限**，超过即违规
3. 每个模块有 **依赖白名单**，import 其他模块即违规
4. 执行时必须逐条对照，不能凭记忆

**如果执行中发现需要修改设计，必须先更新本文档，再执行代码。**

---

## 📋 目录

1. [不可违反的约束](#1-不可违反的约束)
2. [V1 问题总结](#2-v1-问题总结)
3. [V2 架构总览](#3-v2-架构总览)
4. [模块精确规格](#4-模块精确规格)
5. [数据类型精确定义](#5-数据类型精确定义)
6. [数据流精确描述](#6-数据流精确描述)
7. [执行计划](#7-执行计划)
8. [验收检查表](#8-验收检查表)

---

## 1. 不可违反的约束

### 1.1 Host 也是玩家 (Host-is-Player)

```
Host 用户 = 普通玩家 + 裁判权限

Host 作为玩家必须能做:
  ✓ 入座 (takeSeat)
  ✓ 看牌 (viewRole)
  ✓ 在自己回合行动 (submitAction)
  ✓ 如果是狼人，参与狼人投票
  ✓ 如果是预言家，查验并看结果
  ✓ 如果被女巫毒，猎人技能失效
  ✓ ...所有玩家能做的事

Host 额外的裁判能力:
  ✓ 创建/关闭房间
  ✓ 修改板子
  ✓ 分配角色
  ✓ 开始/重开游戏
```

**代码约束:**
- ❌ 禁止 `if (isHost) { 特殊UI逻辑 }` 
- ✅ Host UI 和 Player UI 读取相同格式的 `UIState`

### 1.2 永远只有 Night-1 (Night-1-Only)

```
游戏流程:

  创建房间 → 入座 → 分配角色 → 看牌 → Night-1 → 结算 → 结束
                    ↑                              │
                    └────────── 重开游戏 ───────────┘
```

**代码约束:**
- ❌ 禁止 `nightNumber` 字段
- ❌ 禁止 `previousNightActions` 字段
- ❌ 禁止 `lastNightTarget` 字段
- ❌ 禁止 "连续两晚" 类规则

### 1.3 其他 Non-negotiables

| 约束 | 说明 |
|------|------|
| Host is ONLY authority | Supabase 只做 transport/discovery/identity |
| All state via Broadcast | 所有状态公开广播，UI 按 myRole 过滤 |
| Single source of truth | 任何数据只存一处 |
| SRP | 每模块 ~400 行以内 |

---

## 2. V1 问题总结

### 问题 1: Host/Player 状态分裂

```
V1 问题:

  Host: UI 读取 this.state (内部状态)
  Player: UI 读取 broadcastState (广播状态)
  
  结果: 同一个字段两处存储，需要手动同步，容易遗漏
```

**V2 解决方案:** Host 和 Player 都从 `toUIState()` 读取

### 问题 2: God Class

```
V1: GameStateService.ts (2724 行, 10+ 职责)

V2: 拆分为 10+ 个小模块，每个 50-350 行
```

### 问题 3: 命名混淆

```
V1: WolfVoteResolver - 不是 Schema Resolver，只是投票结算

V2: 
  - Schema Resolver: seer.ts, witch.ts, ...
  - Vote Settlement: VoteSettlement.settleWolfVotes()
```

---

## 3. V2 架构总览

### 3.1 分层架构

```
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 1: UI (React)                                                  │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ useGameRoom.ts                                                  │ │
│ │ - 订阅 UIState                                                  │ │
│ │ - 调用 GameFacade 方法                                          │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 2: Facade                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ GameFacade.ts (~200行)                                          │ │
│ │ - UI 的唯一入口                                                 │ │
│ │ - 管理 Host/Player 角色                                         │ │
│ │ - 派发 UIState                                                  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
┌───────────────────────────────┐ ┌───────────────────────────────────┐
│ Layer 3a: HostEngine (~350行) │ │ Layer 3b: PlayerClient (~150行)   │
│ - 持有 AuthoritativeState     │ │ - 持有 SharedState                │
│ - 处理所有行动                │ │ - 发送消息给 Host                 │
│ - 协调夜晚流程                │ │ - 接收广播                        │
│ - 广播状态                    │ │                                   │
└───────────────────────────────┘ └───────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 4: Core Services                                               │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐               │
│ │NightFlow-     │ │ActionProcessor│ │AudioPlayer    │               │
│ │Controller     │ │(~200行)       │ │(~100行)       │               │
│ │(~180行)       │ │               │ │               │               │
│ └───────────────┘ └───────────────┘ └───────────────┘               │
│ ┌───────────────┐ ┌───────────────┐                                 │
│ │SeatManager    │ │RoleAssigner   │                                 │
│ │(~100行)       │ │(~50行)        │                                 │
│ └───────────────┘ └───────────────┘                                 │
└─────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 5: Pure Functions (无状态、无副作用)                           │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐               │
│ │StateMapper    │ │VoteSettlement │ │DeathCalculator│               │
│ │(~120行)       │ │(~60行)        │ │(~200行)       │               │
│ └───────────────┘ └───────────────┘ └───────────────┘               │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ night/resolvers/* (已有，保留)                                  │ │
│ │ seer.ts, witch.ts, nightmare.ts, guard.ts, ...                  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 6: Infrastructure (外部依赖封装)                               │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐               │
│ │BroadcastChannel│ │RoomRepository │ │StateStorage   │               │
│ │(~120行)       │ │(~80行)        │ │(~60行)        │               │
│ └───────────────┘ └───────────────┘ └───────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 文件结构

```
src/services/
├── legacy/                      # V1 存档 (Step 0 移入)
│
├── index.ts                     # V2 导出
│
├── types/                       # 类型定义 (只有类型，无逻辑)
│   ├── AuthoritativeState.ts
│   ├── SharedState.ts
│   ├── UIState.ts
│   ├── Messages.ts
│   └── index.ts
│
├── pure/                        # 纯函数 (无状态、无副作用)
│   ├── StateMapper.ts
│   ├── VoteSettlement.ts
│   ├── DeathCalculator.ts
│   └── index.ts
│
├── night/resolvers/             # ✅ 保留原位置
│   └── (已有文件)
│
├── core/                        # 核心服务
│   ├── NightFlowController.ts
│   ├── ActionProcessor.ts
│   ├── SeatManager.ts
│   ├── RoleAssigner.ts
│   ├── AudioPlayer.ts
│   └── index.ts
│
├── infra/                       # 基础设施
│   ├── BroadcastChannel.ts
│   ├── RoomRepository.ts
│   ├── StateStorage.ts
│   └── index.ts
│
├── HostEngine.ts                # Host 引擎
├── PlayerClient.ts              # Player 客户端
└── GameFacade.ts                # 统一入口
```

---

## 4. 模块精确规格

### 4.0 阅读说明

每个模块规格包含:
- **职责**: 这个模块做什么
- **MUST DO**: 必须做的事
- **MUST NOT DO**: 禁止做的事
- **依赖白名单**: 只能 import 这些
- **被依赖者**: 谁会 import 这个
- **公开接口**: 对外暴露的函数/类/类型
- **行数上限**: 超过即违规

---

### 4.1 types/AuthoritativeState.ts

**职责:** 定义 Host 内部权威状态的类型

**行数上限:** 100 行

**MUST DO:**
- 定义 `AuthoritativeState` 接口
- 定义 `PlayerData` 接口
- 定义 `NightResults` 接口
- 定义 `GameStatus` 枚举

**MUST NOT DO:**
- ❌ 不能有任何函数实现
- ❌ 不能 import 任何 service
- ❌ 不能有默认值逻辑

**依赖白名单:**
```typescript
import { RoleId } from '../../models/roles';
import { GameTemplate } from '../../models/Template';
```

**被依赖者:**
- `HostEngine.ts`
- `pure/StateMapper.ts`
- `core/ActionProcessor.ts`

**公开接口:**
```typescript
export interface AuthoritativeState { ... }
export interface PlayerData { ... }
export interface NightResults { ... }
export enum GameStatus { ... }
```

---

### 4.2 types/SharedState.ts

**职责:** 定义广播共享状态的类型 (= BroadcastGameState)

**行数上限:** 150 行

**MUST DO:**
- 定义 `SharedState` 接口
- 定义所有 reveal 结果类型 (SeerReveal, PsychicReveal, etc.)
- 定义所有 context 类型 (WitchContext, ConfirmContext, etc.)

**MUST NOT DO:**
- ❌ 不能有任何函数实现
- ❌ 不能 import 任何 service

**依赖白名单:**
```typescript
import { RoleId } from '../../models/roles';
import { GameTemplate } from '../../models/Template';
```

**被依赖者:**
- `HostEngine.ts`
- `PlayerClient.ts`
- `GameFacade.ts`
- `pure/StateMapper.ts`

**公开接口:**
```typescript
export interface SharedState { ... }
export interface SeerReveal { ... }
export interface WitchContext { ... }
// ... 其他类型
```

---

### 4.3 types/UIState.ts

**职责:** 定义 UI 读取的状态类型

**行数上限:** 80 行

**MUST DO:**
- 定义 `UIState` 接口 (= SharedState + myRole 派生字段)
- 定义 UI 专用派生字段

**MUST NOT DO:**
- ❌ 不能有任何函数实现
- ❌ 不能 import 任何 service

**依赖白名单:**
```typescript
import { SharedState } from './SharedState';
import { RoleId } from '../../models/roles';
```

**被依赖者:**
- `GameFacade.ts`
- `useGameRoom.ts`
- `pure/StateMapper.ts`

**公开接口:**
```typescript
export interface UIState extends SharedState {
  // 本地身份
  myUid: string;
  mySeat: number | null;
  myRole: RoleId | null;
  
  // 派生显示控制
  canSeeSeerResult: boolean;
  canSeeWitchContext: boolean;
  canSeeWolfVotes: boolean;
  // ...
}
```

---

### 4.4 types/Messages.ts

**职责:** 定义 Host/Player 消息协议

**行数上限:** 100 行

**MUST DO:**
- 定义 `PlayerToHostMessage` 类型
- 定义 `HostToPlayerMessage` 类型
- 定义所有消息 payload 类型

**MUST NOT DO:**
- ❌ 不能有任何函数实现
- ❌ 不能 import 任何 service

**依赖白名单:**
```typescript
import { RoleId } from '../../models/roles';
```

**被依赖者:**
- `HostEngine.ts`
- `PlayerClient.ts`
- `infra/BroadcastChannel.ts`

**公开接口:**
```typescript
export type PlayerToHostMessage = 
  | { type: 'takeSeat'; seatNumber: number }
  | { type: 'leaveSeat' }
  | { type: 'submitAction'; target: number | null }
  | { type: 'wolfVote'; target: number }
  | { type: 'viewRole' };

export type HostToPlayerMessage =
  | { type: 'stateUpdate'; state: SharedState }
  | { type: 'actionRejected'; reason: string };
```

---

### 4.5 pure/StateMapper.ts

**职责:** 状态转换纯函数

**行数上限:** 120 行

**MUST DO:**
- 实现 `toSharedState(auth: AuthoritativeState): SharedState`
- 实现 `toUIState(shared: SharedState, myUid: string, mySeat: number | null): UIState`
- 所有派生字段在这里计算

**MUST NOT DO:**
- ❌ 不能有任何副作用 (console.log 除外)
- ❌ 不能访问任何外部状态
- ❌ 不能调用任何 async 函数
- ❌ 不能 import 任何 service 或 infra

**依赖白名单:**
```typescript
import { AuthoritativeState } from '../types/AuthoritativeState';
import { SharedState } from '../types/SharedState';
import { UIState } from '../types/UIState';
import { ROLE_SPECS, isWolfRole } from '../../models/roles';
```

**被依赖者:**
- `HostEngine.ts`
- `PlayerClient.ts`
- `GameFacade.ts`

**公开接口:**
```typescript
export function toSharedState(auth: AuthoritativeState): SharedState;
export function toUIState(shared: SharedState, myUid: string, mySeat: number | null): UIState;
```

**关键实现:**
```typescript
export function toUIState(
  shared: SharedState,
  myUid: string,
  mySeat: number | null
): UIState {
  const myRole = mySeat !== null ? shared.seats[mySeat]?.role ?? null : null;
  
  return {
    ...shared,
    myUid,
    mySeat,
    myRole,
    
    // 派生显示控制 - 根据 myRole 计算
    canSeeSeerResult: myRole === 'seer' && shared.seerReveal !== undefined,
    canSeeWitchContext: myRole === 'witch' && shared.witchContext !== undefined,
    canSeeWolfVotes: isWolfRole(myRole),
    canSeeWolfTeammates: isWolfRole(myRole) && shared.currentStepSchema?.meeting?.canSeeEachOther === true,
    // ...
  };
}
```

---

### 4.6 pure/VoteSettlement.ts

**职责:** 狼人投票结算纯函数

**行数上限:** 60 行

**MUST DO:**
- 实现 `settleWolfVotes(votes: Map<number, number>): number | null`
- 统计票数，返回最高票目标 (平票返回 null)

**MUST NOT DO:**
- ❌ 不能有任何副作用
- ❌ 不能访问任何外部状态
- ❌ 不能验证投票合法性 (那是 Resolver 的事)

**依赖白名单:**
```typescript
// 无依赖
```

**被依赖者:**
- `HostEngine.ts`

**公开接口:**
```typescript
export function settleWolfVotes(votes: Map<number, number>): number | null;
```

---

### 4.7 pure/DeathCalculator.ts

**职责:** 死亡计算纯函数

**行数上限:** 200 行

**MUST DO:**
- 实现 `calculateDeaths(results: NightResults, players: PlayerData[]): DeathResult`
- 处理所有死亡逻辑: 狼杀、毒杀、同守同救
- 返回死亡座位列表和死亡原因

**MUST NOT DO:**
- ❌ 不能有任何副作用
- ❌ 不能访问任何外部状态
- ❌ 不能处理技能触发 (猎人反击等)

**依赖白名单:**
```typescript
import { NightResults, PlayerData } from '../types/AuthoritativeState';
```

**被依赖者:**
- `HostEngine.ts`

**公开接口:**
```typescript
export interface DeathResult {
  deaths: number[];  // 死亡座位
  causes: Map<number, DeathCause>;  // 死因
}

export enum DeathCause {
  wolfKill = 'wolfKill',
  witchPoison = 'witchPoison',
  guardSameProtect = 'guardSameProtect',  // 同守同救
}

export function calculateDeaths(
  results: NightResults,
  players: PlayerData[]
): DeathResult;
```

---

### 4.8 core/NightFlowController.ts

**职责:** 夜晚流程状态机

**行数上限:** 180 行

**MUST DO:**
- 管理当前步骤索引 `currentStepIndex`
- 提供 `getCurrentStep()` 返回当前步骤
- 提供 `advance()` 前进到下一步
- 提供 `isComplete()` 判断夜晚是否结束
- 从 `NIGHT_STEPS` 读取步骤列表

**MUST NOT DO:**
- ❌ 不能处理行动 (那是 ActionProcessor 的事)
- ❌ 不能播放音频 (那是 AudioPlayer 的事)
- ❌ 不能广播状态 (那是 HostEngine 的事)
- ❌ 不能直接修改游戏状态

**依赖白名单:**
```typescript
import { NIGHT_STEPS, StepSpec } from '../../models/roles/spec/nightSteps';
import { GameTemplate } from '../../models/Template';
```

**被依赖者:**
- `HostEngine.ts`

**公开接口:**
```typescript
export class NightFlowController {
  constructor(template: GameTemplate);
  
  getCurrentStepIndex(): number;
  getCurrentStep(): StepSpec | null;
  advance(): StepSpec | null;  // 返回新步骤，null = 夜晚结束
  isComplete(): boolean;
  reset(): void;
}
```

---

### 4.9 core/ActionProcessor.ts

**职责:** 行动处理 (Resolver 调用 + 结果应用)

**行数上限:** 200 行

**MUST DO:**
- 调用对应的 Resolver 验证行动
- 将 Resolver 结果应用到 `NightResults`
- 返回处理结果 (成功/失败+原因)

**MUST NOT DO:**
- ❌ 不能推进夜晚流程 (那是 NightFlowController 的事)
- ❌ 不能广播状态 (那是 HostEngine 的事)
- ❌ 不能直接访问外部状态

**依赖白名单:**
```typescript
import { AuthoritativeState, NightResults } from '../types/AuthoritativeState';
import { SCHEMAS, SchemaId } from '../../models/roles/spec/schemas';
import * as resolvers from '../night/resolvers';
```

**被依赖者:**
- `HostEngine.ts`

**公开接口:**
```typescript
export interface ProcessResult {
  valid: boolean;
  rejectReason?: string;
  updatedResults?: Partial<NightResults>;
}

export class ActionProcessor {
  processAction(
    schemaId: SchemaId,
    actorSeat: number,
    target: number | null,
    state: AuthoritativeState
  ): ProcessResult;
}
```

---

### 4.10 core/SeatManager.ts

**职责:** 座位管理

**行数上限:** 100 行

**MUST DO:**
- 处理入座 `takeSeat(uid, seatNumber)`
- 处理离座 `leaveSeat(uid)`
- 验证座位合法性

**MUST NOT DO:**
- ❌ 不能广播状态
- ❌ 不能处理角色分配

**依赖白名单:**
```typescript
import { AuthoritativeState, PlayerData } from '../types/AuthoritativeState';
```

**被依赖者:**
- `HostEngine.ts`

**公开接口:**
```typescript
export interface SeatResult {
  success: boolean;
  error?: string;
  updatedPlayers?: Map<number, PlayerData | null>;
}

export class SeatManager {
  takeSeat(state: AuthoritativeState, uid: string, seatNumber: number, displayName?: string): SeatResult;
  leaveSeat(state: AuthoritativeState, uid: string): SeatResult;
  findSeatByUid(state: AuthoritativeState, uid: string): number | null;
}
```

---

### 4.11 core/RoleAssigner.ts

**职责:** 角色分配

**行数上限:** 50 行

**MUST DO:**
- 根据模板随机分配角色
- 返回座位→角色映射

**MUST NOT DO:**
- ❌ 不能修改状态
- ❌ 不能广播

**依赖白名单:**
```typescript
import { GameTemplate } from '../../models/Template';
import { RoleId } from '../../models/roles';
```

**被依赖者:**
- `HostEngine.ts`

**公开接口:**
```typescript
export function assignRoles(
  template: GameTemplate,
  seatCount: number
): Map<number, RoleId>;
```

---

### 4.12 core/AudioPlayer.ts

**职责:** 音频播放

**行数上限:** 100 行

**MUST DO:**
- 播放步骤开始/结束音频
- 管理播放状态
- 提供回调通知播放完成

**MUST NOT DO:**
- ❌ 不能推进夜晚流程
- ❌ 不能处理行动

**依赖白名单:**
```typescript
import { Audio } from 'expo-audio';
import { StepSpec } from '../../models/roles/spec/nightSteps';
```

**被依赖者:**
- `HostEngine.ts`

**公开接口:**
```typescript
export class AudioPlayer {
  playStepAudio(step: StepSpec): Promise<void>;
  playStepEndAudio(step: StepSpec): Promise<void>;
  stop(): void;
  isPlaying(): boolean;
}
```

---

### 4.13 infra/BroadcastChannel.ts

**职责:** Supabase 实时通道封装

**行数上限:** 120 行

**MUST DO:**
- 封装 Supabase Realtime Channel
- 提供 `broadcast(type, payload)` 方法
- 提供 `subscribe(handler)` 方法
- 处理连接/断开

**MUST NOT DO:**
- ❌ 不能理解消息内容 (只是传输)
- ❌ 不能处理游戏逻辑

**依赖白名单:**
```typescript
import { supabase } from '../../config/supabase';
import { PlayerToHostMessage, HostToPlayerMessage } from '../types/Messages';
```

**被依赖者:**
- `HostEngine.ts`
- `PlayerClient.ts`

**公开接口:**
```typescript
export class BroadcastChannel {
  constructor(roomCode: string);
  
  broadcast(type: string, payload: unknown): Promise<void>;
  subscribe(handler: (message: unknown) => void): void;
  disconnect(): void;
}
```

---

### 4.14 infra/RoomRepository.ts

**职责:** Supabase rooms 表操作

**行数上限:** 80 行

**MUST DO:**
- 创建房间 `createRoom(hostUid)`
- 查询房间 `getRoom(roomCode)`
- 关闭房间 `closeRoom(roomCode)`

**MUST NOT DO:**
- ❌ 不能处理游戏状态
- ❌ 不能处理实时消息

**依赖白名单:**
```typescript
import { supabase } from '../../config/supabase';
```

**被依赖者:**
- `HostEngine.ts`
- `PlayerClient.ts`

**公开接口:**
```typescript
export class RoomRepository {
  createRoom(hostUid: string): Promise<{ roomCode: string }>;
  getRoom(roomCode: string): Promise<RoomInfo | null>;
  closeRoom(roomCode: string): Promise<void>;
}
```

---

### 4.15 infra/StateStorage.ts

**职责:** 本地状态持久化

**行数上限:** 60 行

**MUST DO:**
- 保存状态到 AsyncStorage
- 加载状态从 AsyncStorage
- 清除状态

**MUST NOT DO:**
- ❌ 不能处理游戏逻辑

**依赖白名单:**
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthoritativeState } from '../types/AuthoritativeState';
```

**被依赖者:**
- `HostEngine.ts`

**公开接口:**
```typescript
export class StateStorage {
  save(roomCode: string, state: AuthoritativeState): Promise<void>;
  load(roomCode: string): Promise<AuthoritativeState | null>;
  clear(roomCode: string): Promise<void>;
}
```

---

### 4.16 HostEngine.ts

**职责:** Host 核心引擎

**行数上限:** 350 行

**MUST DO:**
- 持有 `AuthoritativeState` (唯一所有者)
- 协调所有 core 模块
- 处理所有行动 (本地 + 远程)
- 广播状态更新
- 处理 Player 消息

**MUST NOT DO:**
- ❌ 不能直接操作 Supabase (通过 infra)
- ❌ 不能包含验证逻辑 (通过 ActionProcessor)
- ❌ 不能包含死亡计算 (通过 DeathCalculator)
- ❌ 不能直接生成 UIState (通过 StateMapper)

**依赖白名单:**
```typescript
import { AuthoritativeState, GameStatus } from './types/AuthoritativeState';
import { SharedState } from './types/SharedState';
import { PlayerToHostMessage } from './types/Messages';

import { toSharedState } from './pure/StateMapper';
import { settleWolfVotes } from './pure/VoteSettlement';
import { calculateDeaths } from './pure/DeathCalculator';

import { NightFlowController } from './core/NightFlowController';
import { ActionProcessor } from './core/ActionProcessor';
import { SeatManager } from './core/SeatManager';
import { assignRoles } from './core/RoleAssigner';
import { AudioPlayer } from './core/AudioPlayer';

import { BroadcastChannel } from './infra/BroadcastChannel';
import { StateStorage } from './infra/StateStorage';
```

**被依赖者:**
- `GameFacade.ts`

**公开接口:**
```typescript
export class HostEngine {
  // 生命周期
  constructor(roomCode: string, hostUid: string);
  dispose(): void;
  
  // 状态访问
  getSharedState(): SharedState;
  subscribeStateChange(handler: (state: SharedState) => void): () => void;
  
  // Host 专有操作
  updateTemplate(template: GameTemplate): void;
  assignRoles(): void;
  startGame(): void;
  restartGame(): void;
  
  // 通用操作 (Host 作为玩家也会调用)
  takeSeat(uid: string, seatNumber: number, displayName?: string): void;
  leaveSeat(uid: string): void;
  viewRole(uid: string): void;
  submitAction(uid: string, target: number | null): void;
  submitWolfVote(uid: string, target: number): void;
  
  // Player 消息处理
  handlePlayerMessage(fromUid: string, message: PlayerToHostMessage): void;
}
```

**关键实现:**
```typescript
// Host 提交行动 - 和 Player 一样的路径
submitAction(uid: string, target: number | null): void {
  const seatNumber = this.seatManager.findSeatByUid(this.state, uid);
  if (seatNumber === null) return;
  
  const currentStep = this.nightFlow.getCurrentStep();
  if (!currentStep) return;
  
  // 使用 ActionProcessor 处理
  const result = this.actionProcessor.processAction(
    currentStep.id,
    seatNumber,
    target,
    this.state
  );
  
  if (!result.valid) {
    // 拒绝 - 通知 (如果是远程玩家)
    return;
  }
  
  // 应用结果
  this.state = {
    ...this.state,
    nightResults: { ...this.state.nightResults, ...result.updatedResults }
  };
  
  // 广播
  this.broadcastState();
  
  // 推进流程
  this.advanceToNextStep();
}
```

---

### 4.17 PlayerClient.ts

**职责:** Player 客户端

**行数上限:** 150 行

**MUST DO:**
- 持有 `SharedState` (从广播接收)
- 发送消息给 Host
- 接收广播更新

**MUST NOT DO:**
- ❌ 不能处理游戏逻辑
- ❌ 不能验证行动
- ❌ 不能计算任何结果

**依赖白名单:**
```typescript
import { SharedState } from './types/SharedState';
import { PlayerToHostMessage } from './types/Messages';
import { BroadcastChannel } from './infra/BroadcastChannel';
```

**被依赖者:**
- `GameFacade.ts`

**公开接口:**
```typescript
export class PlayerClient {
  constructor(roomCode: string, playerUid: string);
  dispose(): void;
  
  getSharedState(): SharedState | null;
  subscribeStateChange(handler: (state: SharedState) => void): () => void;
  
  sendTakeSeat(seatNumber: number): void;
  sendLeaveSeat(): void;
  sendViewRole(): void;
  sendSubmitAction(target: number | null): void;
  sendWolfVote(target: number): void;
}
```

---

### 4.18 GameFacade.ts

**职责:** UI 的统一入口

**行数上限:** 200 行

**MUST DO:**
- 根据 isHost 创建 HostEngine 或 PlayerClient
- 转换 SharedState → UIState
- 提供统一的方法接口
- 管理本地身份 (myUid, mySeat)

**MUST NOT DO:**
- ❌ 不能包含游戏逻辑
- ❌ 不能直接操作 Supabase

**依赖白名单:**
```typescript
import { SharedState } from './types/SharedState';
import { UIState } from './types/UIState';
import { toUIState } from './pure/StateMapper';
import { HostEngine } from './HostEngine';
import { PlayerClient } from './PlayerClient';
```

**被依赖者:**
- `useGameRoom.ts`

**公开接口:**
```typescript
export class GameFacade {
  // 单例
  static getInstance(): GameFacade;
  
  // 生命周期
  initHost(roomCode: string, hostUid: string): Promise<void>;
  joinPlayer(roomCode: string, playerUid: string): Promise<void>;
  leave(): void;
  
  // 状态
  getUIState(): UIState | null;
  subscribeUIState(handler: (state: UIState) => void): () => void;
  
  // 身份
  isHost(): boolean;
  getMyUid(): string | null;
  getMySeat(): number | null;
  
  // 操作 (Host/Player 统一接口)
  takeSeat(seatNumber: number, displayName?: string): void;
  leaveSeat(): void;
  viewRole(): void;
  submitAction(target: number | null): void;
  submitWolfVote(target: number): void;
  
  // Host 专有
  updateTemplate(template: GameTemplate): void;
  assignRoles(): void;
  startGame(): void;
  restartGame(): void;
}
```

**关键实现:**
```typescript
// 统一的状态订阅
subscribeUIState(handler: (state: UIState) => void): () => void {
  if (this.hostEngine) {
    return this.hostEngine.subscribeStateChange((shared) => {
      const ui = toUIState(shared, this.myUid!, this.mySeat);
      handler(ui);
    });
  } else if (this.playerClient) {
    return this.playerClient.subscribeStateChange((shared) => {
      const ui = toUIState(shared, this.myUid!, this.mySeat);
      handler(ui);
    });
  }
  return () => {};
}

// 统一的行动提交
submitAction(target: number | null): void {
  if (this.hostEngine) {
    // Host: 直接调用引擎
    this.hostEngine.submitAction(this.myUid!, target);
  } else if (this.playerClient) {
    // Player: 发送给 Host
    this.playerClient.sendSubmitAction(target);
  }
}
```

---

### 4.19 hooks/useGameRoom.ts

**职责:** React Hook，连接 UI 和 GameFacade

**行数上限:** 150 行

**MUST DO:**
- 订阅 GameFacade 的 UIState
- 返回 UIState 和操作方法
- 处理组件生命周期

**MUST NOT DO:**
- ❌ 不能包含游戏逻辑
- ❌ 不能直接访问 HostEngine/PlayerClient

**依赖白名单:**
```typescript
import { useState, useEffect, useCallback } from 'react';
import { GameFacade } from '../services/GameFacade';
import { UIState } from '../services/types/UIState';
```

**被依赖者:**
- RoomScreen 组件

**公开接口:**
```typescript
export function useGameRoom(): {
  // 状态
  state: UIState | null;
  isHost: boolean;
  myUid: string | null;
  mySeat: number | null;
  myRole: RoleId | null;
  
  // 操作
  takeSeat: (seatNumber: number, displayName?: string) => void;
  leaveSeat: () => void;
  viewRole: () => void;
  submitAction: (target: number | null) => void;
  submitWolfVote: (target: number) => void;
  
  // Host 专有
  updateTemplate: (template: GameTemplate) => void;
  assignRoles: () => void;
  startGame: () => void;
  restartGame: () => void;
};
```

---

## 5. 数据类型精确定义

### 5.1 AuthoritativeState (完整)

```typescript
// src/services/types/AuthoritativeState.ts

import { RoleId } from '../../models/roles';
import { GameTemplate } from '../../models/Template';

export enum GameStatus {
  unseated = 'unseated',   // 等待入座
  seated = 'seated',       // 已入座完成
  assigned = 'assigned',   // 已分配角色
  ready = 'ready',         // 等待开始
  ongoing = 'ongoing',     // 游戏进行中 (夜晚)
  ended = 'ended',         // 游戏结束
}

export interface PlayerData {
  uid: string;
  seatNumber: number;
  displayName: string;
  avatarUrl?: string;
  role: RoleId | null;         // 分配后有值
  hasViewedRole: boolean;      // 是否已看牌
}

export interface NightResults {
  // Nightmare 阻止
  blockedSeat?: number;
  
  // 狼人结果
  wolfKillTarget?: number;           // 投票结算后的目标
  wolfKillDisabled?: boolean;        // 被 nightmare 禁用
  
  // 女巫结果
  witchSave?: number;                // 救的座位
  witchPoison?: number;              // 毒的座位
  
  // 守卫结果
  guardProtect?: number;             // 守护的座位
  
  // 预言家结果
  seerCheck?: { target: number; isWolf: boolean };
  
  // 通灵师结果
  psychicCheck?: { target: number; isGood: boolean };
  
  // ... 其他角色结果
}

export interface AuthoritativeState {
  // === 房间信息 ===
  roomCode: string;
  hostUid: string;
  
  // === 游戏配置 ===
  template: GameTemplate;
  
  // === 游戏状态 ===
  status: GameStatus;
  
  // === 玩家数据 ===
  // 座位号 → 玩家数据 (null = 空座)
  players: Map<number, PlayerData | null>;
  
  // === 夜晚流程 ===
  currentStepIndex: number;
  isAudioPlaying: boolean;
  
  // === 行动记录 ===
  // 这一夜的行动，SchemaId → 行动数据
  actions: Map<string, { actorSeat: number; target: number | null }>;
  
  // === 狼人投票 ===
  // 狼人座位 → 目标座位
  wolfVotes: Map<number, number>;
  
  // === 夜晚结果 (Resolver 累积) ===
  nightResults: NightResults;
  
  // === 游戏结果 ===
  deaths: number[];  // 死亡座位列表
}
```

### 5.2 SharedState (完整)

```typescript
// src/services/types/SharedState.ts

import { RoleId } from '../../models/roles';
import { GameTemplate } from '../../models/Template';
import { GameStatus } from './AuthoritativeState';
import { SchemaId } from '../../models/roles/spec/schemas';

// === Reveal 类型 ===

export interface SeerReveal {
  targetSeat: number;
  isWolf: boolean;
}

export interface PsychicReveal {
  targetSeat: number;
  isGood: boolean;
}

// === Context 类型 ===

export interface WitchContext {
  killedSeat: number | null;  // 今晚被杀的座位 (null = 没人被杀)
  canSave: boolean;           // 是否可以救
  canPoison: boolean;         // 是否可以毒
}

export interface ConfirmContext {
  role: 'hunter' | 'darkWolfKing';
  canShoot: boolean;  // 是否能开枪 (被毒死不能)
}

// === 座位信息 (广播版) ===

export interface SeatInfo {
  seatNumber: number;
  uid: string | null;
  displayName: string | null;
  avatarUrl?: string;
  role: RoleId | null;       // null = 未分配或不可见
  hasViewedRole: boolean;
}

// === SharedState ===

export interface SharedState {
  // === 房间信息 ===
  roomCode: string;
  
  // === 游戏配置 ===
  template: GameTemplate;
  
  // === 游戏状态 ===
  status: GameStatus;
  
  // === 座位 (数组，index = 座位号) ===
  seats: SeatInfo[];
  
  // === 夜晚流程 ===
  currentStepIndex: number;
  currentStepId: SchemaId | null;
  isAudioPlaying: boolean;
  
  // === 狼人投票状态 ===
  wolfVoteStatus: {
    votes: Record<number, number>;  // 狼座位 → 目标
    settledTarget: number | null;   // 结算后目标
  };
  
  // === Nightmare 阻止 ===
  nightmareBlockedSeat: number | null;
  wolfKillDisabled: boolean;
  
  // === 角色专属 Reveal ===
  seerReveal?: SeerReveal;
  psychicReveal?: PsychicReveal;
  
  // === 角色专属 Context ===
  witchContext?: WitchContext;
  confirmContext?: ConfirmContext;
  
  // === 游戏结果 ===
  deaths: number[];
}
```

### 5.3 UIState (完整)

```typescript
// src/services/types/UIState.ts

import { SharedState } from './SharedState';
import { RoleId } from '../../models/roles';

export interface UIState extends SharedState {
  // === 本地身份 ===
  myUid: string;
  mySeat: number | null;
  myRole: RoleId | null;
  
  // === 派生显示控制 ===
  
  // 是否能看到预言家查验结果
  canSeeSeerResult: boolean;
  
  // 是否能看到通灵师结果
  canSeePsychicResult: boolean;
  
  // 是否能看到女巫上下文 (被杀玩家)
  canSeeWitchContext: boolean;
  
  // 是否能看到狼人投票
  canSeeWolfVotes: boolean;
  
  // 是否能看到狼队友 (高亮显示)
  canSeeWolfTeammates: boolean;
  
  // 是否能看到确认上下文 (猎人/狼王)
  canSeeConfirmContext: boolean;
  
  // 是否是我的回合
  isMyTurn: boolean;
  
  // 当前步骤是否需要我行动
  shouldIAct: boolean;
}
```

---

## 6. 数据流精确描述

### 6.1 初始化流程

```
Host 创建房间:

  HomeScreen
      │
      │ createRoom()
      ▼
  GameFacade.initHost(roomCode, hostUid)
      │
      │ 创建 HostEngine
      ▼
  HostEngine.constructor(roomCode, hostUid)
      │
      ├─ 创建 BroadcastChannel
      ├─ 创建 NightFlowController
      ├─ 创建 ActionProcessor
      ├─ 创建 SeatManager
      ├─ 创建 AudioPlayer
      │
      └─ 初始化 AuthoritativeState
           status: 'unseated'
           players: Map (空)
```

```
Player 加入房间:

  HomeScreen
      │
      │ joinRoom(roomCode)
      ▼
  GameFacade.joinPlayer(roomCode, playerUid)
      │
      │ 创建 PlayerClient
      ▼
  PlayerClient.constructor(roomCode, playerUid)
      │
      ├─ 创建 BroadcastChannel
      ├─ 订阅广播
      │
      └─ 等待 SharedState
```

### 6.2 入座流程

```
任何玩家入座 (Host 或 Player):

  UI: takeSeat(seatNumber)
      │
      ▼
  GameFacade.takeSeat(seatNumber)
      │
      ├─ Host: HostEngine.takeSeat(myUid, seatNumber)
      │         │
      │         └─ SeatManager.takeSeat(state, uid, seatNumber)
      │               │
      │               └─ 更新 state.players
      │                     │
      │                     └─ broadcastState()
      │
      └─ Player: PlayerClient.sendTakeSeat(seatNumber)
                   │
                   └─ 发送消息给 Host
                         │
                         ▼
                   HostEngine.handlePlayerMessage()
                         │
                         └─ (同上 Host 流程)
```

### 6.3 夜晚行动流程

```
当前步骤: seer (预言家)
玩家: Host 是预言家，选择查验 3 号

  UI: submitAction(3)
      │
      ▼
  GameFacade.submitAction(3)
      │
      └─ HostEngine.submitAction(myUid, 3)
            │
            ├─ 1. 查找座位
            │     mySeat = SeatManager.findSeatByUid(state, myUid)
            │
            ├─ 2. 获取当前步骤
            │     step = NightFlowController.getCurrentStep()
            │     schemaId = step.id  // 'seer'
            │
            ├─ 3. 处理行动
            │     result = ActionProcessor.processAction(
            │       schemaId = 'seer',
            │       actorSeat = mySeat,
            │       target = 3,
            │       state = this.state
            │     )
            │     │
            │     └─ ActionProcessor 内部:
            │          resolver = resolvers['seer']
            │          result = resolver.resolve(context, input)
            │          return { valid, updatedResults }
            │
            ├─ 4. 检查结果
            │     if (!result.valid) {
            │       return; // 拒绝
            │     }
            │
            ├─ 5. 更新状态
            │     this.state.nightResults = {
            │       ...this.state.nightResults,
            │       seerCheck: result.updatedResults.seerCheck
            │     };
            │
            ├─ 6. 广播状态
            │     const shared = toSharedState(this.state);
            │     shared.seerReveal = result.updatedResults.seerCheck;
            │     this.channel.broadcast('stateUpdate', shared);
            │
            └─ 7. 推进流程
                  this.advanceToNextStep();
```

### 6.4 状态派发流程

```
状态更新时:

  HostEngine 内部状态变化
      │
      │ toSharedState(this.state)
      ▼
  SharedState (广播格式)
      │
      ├──────────────────────────────────────┐
      │                                      │
      │ 本地通知                              │ 广播
      ▼                                      ▼
  GameFacade                            PlayerClient
      │                                      │
      │ toUIState(shared, myUid, mySeat)     │ toUIState(shared, myUid, mySeat)
      ▼                                      ▼
  UIState                               UIState
      │                                      │
      │ notify subscriber                    │ notify subscriber
      ▼                                      ▼
  useGameRoom                           useGameRoom
      │                                      │
      │ setState                             │ setState
      ▼                                      ▼
  UI Render                             UI Render
  (Host 看到自己查验结果)               (Player 看到自己角色相关内容)
```

### 6.5 关键点: Host 和 Player 使用相同的 toUIState

```typescript
// Host (在 GameFacade 中)
subscribeStateChange((shared) => {
  const ui = toUIState(shared, this.myUid, this.mySeat);
  handler(ui);
});

// Player (在 GameFacade 中)
subscribeStateChange((shared) => {
  const ui = toUIState(shared, this.myUid, this.mySeat);
  handler(ui);
});

// 完全相同! 没有任何 if (isHost) 分支
```

---

## 7. 执行计划

### Step 0: 准备工作 (30 分钟)

1. 创建 git 分支 `refactor/v2-services`
2. 创建目录结构:
   ```
   src/services/legacy/
   src/services/types/
   src/services/pure/
   src/services/core/
   src/services/infra/
   ```
3. 移动现有文件到 `legacy/`:
   ```
   mv src/services/GameStateService.ts src/services/legacy/
   mv src/services/BroadcastService.ts src/services/legacy/
   mv src/services/NightFlowController.ts src/services/legacy/
   mv src/services/WolfVoteResolver.ts src/services/legacy/
   ```

### Step 1: 类型定义 (1 小时)

创建以下文件，严格按照第 5 节规格:
1. `types/AuthoritativeState.ts`
2. `types/SharedState.ts`
3. `types/UIState.ts`
4. `types/Messages.ts`
5. `types/index.ts`

**验收:** `npm run typecheck` 通过

### Step 2: 纯函数 (1.5 小时)

创建以下文件，严格按照第 4 节规格:
1. `pure/StateMapper.ts`
2. `pure/VoteSettlement.ts` (从 legacy 重命名)
3. `pure/DeathCalculator.ts`
4. `pure/index.ts`

**验收:** 
- `npm run typecheck` 通过
- 单元测试覆盖所有纯函数

### Step 3: Core 服务 (2 小时)

创建以下文件，严格按照第 4 节规格:
1. `core/NightFlowController.ts`
2. `core/ActionProcessor.ts`
3. `core/SeatManager.ts`
4. `core/RoleAssigner.ts`
5. `core/AudioPlayer.ts`
6. `core/index.ts`

**验收:**
- `npm run typecheck` 通过
- 单元测试覆盖关键路径

### Step 4: Infra (1 小时)

创建以下文件，严格按照第 4 节规格:
1. `infra/BroadcastChannel.ts`
2. `infra/RoomRepository.ts`
3. `infra/StateStorage.ts`
4. `infra/index.ts`

**验收:** `npm run typecheck` 通过

### Step 5: HostEngine + PlayerClient (2 小时)

创建以下文件，严格按照第 4 节规格:
1. `HostEngine.ts`
2. `PlayerClient.ts`

**验收:**
- `npm run typecheck` 通过
- 单元测试覆盖主要流程

### Step 6: GameFacade (1 小时)

创建以下文件，严格按照第 4 节规格:
1. `GameFacade.ts`
2. `index.ts`

**验收:** `npm run typecheck` 通过

### Step 7: useGameRoom (1 小时)

创建以下文件，严格按照第 4 节规格:
1. `hooks/useGameRoom.ts` (V2)

**验收:** `npm run typecheck` 通过

### Step 8: 集成测试 (2 小时)

1. 运行完整 Jest 测试
2. 运行 E2E 测试
3. 修复所有失败

### Step 9: 清理 (30 分钟)

1. 删除 `legacy/` 目录
2. 更新所有 import
3. 最终验证

---

## 8. 验收检查表

### 8.1 架构验收

- [ ] 每个模块行数 <= 上限
- [ ] 每个模块只 import 白名单依赖
- [ ] 没有循环依赖
- [ ] 所有类型定义在 `types/`
- [ ] 所有纯函数在 `pure/`

### 8.2 Host-is-Player 验收

- [ ] `GameFacade.submitAction` 对 Host/Player 走相同路径
- [ ] `toUIState` 是唯一的 UIState 来源
- [ ] 没有 `if (isHost) { 特殊UI逻辑 }`
- [ ] Host 可以入座、看牌、行动

### 8.3 Night-1-Only 验收

- [ ] 没有 `nightNumber` 字段
- [ ] 没有 `previousNightActions` 字段
- [ ] 没有跨夜规则

### 8.4 Single Source of Truth 验收

- [ ] `AuthoritativeState` 只在 `HostEngine` 持有
- [ ] `SharedState` 从 `toSharedState()` 派生
- [ ] `UIState` 从 `toUIState()` 派生
- [ ] 没有字段在多处存储

### 8.5 功能验收

- [ ] `npm run typecheck` 通过
- [ ] `npm run lint:fix` 无错误
- [ ] `npm run test` 通过
- [ ] E2E 基础流程通过

---

## 附录 A: 模块依赖图

```
                    ┌──────────────┐
                    │ useGameRoom  │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  GameFacade  │
                    └──────┬───────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              │              ▼
     ┌────────────┐        │       ┌─────────────┐
     │ HostEngine │        │       │PlayerClient │
     └─────┬──────┘        │       └──────┬──────┘
           │               │              │
           │               ▼              │
           │        ┌──────────────┐      │
           │        │ pure/*       │      │
           │        │ StateMapper  │◄─────┘
           │        │ VoteSettle.  │
           │        │ DeathCalc.   │
           │        └──────────────┘
           │
           ├─────────────────────────────────────┐
           │                                     │
           ▼                                     ▼
    ┌──────────────┐                      ┌──────────────┐
    │   core/*     │                      │   infra/*    │
    │ NightFlow    │                      │ Broadcast    │
    │ ActionProc.  │                      │ RoomRepo     │
    │ SeatManager  │                      │ StateStorage │
    │ RoleAssign.  │                      └──────────────┘
    │ AudioPlayer  │
    └──────────────┘
           │
           ▼
    ┌──────────────┐
    │night/resolvers│
    └──────────────┘
           │
           ▼
    ┌──────────────┐
    │ models/roles │
    │ ROLE_SPECS   │
    │ SCHEMAS      │
    │ NIGHT_STEPS  │
    └──────────────┘
```

---

## 附录 B: 禁止事项速查

| 禁止事项 | 原因 |
|----------|------|
| `if (isHost) { 特殊UI逻辑 }` | Host-is-Player 原则 |
| `nightNumber` 字段 | Night-1-Only 原则 |
| `previousNightActions` | Night-1-Only 原则 |
| 在 types/ 写函数 | 类型定义只能有类型 |
| 在 pure/ 有副作用 | 纯函数不能有副作用 |
| core 模块直接访问 Supabase | 必须通过 infra |
| PlayerClient 处理游戏逻辑 | 只能发消息给 Host |
| 模块超过行数上限 | SRP 原则 |
| import 非白名单依赖 | 防止耦合 |

---

## 附录 C: 命名规范

| 类型 | 命名 | 示例 |
|------|------|------|
| 类型文件 | PascalCase.ts | `AuthoritativeState.ts` |
| 类 | PascalCase | `HostEngine` |
| 纯函数 | camelCase | `toUIState`, `settleWolfVotes` |
| 常量 | UPPER_SNAKE | `NIGHT_STEPS` |
| 接口 | PascalCase | `UIState` |
| 枚举 | PascalCase | `GameStatus` |
| 枚举值 | camelCase | `GameStatus.ongoing` |

---

**文档结束**

执行时必须逐条对照本文档。

如果发现设计有问题，**先更新文档，再改代码**。
