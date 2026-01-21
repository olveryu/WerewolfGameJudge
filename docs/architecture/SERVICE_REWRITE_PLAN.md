# 服务层完全重写方案 (v2.0)

> **文档版本**: 1.2.0
> **创建日期**: 2026-01-20
> **更新日期**: 2026-01-20
> **状态**: IN PROGRESS - Phase 3 进行中

---

## 执行进度

| Phase | 状态 | Commit | 说明 |
|-------|------|--------|------|
| Phase 1 | ✅ 完成 | `6edb2d7` | 116 files → legacy 文件夹 |
| Phase 2 | ✅ 完成 | `04d0304` | v2 骨架 + GameFacade (委托 legacy) |
| Phase 3 | 🔄 进行中 | 见下表 | 混合策略：重写 Engine + 保留 Resolver |
| Phase 4 | ⏳ 待开始 | - | 删除 legacy |

### Phase 3 详细进度

| 模块 | 状态 | Commit | Lines | Tests |
|------|------|--------|-------|-------|
| **Infra Layer** | | | | |
| StateStore | ✅ 完成 | `8c57be1` | ~370 | 21 |
| Transport | ✅ 完成 | `cf5a544` | ~280 | - |
| Storage | ✅ 完成 | `cf5a544` | ~120 | - |
| Audio | ✅ 完成 | `cf5a544` | ~100 | - |
| **Domain Layer** | | | | |
| SeatEngine | ✅ 完成 | `3445fa6` | ~240 | 14 |
| NightEngine | ✅ 完成 | `5da0ac4` | ~200 | 10 |
| PlayerEngine | ⏳ 待开始 | - | - | - |
| HostEngine | ⏳ 待开始 | - | - | - |

**当前测试统计**: v2 共 73 tests passing

---

## Phase 3 策略更新 (2026-01-20)

### 重写动机

1. **代码质量/可读性** - 消除 God Class，减少代码行数
2. **架构问题** - 解决循环依赖、职责混乱、重复代码
3. **性能优化** - 减少不必要的状态更新和广播
4. **可扩展性** - 方便后续添加新板子、新角色、多夜支持

### 混合策略

| 类别 | 策略 | 说明 |
|------|------|------|
| **重写** | Engine 类 | `HostEngine`, `PlayerEngine`, `NightEngine`, `SeatEngine` |
| **重写** | Infra 层 | `StateStore`, `Transport`, `Storage`, `Audio` |
| **重写** | 测试 | 针对新 Engine 编写新单元测试 |
| **保留** | Resolvers | 逻辑正确且有完善测试覆盖 |
| **保留** | DeathCalculator | 逻辑正确 |
| **保留** | 契约测试 | 作为重写的验证基准 |
| **保留** | 类型定义 | `LocalGameState`, `BroadcastGameState` 等 |

### 测试策略

| 测试类型 | 策略 | 原因 |
|---------|------|------|
| 契约测试 (`*.contract.test.ts`) | ✅ 保留 | 定义"正确行为"，是重写验证基准 |
| Resolver 测试 | ✅ 保留 | Resolver 保留不变 |
| 单元测试 | 🔄 重写 | 针对新 Engine 类编写 |
| 集成测试 | 🔄 重写 | 测试 GameFacade 与新 Engine 交互 |
| E2E 测试 | ✅ 保留 | 端到端行为验证 |

---

## 目录

1. [重写目标](#1-重写目标)
2. [迁移策略](#2-迁移策略)
3. [新架构设计](#3-新架构设计)
4. [文件结构](#4-文件结构)
5. [模块详细设计](#5-模块详细设计)
6. [API契约（不可更改）](#6-api契约不可更改)
7. [行为保证清单](#7-行为保证清单)
8. [迁移步骤](#8-迁移步骤)
9. [测试策略](#9-测试策略)
10. [风险与回退](#10-风险与回退)

---

## 1. 重写目标

### 1.1 问题总结

当前服务层（8266行，34个文件）存在以下问题：

| 问题类型 | 具体表现 |
|---------|---------|
| **职责混乱** | GameStateService 既是门面又包含业务逻辑 |
| **重复代码** | 6处 `stateManager.initialize()`，2处 `broadcastState()`，2处 `calculateDeaths()` |
| **死代码** | `HostCoordinator.initialize()`/`rejoin()` 从未被调用 |
| **循环依赖** | 通过 callback 解决但使代码难以理解 |
| **测试脆弱** | 测试依赖内部实现细节 |

### 1.2 重写后目标

| 指标 | 当前 | 目标 |
|-----|------|------|
| 总行数 | 8266 | ≤4000 |
| 最大单文件 | 892 (HostCoordinator) | ≤300 |
| 重复API | 10+ | 0 |
| 公共API方法数 | 150+ | ≤40 |
| 测试覆盖率 | ~70% | ≥90% |

### 1.3 不可更改的约束

1. **UI层接口不变**: `useGameRoom` hook 的返回值类型不变
2. **行为不变**: 所有现有功能保持完全一致
3. **类型不变**: `LocalGameState`, `GameStatus`, `BroadcastGameState` 保持不变

---

## 2. 迁移策略

### 2.1 Legacy 文件夹策略

```
src/services/
├── legacy/                          # 旧代码（只读，不修改）
│   ├── GameStateService.ts
│   ├── BroadcastService.ts
│   ├── ...
│   └── __tests__/                   # 旧测试
│       └── ...
├── v2/                              # 新代码
│   ├── index.ts                     # 统一导出
│   ├── facade/                      # 门面层
│   ├── domain/                      # 业务领域层
│   ├── infra/                       # 基础设施层
│   └── __tests__/                   # 新测试
└── index.ts                         # 入口 (重定向到 v2)
```

### 2.2 迁移阶段

```
Phase 1: 创建 legacy 文件夹，移动所有现有代码
         ↓
Phase 2: 创建 v2 骨架，实现 GameFacade (空壳，委托 legacy)
         ↓
Phase 3: 逐个替换 v2 模块，删除对 legacy 的依赖
         ↓
Phase 4: 删除 legacy 文件夹
```

---

## 3. 新架构设计

### 3.1 分层架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         UI Layer                                 │
│           (useGameRoom, useAuth, Screens, Components)            │
└─────────────────────────────────────┬───────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FACADE LAYER (1个文件)                      │
│                         GameFacade.ts                            │
│   - 唯一公共入口点                                                │
│   - 统一 Host/Player API                                         │
│   - 无业务逻辑                                                    │
└─────────────────────────────────────┬───────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
          ▼                           ▼                           ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│   DOMAIN LAYER      │   │   DOMAIN LAYER      │   │   DOMAIN LAYER      │
│   HostEngine.ts     │   │   PlayerEngine.ts   │   │   NightEngine.ts    │
│   (Host业务逻辑)     │   │   (Player业务逻辑)   │   │   (夜晚流程)         │
└─────────┬───────────┘   └─────────┬───────────┘   └─────────┬───────────┘
          │                         │                         │
          └─────────────────────────┼─────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                       INFRA LAYER (5个文件)                      │
│  StateStore.ts | Transport.ts | Storage.ts | Audio.ts | Auth.ts │
│  (状态存储)      (通信)         (持久化)     (音频)     (认证)     │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 核心原则

| 原则 | 说明 |
|-----|------|
| **单向依赖** | Facade → Domain → Infra，禁止反向依赖 |
| **无循环** | 禁止任何形式的循环依赖（包括 callback） |
| **事件驱动** | Domain 层通过事件通信，不直接调用 |
| **纯函数优先** | 业务逻辑尽量写成纯函数 |
| **单一真相源** | StateStore 是唯一状态存储 |

### 3.3 模块职责边界

| 模块 | 职责 | 禁止做的事 |
|-----|------|-----------|
| **GameFacade** | 路由到 Host/Player，订阅管理 | 任何业务逻辑 |
| **HostEngine** | Host 侧游戏流程控制 | 直接操作 UI，访问 Transport |
| **PlayerEngine** | Player 侧消息处理 | 直接操作状态，执行 Host 逻辑 |
| **NightEngine** | 夜晚步骤控制，音频调度 | 直接修改状态，直接广播 |
| **StateStore** | 状态存储和订阅 | 业务逻辑 |
| **Transport** | Supabase 通信 | 业务逻辑，状态管理 |
| **Storage** | AsyncStorage 持久化 | 业务逻辑 |

---

## 4. 文件结构

### 4.1 新目录结构

```
src/services/v2/
├── index.ts                          # 统一导出
│
├── facade/
│   ├── GameFacade.ts                 # 主门面 (~150行)
│   └── index.ts
│
├── domain/
│   ├── HostEngine.ts                 # Host 业务引擎 (~250行)
│   ├── PlayerEngine.ts               # Player 业务引擎 (~150行)
│   ├── NightEngine.ts                # 夜晚流程引擎 (~200行)
│   ├── SeatEngine.ts                 # 座位管理引擎 (~100行)
│   ├── DeathCalculator.ts            # 死亡计算 (纯函数, 现有保留)
│   ├── resolvers/                    # 角色 Resolvers (现有保留)
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── seer.ts
│   │   ├── witch.ts
│   │   └── ... (其他 resolver)
│   └── index.ts
│
├── infra/
│   ├── StateStore.ts                 # 状态存储 (~200行)
│   ├── Transport.ts                  # 通信层 (~200行)
│   ├── Storage.ts                    # 持久化 (~100行)
│   ├── Audio.ts                      # 音频服务 (~100行)
│   ├── Auth.ts                       # 认证服务 (~150行)
│   ├── Room.ts                       # 房间管理 (~100行)
│   └── index.ts
│
├── types/
│   ├── GameState.ts                  # 状态类型 (现有保留)
│   ├── Messages.ts                   # 消息类型 (合并现有)
│   ├── Events.ts                     # 内部事件类型
│   └── index.ts
│
└── __tests__/
    ├── unit/
    │   ├── GameFacade.test.ts
    │   ├── HostEngine.test.ts
    │   ├── PlayerEngine.test.ts
    │   ├── NightEngine.test.ts
    │   └── ...
    ├── integration/
    │   ├── host-flow.test.ts
    │   ├── player-flow.test.ts
    │   └── night-flow.test.ts
    └── contracts/
        ├── api-compat.test.ts        # 验证与旧 API 兼容
        └── behavior-compat.test.ts   # 验证行为一致
```

### 4.2 行数预算

| 文件 | 预算行数 | 职责 |
|-----|---------|------|
| `GameFacade.ts` | 150 | 门面，路由，订阅 |
| `HostEngine.ts` | 250 | Host 游戏流程 |
| `PlayerEngine.ts` | 150 | Player 消息处理 |
| `NightEngine.ts` | 200 | 夜晚流程控制 |
| `SeatEngine.ts` | 100 | 座位管理 |
| `StateStore.ts` | 200 | 状态管理 |
| `Transport.ts` | 200 | 通信层 |
| `Storage.ts` | 100 | 持久化 |
| `Audio.ts` | 100 | 音频 |
| `Auth.ts` | 150 | 认证 |
| `Room.ts` | 100 | 房间管理 |
| `DeathCalculator.ts` | 350 | 保留现有 |
| `resolvers/*` | 750 | 保留现有 |
| **总计** | **~2800** | |

---

## 5. 模块详细设计

### 5.1 GameFacade (门面层)

**职责**: 唯一公共入口，无业务逻辑

```typescript
// src/services/v2/facade/GameFacade.ts

export class GameFacade {
  private static instance: GameFacade;
  
  private readonly stateStore: StateStore;
  private readonly transport: Transport;
  private readonly hostEngine: HostEngine;
  private readonly playerEngine: PlayerEngine;
  
  private isHost: boolean = false;
  private myUid: string | null = null;
  private mySeatNumber: number | null = null;

  // ═══════════════════════════════════════════════════════════════
  // 公共 API（与现有 GameStateService 完全兼容）
  // ═══════════════════════════════════════════════════════════════
  
  // --- 状态访问 ---
  getState(): LocalGameState | null;
  isHostPlayer(): boolean;
  getMyUid(): string | null;
  getMySeatNumber(): number | null;
  getMyRole(): RoleId | null;
  getStateRevision(): number;
  getLastSeatError(): SeatError | null;
  clearLastSeatError(): void;
  getLastNightInfo(): string;
  
  // --- 订阅 ---
  addListener(listener: GameStateListener): () => void;
  
  // --- 房间生命周期 ---
  initializeAsHost(roomCode: string, hostUid: string, template: GameTemplate): Promise<void>;
  rejoinAsHost(roomCode: string, hostUid: string): Promise<void>;
  joinAsPlayer(roomCode: string, playerUid: string): Promise<void>;
  leaveRoom(): Promise<void>;
  clearSavedState(roomCode: string): Promise<void>;
  
  // --- 座位操作 ---
  takeSeat(seat: number, displayName?: string, avatarUrl?: string): Promise<boolean>;
  leaveSeat(): Promise<boolean>;
  takeSeatWithAck(...): Promise<{ success: boolean; reason?: string }>;
  leaveSeatWithAck(timeoutMs?: number): Promise<{ success: boolean; reason?: string }>;
  
  // --- Host 游戏控制 ---
  assignRoles(): Promise<void>;
  startGame(): Promise<void>;
  restartGame(): Promise<boolean>;
  updateTemplate(newTemplate: GameTemplate): Promise<void>;
  
  // --- Player 行动 ---
  playerViewedRole(): Promise<void>;
  submitAction(target: number | null, extra?: unknown): Promise<void>;
  submitWolfVote(target: number): Promise<void>;
  submitRevealAck(role: RoleId): Promise<void>;
  requestSnapshot(timeoutMs?: number): Promise<boolean>;
}
```

**实现要点**:
- `isHost` 判断后路由到 `hostEngine` 或 `playerEngine`
- 订阅统一走 `stateStore.subscribe()`
- 无任何业务逻辑，只是分发

---

### 5.2 HostEngine (Host 业务引擎)

**职责**: Host 侧所有业务逻辑

```typescript
// src/services/v2/domain/HostEngine.ts

export class HostEngine {
  constructor(
    private readonly stateStore: StateStore,
    private readonly transport: Transport,
    private readonly storage: Storage,
    private readonly nightEngine: NightEngine,
    private readonly seatEngine: SeatEngine,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════════════════
  
  async initialize(roomCode: string, hostUid: string, template: GameTemplate): Promise<void>;
  async rejoin(roomCode: string, hostUid: string): Promise<void>;
  
  // ═══════════════════════════════════════════════════════════════
  // 消息处理（由 Transport 回调）
  // ═══════════════════════════════════════════════════════════════
  
  async handlePlayerMessage(msg: PlayerMessage, senderId: string): Promise<void>;
  
  // ═══════════════════════════════════════════════════════════════
  // 游戏流程
  // ═══════════════════════════════════════════════════════════════
  
  async assignRoles(): Promise<void>;
  async startGame(): Promise<void>;
  async restartGame(): Promise<boolean>;
  async updateTemplate(newTemplate: GameTemplate): Promise<void>;
  
  // ═══════════════════════════════════════════════════════════════
  // 夜晚回调（由 NightEngine 调用）
  // ═══════════════════════════════════════════════════════════════
  
  async onRoleTurnStart(role: RoleId, pendingSeats: number[], stepId: SchemaId): Promise<void>;
  async onNightEnd(): Promise<void>;
  
  // ═══════════════════════════════════════════════════════════════
  // 内部方法
  // ═══════════════════════════════════════════════════════════════
  
  private async broadcastState(): Promise<void>;
  private calculateDeaths(): number[];
  private buildActionContext(): ActionContext;
}
```

**关键行为**:

1. **initialize()**: 创建初始状态 → 加入 Transport → 广播状态
2. **handlePlayerMessage()**: 根据消息类型路由到具体处理器
3. **startGame()**: 调用 `nightEngine.startNight()` 开始夜晚流程
4. **onNightEnd()**: 计算死亡 → 更新状态 → 广播

---

### 5.3 PlayerEngine (Player 业务引擎)

**职责**: Player 侧消息处理

```typescript
// src/services/v2/domain/PlayerEngine.ts

export class PlayerEngine {
  constructor(
    private readonly stateStore: StateStore,
    private readonly transport: Transport,
    private readonly seatEngine: SeatEngine,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // 消息处理（由 Transport 回调）
  // ═══════════════════════════════════════════════════════════════
  
  handleHostBroadcast(msg: HostBroadcast): void;
  
  // ═══════════════════════════════════════════════════════════════
  // 行动发送
  // ═══════════════════════════════════════════════════════════════
  
  async submitAction(target: number | null, extra?: unknown): Promise<void>;
  async submitWolfVote(target: number): Promise<void>;
  async submitRevealAck(role: RoleId): Promise<void>;
  async playerViewedRole(): Promise<void>;
  async requestSnapshot(timeoutMs: number): Promise<boolean>;
}
```

**关键行为**:

1. **handleHostBroadcast()**: 根据消息类型更新本地状态
2. **submitAction()**: 构建消息 → 发送到 Host
3. **requestSnapshot()**: 发送请求 → 等待响应 → 更新状态

---

### 5.4 NightEngine (夜晚流程引擎)

**职责**: 夜晚步骤控制和音频调度

```typescript
// src/services/v2/domain/NightEngine.ts

export interface NightEngineCallbacks {
  onRoleTurnStart: (role: RoleId, pendingSeats: number[], stepId: SchemaId) => Promise<void>;
  onNightEnd: () => Promise<void>;
}

export class NightEngine {
  private nightPlan: NightPlan | null = null;
  private currentStepIndex: number = 0;
  private phase: NightPhase = 'idle';
  
  constructor(
    private readonly audio: Audio,
    private readonly callbacks: NightEngineCallbacks,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // 控制
  // ═══════════════════════════════════════════════════════════════
  
  async startNight(roles: RoleId[]): Promise<{ success: boolean; error?: string }>;
  async advanceToNextAction(): Promise<void>;
  recordAction(role: RoleId, target: number): void;
  canAcceptAction(role: RoleId): boolean;
  reset(): void;
  
  // ═══════════════════════════════════════════════════════════════
  // 查询
  // ═══════════════════════════════════════════════════════════════
  
  getCurrentActionRole(): RoleId | null;
  getCurrentStepId(): SchemaId | null;
  isActive(): boolean;
}
```

**状态机**:

```
idle → nightBeginAudio → roleBeginAudio → waitingAction → roleEndAudio → [loop or] nightEndAudio → ended
```

---

### 5.5 StateStore (状态存储)

**职责**: 唯一状态存储，订阅管理

```typescript
// src/services/v2/infra/StateStore.ts

export class StateStore {
  private state: LocalGameState | null = null;
  private revision: number = 0;
  private listeners: Set<GameStateListener> = new Set();

  // ═══════════════════════════════════════════════════════════════
  // 状态访问
  // ═══════════════════════════════════════════════════════════════
  
  getState(): LocalGameState | null;
  getRevision(): number;
  hasState(): boolean;
  
  // ═══════════════════════════════════════════════════════════════
  // 状态修改（只能通过这些方法）
  // ═══════════════════════════════════════════════════════════════
  
  initialize(state: LocalGameState): void;
  update(updater: (current: LocalGameState) => Partial<LocalGameState>): void;
  reset(): void;
  incrementRevision(): number;
  
  // ═══════════════════════════════════════════════════════════════
  // 订阅
  // ═══════════════════════════════════════════════════════════════
  
  subscribe(listener: GameStateListener): () => void;
  notifyListeners(): void;
  
  // ═══════════════════════════════════════════════════════════════
  // 转换
  // ═══════════════════════════════════════════════════════════════
  
  toBroadcastState(): BroadcastGameState;
  applyBroadcastState(broadcast: BroadcastGameState, myUid: string, mySeat: number | null): void;
}
```

---

### 5.6 Transport (通信层)

**职责**: Supabase Realtime 通信抽象

```typescript
// src/services/v2/infra/Transport.ts

export interface TransportCallbacks {
  onHostBroadcast: (msg: HostBroadcast) => void;
  onPlayerMessage: (msg: PlayerMessage, senderId: string) => Promise<void>;
  onPresenceChange: (users: { id: string }[]) => void;
}

export class Transport {
  // ═══════════════════════════════════════════════════════════════
  // 连接管理
  // ═══════════════════════════════════════════════════════════════
  
  async joinRoom(roomCode: string, uid: string, callbacks: TransportCallbacks): Promise<void>;
  async leaveRoom(): Promise<void>;
  
  // ═══════════════════════════════════════════════════════════════
  // 发送（Host）
  // ═══════════════════════════════════════════════════════════════
  
  async broadcastAsHost(msg: HostBroadcast): Promise<void>;
  
  // ═══════════════════════════════════════════════════════════════
  // 发送（Player）
  // ═══════════════════════════════════════════════════════════════
  
  async sendToHost(msg: PlayerMessage): Promise<void>;
  
  // ═══════════════════════════════════════════════════════════════
  // 状态
  // ═══════════════════════════════════════════════════════════════
  
  getConnectionStatus(): ConnectionStatus;
  addStatusListener(listener: (status: ConnectionStatus) => void): () => void;
}
```

---

## 6. API契约（不可更改）

### 6.1 公共API签名

以下API签名从 `GameStateService` 继承，**不可更改**：

```typescript
// 这些签名必须与现有 GameStateService 完全一致
// useGameRoom hook 依赖这些签名

interface GameFacadePublicAPI {
  // 单例
  static getInstance(): GameFacade;
  
  // 状态访问
  getState(): LocalGameState | null;
  isHostPlayer(): boolean;
  getMyUid(): string | null;
  getMySeatNumber(): number | null;
  getMyRole(): RoleId | null;
  getStateRevision(): number;
  getLastSeatError(): { seat: number; reason: 'seat_taken' } | null;
  clearLastSeatError(): void;
  getLastNightInfo(): string;
  
  // 订阅
  addListener(listener: GameStateListener): () => void;
  
  // 房间
  initializeAsHost(roomCode: string, hostUid: string, template: GameTemplate): Promise<void>;
  rejoinAsHost(roomCode: string, hostUid: string): Promise<void>;
  joinAsPlayer(roomCode: string, playerUid: string, displayName?: string, avatarUrl?: string): Promise<void>;
  leaveRoom(): Promise<void>;
  clearSavedState(roomCode: string): Promise<void>;
  
  // 座位
  takeSeat(seat: number, displayName?: string, avatarUrl?: string): Promise<boolean>;
  leaveSeat(): Promise<boolean>;
  takeSeatWithAck(seat: number, displayName?: string, avatarUrl?: string, timeoutMs?: number): Promise<{ success: boolean; reason?: string }>;
  leaveSeatWithAck(timeoutMs?: number): Promise<{ success: boolean; reason?: string }>;
  
  // Host 控制
  assignRoles(): Promise<void>;
  startGame(): Promise<void>;
  restartGame(): Promise<boolean>;
  updateTemplate(newTemplate: GameTemplate): Promise<void>;
  
  // Player 行动
  playerViewedRole(): Promise<void>;
  submitAction(target: number | null, extra?: any): Promise<void>;
  submitWolfVote(target: number): Promise<void>;
  submitRevealAck(role: RoleId): Promise<void>;
  requestSnapshot(timeoutMs?: number): Promise<boolean>;
}
```

### 6.2 类型契约

以下类型**不可更改**（UI 层依赖）：

```typescript
// 保持现有定义
export { GameStatus } from './types/GameState';
export { LocalGameState, LocalPlayer, GameStateListener } from './types/GameState';
export { BroadcastGameState } from './types/Messages';
export { ConnectionStatus } from './infra/Transport';
```

### 6.3 行为契约

以下行为**必须保持一致**：

| 操作 | 行为 |
|-----|------|
| `initializeAsHost` | 创建状态 → 加入房间 → 广播状态 → 通知监听器 |
| `joinAsPlayer` | 加入房间 → 请求状态 |
| `takeSeat` (Host) | 直接修改状态 → 广播 |
| `takeSeat` (Player) | 发送请求 → 等待 ACK → 更新本地 |
| `startGame` | 开始夜晚流程 → 播放音频 → 广播角色回合 |
| `submitAction` | 验证 → 执行 Resolver → 更新状态 → 推进流程 |
| 夜晚结束 | 计算死亡 → 广播 NIGHT_END → 更新状态 |

---

## 7. 行为保证清单

### 7.1 Host 初始化流程

```
✅ 创建房间时:
   1. 创建初始 LocalGameState (status=unseated, players=empty Map)
   2. 加入 Supabase Realtime channel
   3. 广播 STATE_UPDATE
   4. 通知所有监听器
   5. 保存状态到 AsyncStorage

✅ 重新加入时:
   1. 从 AsyncStorage 加载状态
   2. 如果有状态: 恢复
   3. 如果无状态: 创建占位符
   4. 加入 channel
   5. 广播状态
```

### 7.2 Player 加入流程

```
✅ 加入房间时:
   1. 加入 Supabase Realtime channel
   2. 发送 REQUEST_STATE 消息
   3. 等待 STATE_UPDATE
   4. 应用状态到本地

✅ 坐下时:
   1. 发送 SIT 请求
   2. 等待 SEAT_ACTION_ACK
   3. 如果成功: 更新本地 mySeatNumber
   4. 如果失败: 设置 lastSeatError
```

### 7.3 夜晚流程

```
✅ 开始夜晚:
   1. 构建 NightPlan (从 template.roles)
   2. 播放 night.mp3
   3. 进入第一个角色回合

✅ 角色回合:
   1. 播放 role_begin.mp3
   2. 广播 ROLE_TURN (role, stepId, pendingSeats)
   3. 设置角色上下文 (witchContext, etc.)
   4. 等待行动

✅ 行动处理:
   1. 验证行动合法性 (schema constraints)
   2. 调用 Resolver
   3. 应用结果 (updates, reveal)
   4. 记录行动
   5. 播放 role_end.mp3
   6. 推进到下一个角色

✅ 夜晚结束:
   1. 播放 night_end.mp3
   2. 计算死亡 (DeathCalculator)
   3. 广播 NIGHT_END (deaths)
   4. 更新状态 (status=ended, lastNightDeaths)
```

### 7.4 死亡计算规则 (保持现有逻辑)

```
✅ 处理顺序:
   1. 魔术师交换 (swappedSeats)
   2. 狼人击杀 (考虑守卫、女巫解药)
   3. 女巫毒药
   4. 狼后连带
   5. 摄梦人效果
   6. 灵骑反弹
```

### 7.5 Resolver 调用契约 (保持现有逻辑)

```
✅ 每个 Resolver:
   - 输入: ResolverContext, ActionInput
   - 输出: { valid, rejectReason?, updates?, result?, reveal?, actionToRecord? }
   - 如果被梦魇阻止: valid=true, 无效果
   - 如果输入无效: valid=false, rejectReason
```

---

## 8. 迁移步骤

### Phase 1: Legacy 隔离 (Day 1)

```bash
# 1. 创建 legacy 文件夹
mkdir -p src/services/legacy

# 2. 移动所有现有文件
mv src/services/*.ts src/services/legacy/
mv src/services/__tests__ src/services/legacy/
mv src/services/action src/services/legacy/
mv src/services/broadcast src/services/legacy/
mv src/services/host src/services/legacy/
mv src/services/night src/services/legacy/
mv src/services/persistence src/services/legacy/
mv src/services/player src/services/legacy/
mv src/services/seat src/services/legacy/
mv src/services/state src/services/legacy/
mv src/services/types src/services/legacy/

# 3. 创建 legacy/index.ts 重新导出
# 4. 更新 src/services/index.ts 从 legacy 导入
```

**验证**: 所有测试通过，应用正常运行

### Phase 2: V2 骨架 (Day 2)

```bash
# 1. 创建 v2 目录结构
mkdir -p src/services/v2/{facade,domain,infra,types,__tests__/{unit,integration,contracts}}

# 2. 创建 GameFacade 空壳 (委托到 legacy)
# 3. 创建类型文件 (复制现有)
# 4. 更新 src/services/index.ts 从 v2 导出
```

**验证**: 所有测试通过

### Phase 3: 逐模块替换 (Day 3-7)

**顺序**:
1. `StateStore` (最底层，无依赖)
2. `Transport` (封装 Supabase)
3. `Storage` (封装 AsyncStorage)
4. `Audio` (封装音频)
5. `SeatEngine` (简单业务)
6. `NightEngine` (复杂业务)
7. `PlayerEngine` (依赖 StateStore, Transport)
8. `HostEngine` (依赖所有)
9. `GameFacade` (去除 legacy 依赖)

每完成一个模块:
- 运行所有测试
- 验证行为一致

### Phase 4: 清理 (Day 8)

```bash
# 1. 删除 legacy 文件夹
rm -rf src/services/legacy

# 2. 最终测试
npm run test
npm run typecheck
npm run lint:fix
```

---

## 9. 测试策略

### 9.1 契约测试 (最重要)

```typescript
// src/services/v2/__tests__/contracts/api-compat.test.ts

describe('API Compatibility', () => {
  it('GameFacade has all GameStateService public methods', () => {
    const facade = GameFacade.getInstance();
    
    // 验证所有公共方法存在且签名正确
    expect(typeof facade.getState).toBe('function');
    expect(typeof facade.initializeAsHost).toBe('function');
    // ... 所有方法
  });
});
```

### 9.2 行为测试

```typescript
// src/services/v2/__tests__/contracts/behavior-compat.test.ts

describe('Behavior Compatibility', () => {
  it('initializeAsHost creates correct initial state', async () => {
    const facade = GameFacade.getInstance();
    await facade.initializeAsHost('1234', 'host-uid', template);
    
    const state = facade.getState();
    expect(state?.status).toBe(GameStatus.unseated);
    expect(state?.players.size).toBe(template.numberOfPlayers);
    // ... 验证所有字段
  });
});
```

### 9.3 迁移测试

```typescript
// 在迁移期间，同时运行新旧测试确保行为一致
// legacy 测试继续运行，直到 Phase 4 删除
```

---

## 10. 风险与回退

### 10.1 风险

| 风险 | 概率 | 影响 | 缓解措施 |
|-----|------|------|---------|
| 行为不一致 | 中 | 高 | 契约测试覆盖所有场景 |
| 测试遗漏边界情况 | 中 | 中 | 保留 legacy 测试直到最后 |
| 性能回退 | 低 | 低 | 性能测试对比 |
| 迁移时间超预期 | 中 | 中 | 阶段性交付，每阶段可暂停 |

### 10.2 回退方案

每个 Phase 完成后 commit，如果 Phase N+1 失败:

```bash
git revert HEAD~<commits-in-phase-n+1>
```

### 10.3 决策记录

| 决策 | 原因 | 备选方案 | 为何不选 |
|-----|------|---------|---------|
| 分层架构 | 清晰职责边界 | 微服务 | 过度设计 |
| 单一 StateStore | 消除状态分散 | 每模块独立状态 | 同步困难 |
| 事件驱动通信 | 解耦模块 | 直接方法调用 | 产生循环依赖 |
| 保留 Resolvers | 逻辑正确，无需重写 | 重写 | 风险高，无收益 |

---

## 附录 A: 模块依赖图

```
                    GameFacade
                        │
           ┌────────────┼────────────┐
           │            │            │
           ▼            ▼            ▼
      HostEngine   PlayerEngine   (shared)
           │            │            │
           ├────────────┼────────────┤
           │            │            │
           ▼            ▼            ▼
      NightEngine  SeatEngine    StateStore
           │                         │
           ▼                         │
         Audio                       │
                                     │
           ┌─────────────────────────┤
           │                         │
           ▼                         ▼
       Transport                  Storage
```

---

## 附录 B: 新旧文件映射

| 旧文件 | 新位置 | 说明 |
|-------|-------|------|
| `GameStateService.ts` | `facade/GameFacade.ts` | 重写 |
| `host/HostCoordinator.ts` | `domain/HostEngine.ts` | 重写 |
| `player/PlayerCoordinator.ts` | `domain/PlayerEngine.ts` | 重写 |
| `night/NightFlowService.ts` | `domain/NightEngine.ts` | 重写 |
| `NightFlowController.ts` | 合并到 `NightEngine.ts` | 重写 |
| `state/StateManager.ts` | `infra/StateStore.ts` | 重写 |
| `broadcast/BroadcastCoordinator.ts` | `infra/Transport.ts` | 重写 |
| `BroadcastService.ts` | 合并到 `Transport.ts` | 重写 |
| `seat/SeatManager.ts` | `domain/SeatEngine.ts` | 重写 |
| `persistence/StatePersistence.ts` | `infra/Storage.ts` | 重写 |
| `AudioService.ts` | `infra/Audio.ts` | 简化 |
| `AuthService.ts` | `infra/Auth.ts` | 保留 |
| `SimplifiedRoomService.ts` | `infra/Room.ts` | 保留 |
| `DeathCalculator.ts` | `domain/DeathCalculator.ts` | **保留现有** |
| `WolfVoteResolver.ts` | 合并到 `resolvers/wolfVote.ts` | 合并 |
| `action/ActionProcessor.ts` | 合并到 `HostEngine.ts` | 合并 |
| `night/resolvers/*` | `domain/resolvers/*` | **保留现有** |
| `types/*` | `types/*` | **保留现有** |

---

## 附录 C: 检查清单

### 每日检查

- [ ] 所有测试通过
- [ ] TypeScript 无错误
- [ ] ESLint 无警告
- [ ] 应用可正常运行

### 阶段完成检查

- [ ] 契约测试通过
- [ ] 行为测试通过
- [ ] 无回退 (与 legacy 行为一致)
- [ ] 代码已 commit

### 最终检查

- [ ] 删除 legacy 后所有测试通过
- [ ] E2E 测试通过
- [ ] 行数符合预算 (≤4000)
- [ ] 无单文件超过 300 行

---

*文档结束 - 此方案不可修改，按此执行*
