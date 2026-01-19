# 方案 D：GameStateService 职责分离重构 — 详细设计文档

> **状态**：待审批  
> **创建日期**：2026-01-19  
> **适用分支**：`refactor/remove-private-effect`  
> **重构策略**：完全重构，不追求向后兼容，如过程中发现问题将及时修复，有抉择时询问我。

---

## 1. 问题背景

### 1.1 当前架构问题：God Class

`GameStateService.ts` 是一个典型的 **God Class**，共 **2653 行代码**，违反单一职责原则 (SRP)。

当前承担的 **7 个职责**：

| # | 职责 | 行数估算 | 应归属模块 |
|---|------|---------|-----------|
| 1 | **状态管理** - 维护 `LocalGameState`，处理状态变更 | ~400 | `StateManager` |
| 2 | **广播通信** - 与 `BroadcastService` 交互，发送/接收状态 | ~300 | `BroadcastCoordinator` |
| 3 | **夜晚流程控制** - 管理 `NightFlowController` | ~500 | `NightFlowService` |
| 4 | **音频播放** - 调用 `AudioService` | ~100 | `NightFlowService` |
| 5 | **座位管理** - 处理坐下/站起请求 | ~400 | `SeatManager` |
| 6 | **角色行动处理** - 处理各类夜间行动 | ~600 | `ActionProcessor` |
| 7 | **存储持久化** - AsyncStorage 存取 | ~150 | `StatePersistence` |

**问题严重性**：
- 修改任何一个功能都可能影响其他功能
- 测试难以隔离
- 新开发者难以理解
- 难以并行开发

### 1.2 核心缺陷：Host/Player 双路径问题

当前 Host 更新状态的路径：

```
Host 修改 this.state
     ↓
broadcastState() → 创建 BroadcastGameState
     ↓
notifyListeners() → 通知 React 组件
     ↓
发送给 Players
```

Player 接收状态的路径：

```
收到 STATE_UPDATE
     ↓
handleHostBroadcast()
     ↓
if (this.isHost) return;  ← Host 忽略自己的广播
     ↓
applyStateUpdate() → 重建 this.state
     ↓
notifyListeners() → 通知 React 组件
```

**问题**：Host 有两个入口点修改状态并通知 UI：
1. 直接修改 `this.state` 后手动调用 `notifyListeners()`
2. 在 `broadcastState()` 中调用 `notifyListeners()`

这导致：
- **20+ 处** 散落的 `notifyListeners()` 调用
- 容易遗漏通知（如 `seerReveal` bug）
- 代码难以维护和测试

---

## 2. 目标

### 2.1 设计目标

1. **职责分离** - 将 God Class 拆分为 6 个独立模块
2. **单一状态更新入口** - 所有状态变更通过 `StateManager.updateState()`
3. **自动 UI 通知** - 状态变更自动触发 `notifyListeners()`
4. **Host/Player 路径统一** - 两者都通过相同接口读取状态
5. **可独立测试** - 每个模块可单独进行单元测试

### 2.2 非目标

- 本次不重构 NightFlowController 内部逻辑（只迁移调用方式）
- 本次不更改 BroadcastService 接口
- 本次不处理跨夜状态（Night-1-only 原则）

---

## 3. 架构设计

### 3.1 目标架构：6 个独立模块

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GameCoordinator                                    │
│  (原 GameStateService，现在只作为门面/协调器，约 200 行)                      │
│                                                                             │
│  职责：                                                                      │
│  - 初始化和组装各模块                                                        │
│  - 提供公开 API 给 UI 层                                                     │
│  - 协调模块间通信                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
┌─────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│  StateManager   │   │ BroadcastCoordinator│   │   NightFlowService  │
│  (~400 行)      │   │  (~300 行)          │   │   (~500 行)         │
│                 │   │                     │   │                     │
│ - state         │   │ - broadcastService  │   │ - nightFlow         │
│ - listeners     │◄──│ - handleHostMsg     │   │ - audioService      │
│ - revision      │   │ - broadcastState    │   │ - stepProgression   │
│                 │   │                     │   │                     │
│ + updateState() │   │ + broadcast()       │   │ + startNight()      │
│ + getState()    │   │ + requestSnapshot() │   │ + advanceStep()     │
│ + subscribe()   │   │                     │   │ + handleAudioEnd()  │
└─────────────────┘   └─────────────────────┘   └─────────────────────┘
          │                                               │
          │                                               │
          ▼                                               ▼
┌─────────────────┐                           ┌─────────────────────┐
│   SeatManager   │                           │  ActionProcessor    │
│  (~400 行)      │                           │   (~600 行)         │
│                 │                           │                     │
│ - pendingSeats  │                           │ - resolvers         │
│                 │                           │                     │
│ + sit()         │                           │ + handleAction()    │
│ + standUp()     │                           │ + handleWolfVote()  │
│ + processSeat() │                           │ + calculateDeaths() │
└─────────────────┘                           └─────────────────────┘
                                                          │
                                                          ▼
                                              ┌─────────────────────┐
                                              │  StatePersistence   │
                                              │   (~150 行)         │
                                              │                     │
                                              │ + saveState()       │
                                              │ + loadState()       │
                                              │ + clearState()      │
                                              └─────────────────────┘
```

### 3.2 模块职责定义

#### 3.2.1 StateManager（核心）

**职责**：纯状态管理，是整个系统的 Single Source of Truth

```typescript
// src/services/state/StateManager.ts

export interface StateManagerConfig {
  /** Host only: 状态变更后的广播回调 */
  onStateChange?: (state: BroadcastGameState, revision: number) => Promise<void>;
  /** 日志前缀 */
  logPrefix?: string;
}

export class StateManager {
  private state: LocalGameState | null = null;
  private listeners = new Set<GameStateListener>();
  private revision = 0;

  constructor(private config: StateManagerConfig = {}) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // 读取
  // ═══════════════════════════════════════════════════════════════════════════

  getState(): LocalGameState | null {
    return this.state;
  }

  getRevision(): number {
    return this.revision;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Host: 状态更新
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 更新状态 — Host 的唯一入口
   * 自动：increment revision → notify listeners → trigger broadcast callback
   */
  updateState(updater: (current: LocalGameState) => Partial<LocalGameState>): void {
    if (!this.state) throw new Error('State not initialized');

    const updates = updater(this.state);
    this.state = { ...this.state, ...updates };
    this.revision++;

    this.notifyListeners();

    // 触发广播
    if (this.config.onStateChange) {
      this.config.onStateChange(this.toBroadcastState(), this.revision)
        .catch(err => console.error('Broadcast failed:', err));
    }
  }

  /**
   * 批量更新（多个字段，一次广播）
   */
  batchUpdate(updates: Partial<LocalGameState>): void {
    this.updateState(() => updates);
  }

  /**
   * 初始化状态
   */
  initialize(state: LocalGameState): void {
    this.state = state;
    this.revision = 0;
    this.notifyListeners();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Player: 接收广播状态
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 应用从 Host 收到的状态
   * @returns 是否应用成功 + 当前用户座位号
   */
  applyBroadcastState(
    broadcast: BroadcastGameState,
    revision: number,
    myUid: string | null
  ): { applied: boolean; mySeat: number | null } {
    if (revision <= this.revision) {
      return { applied: false, mySeat: null };
    }

    this.revision = revision;
    const { state, mySeat } = this.broadcastToLocal(broadcast, myUid);
    this.state = state;
    this.notifyListeners();

    return { applied: true, mySeat };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 订阅
  // ═══════════════════════════════════════════════════════════════════════════

  subscribe(listener: GameStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 状态转换
  // ═══════════════════════════════════════════════════════════════════════════

  toBroadcastState(): BroadcastGameState {
    // 从 LocalGameState 转换为 BroadcastGameState
    // (迁移自 GameStateService.toBroadcastState)
  }

  private broadcastToLocal(
    broadcast: BroadcastGameState,
    myUid: string | null
  ): { state: LocalGameState; mySeat: number | null } {
    // 从 BroadcastGameState 转换为 LocalGameState
    // (迁移自 GameStateService.applyStateUpdate)
  }

  private notifyListeners(): void {
    const snapshot = this.state;
    this.listeners.forEach(listener => {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('Listener error:', err);
      }
    });
  }
}
```

#### 3.2.2 BroadcastCoordinator

**职责**：管理与 BroadcastService 的所有交互

```typescript
// src/services/broadcast/BroadcastCoordinator.ts

export interface BroadcastCoordinatorDeps {
  stateManager: StateManager;
  broadcastService: BroadcastService;
  isHost: () => boolean;
  getMyUid: () => string | null;
}

export class BroadcastCoordinator {
  constructor(private deps: BroadcastCoordinatorDeps) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 注册消息处理器
   */
  setupMessageHandlers(): void {
    this.deps.broadcastService.onHostBroadcast(msg => this.handleHostMessage(msg));
    this.deps.broadcastService.onPlayerMessage(msg => this.handlePlayerMessage(msg));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Host: 发送广播
  // ═══════════════════════════════════════════════════════════════════════════

  async broadcastState(state: BroadcastGameState, revision: number): Promise<void> {
    await this.deps.broadcastService.broadcastAsHost({
      type: 'STATE_UPDATE',
      state,
      revision,
    });
  }

  async broadcastRoleTurn(stepId: string): Promise<void> {
    await this.deps.broadcastService.broadcastAsHost({
      type: 'ROLE_TURN',
      stepId,
    });
  }

  async broadcastNightEnd(deaths: number[]): Promise<void> {
    await this.deps.broadcastService.broadcastAsHost({
      type: 'NIGHT_END',
      deaths,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 消息处理
  // ═══════════════════════════════════════════════════════════════════════════

  private handleHostMessage(msg: HostBroadcast): void {
    if (this.deps.isHost()) return; // Host 忽略自己的广播

    switch (msg.type) {
      case 'STATE_UPDATE':
        this.deps.stateManager.applyBroadcastState(
          msg.state,
          msg.revision,
          this.deps.getMyUid()
        );
        break;
      case 'ROLE_TURN':
        // 通知 NightFlowService 更新 stepId
        break;
      // ... 其他消息类型
    }
  }

  private handlePlayerMessage(msg: PlayerMessage): void {
    // Host 处理 Player 的请求
    // (座位请求、行动提交等)
  }
}
```

#### 3.2.3 SeatManager

**职责**：管理玩家座位的坐下/站起

```typescript
// src/services/seat/SeatManager.ts

export interface SeatManagerDeps {
  stateManager: StateManager;
  broadcastCoordinator: BroadcastCoordinator;
  isHost: () => boolean;
  getMyUid: () => string | null;
}

export class SeatManager {
  private pendingSeatRequests = new Map<string, PendingSeatRequest>();

  constructor(private deps: SeatManagerDeps) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // 公开 API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 请求坐下
   */
  async sit(seat: number, displayName: string): Promise<SeatResult> {
    if (this.deps.isHost()) {
      return this.processLocalSit(seat, displayName);
    } else {
      return this.requestRemoteSit(seat, displayName);
    }
  }

  /**
   * 请求站起
   */
  async standUp(seat: number): Promise<void> {
    if (this.deps.isHost()) {
      this.processLocalStandUp(seat);
    } else {
      this.requestRemoteStandUp(seat);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Host: 本地处理
  // ═══════════════════════════════════════════════════════════════════════════

  private processLocalSit(seat: number, displayName: string): SeatResult {
    const state = this.deps.stateManager.getState();
    if (!state) throw new Error('No state');

    // 验证座位是否空闲
    if (state.players.get(seat) !== null) {
      return { success: false, reason: 'seat_taken' };
    }

    // 更新状态
    const uid = this.deps.getMyUid();
    this.deps.stateManager.updateState(s => {
      const players = new Map(s.players);
      players.set(seat, {
        uid: uid!,
        seatNumber: seat,
        displayName,
        avatarUrl: null,
        role: null,
        hasViewedRole: false,
      });
      return { players };
    });

    return { success: true };
  }

  // ... 其他方法
}
```

#### 3.2.4 ActionProcessor

**职责**：处理所有夜间角色行动

```typescript
// src/services/action/ActionProcessor.ts

export interface ActionProcessorDeps {
  stateManager: StateManager;
  getTemplate: () => GameTemplate;
  getRoleSeatMap: () => Map<RoleId, number>;
}

export class ActionProcessor {
  constructor(private deps: ActionProcessorDeps) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // 行动处理
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 处理玩家行动
   */
  handleAction(schemaId: SchemaId, action: PlayerAction): ActionResult {
    const state = this.deps.stateManager.getState();
    if (!state) throw new Error('No state');

    // 验证行动
    const validation = this.validateAction(schemaId, action, state);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // 执行行动
    switch (schemaId) {
      case 'seer':
        return this.handleSeerCheck(action as TargetAction);
      case 'witch':
        return this.handleWitchAction(action as WitchAction);
      case 'wolfVote':
        return this.handleWolfVote(action as WolfVoteAction);
      // ... 其他角色
    }
  }

  private handleSeerCheck(action: TargetAction): ActionResult {
    const state = this.deps.stateManager.getState()!;
    const targetRole = state.players.get(action.targetSeat)?.role;
    const result = getSeerCheckResultForTeam(targetRole);

    this.deps.stateManager.updateState(s => ({
      seerReveal: { targetSeat: action.targetSeat, result },
      actions: new Map(s.actions).set('seer', action),
    }));

    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 狼人投票
  // ═══════════════════════════════════════════════════════════════════════════

  handleWolfVote(wolfSeat: number, targetSeat: number): void {
    this.deps.stateManager.updateState(s => {
      const wolfVotes = new Map(s.wolfVotes);
      wolfVotes.set(wolfSeat, targetSeat);
      return { wolfVotes };
    });

    // 检查是否所有狼人都已投票
    this.checkWolfVoteComplete();
  }

  private checkWolfVoteComplete(): void {
    const state = this.deps.stateManager.getState()!;
    const votingWolves = this.getVotingWolfSeats(state);
    
    if (state.wolfVotes.size >= votingWolves.length) {
      const resolvedTarget = resolveWolfVotes(state.wolfVotes);
      // 记录结果，触发下一步
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 死亡计算
  // ═══════════════════════════════════════════════════════════════════════════

  calculateDeaths(): number[] {
    const state = this.deps.stateManager.getState()!;
    const nightActions = this.buildNightActions(state);
    const roleSeatMap = this.deps.getRoleSeatMap();
    
    return calculateDeaths(nightActions, roleSeatMap);
  }
}
```

#### 3.2.5 NightFlowService

**职责**：管理夜晚流程和音频播放

```typescript
// src/services/night/NightFlowService.ts

export interface NightFlowServiceDeps {
  stateManager: StateManager;
  broadcastCoordinator: BroadcastCoordinator;
  actionProcessor: ActionProcessor;
  audioService: AudioService;
}

export class NightFlowService {
  private nightFlow: NightFlowController | null = null;

  constructor(private deps: NightFlowServiceDeps) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // 夜晚流程控制
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 开始夜晚
   */
  async startNight(): Promise<void> {
    const state = this.deps.stateManager.getState();
    if (!state) throw new Error('No state');

    const plan = buildNightPlan(state.template.roles);
    this.nightFlow = new NightFlowController(plan);

    this.deps.stateManager.updateState(() => ({
      status: GameStatus.ongoing,
      currentActionerIndex: 0,
    }));

    // 播放开场音频
    await this.playNightIntro();

    // 开始第一个步骤
    await this.advanceToNextStep();
  }

  /**
   * 推进到下一步骤
   */
  async advanceToNextStep(): Promise<void> {
    if (!this.nightFlow) return;

    const nextStep = this.nightFlow.advance();
    if (!nextStep) {
      // 夜晚结束
      await this.endNight();
      return;
    }

    // 更新状态
    this.deps.stateManager.updateState(() => ({
      currentActionerIndex: this.nightFlow!.getCurrentIndex(),
      currentStepId: nextStep.id,
    }));

    // 广播当前步骤
    await this.deps.broadcastCoordinator.broadcastRoleTurn(nextStep.id);

    // 播放音频
    await this.playStepAudio(nextStep);
  }

  /**
   * 结束夜晚
   */
  private async endNight(): Promise<void> {
    const deaths = this.deps.actionProcessor.calculateDeaths();

    this.deps.stateManager.updateState(() => ({
      status: GameStatus.ended,
      lastNightDeaths: deaths,
    }));

    await this.deps.broadcastCoordinator.broadcastNightEnd(deaths);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 音频控制
  // ═══════════════════════════════════════════════════════════════════════════

  private async playStepAudio(step: NightStep): Promise<void> {
    this.deps.stateManager.updateState(() => ({ isAudioPlaying: true }));

    await this.deps.audioService.play(step.audioKey);

    this.deps.stateManager.updateState(() => ({ isAudioPlaying: false }));
  }
}
```

#### 3.2.6 StatePersistence

**职责**：状态的持久化存储和恢复

```typescript
// src/services/persistence/StatePersistence.ts

const STORAGE_KEY_PREFIX = 'werewolf_game_state_';
const STATE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface StatePersistenceDeps {
  stateManager: StateManager;
}

export class StatePersistence {
  constructor(private deps: StatePersistenceDeps) {}

  /**
   * 保存状态到 AsyncStorage
   */
  async saveState(roomCode: string): Promise<void> {
    const state = this.deps.stateManager.getState();
    if (!state) return;

    const key = `${STORAGE_KEY_PREFIX}${roomCode}`;
    const data = {
      state: this.serializeState(state),
      revision: this.deps.stateManager.getRevision(),
      savedAt: Date.now(),
    };

    await AsyncStorage.setItem(key, JSON.stringify(data));
  }

  /**
   * 从 AsyncStorage 恢复状态
   */
  async loadState(roomCode: string): Promise<boolean> {
    const key = `${STORAGE_KEY_PREFIX}${roomCode}`;
    const raw = await AsyncStorage.getItem(key);
    
    if (!raw) return false;

    const data = JSON.parse(raw);
    
    // 检查是否过期
    if (Date.now() - data.savedAt > STATE_EXPIRY_MS) {
      await this.clearState(roomCode);
      return false;
    }

    const state = this.deserializeState(data.state);
    this.deps.stateManager.initialize(state);
    
    return true;
  }

  /**
   * 清除保存的状态
   */
  async clearState(roomCode: string): Promise<void> {
    const key = `${STORAGE_KEY_PREFIX}${roomCode}`;
    await AsyncStorage.removeItem(key);
  }

  private serializeState(state: LocalGameState): SerializedState {
    // Map 转换为 Object 等序列化处理
  }

  private deserializeState(data: SerializedState): LocalGameState {
    // Object 转换回 Map 等反序列化处理
  }
}
```

### 3.3 GameCoordinator（门面/协调器）

**职责**：组装所有模块，提供统一 API

```typescript
// src/services/GameCoordinator.ts

export class GameCoordinator {
  private static instance: GameCoordinator;

  // 内部模块
  private stateManager: StateManager;
  private broadcastCoordinator: BroadcastCoordinator;
  private seatManager: SeatManager;
  private actionProcessor: ActionProcessor;
  private nightFlowService: NightFlowService;
  private statePersistence: StatePersistence;

  // 身份信息
  private isHost = false;
  private myUid: string | null = null;
  private mySeatNumber: number | null = null;

  private constructor() {
    // 1. 创建 StateManager（核心）
    this.stateManager = new StateManager({
      onStateChange: (state, revision) => this.onStateChange(state, revision),
    });

    // 2. 创建 BroadcastCoordinator
    this.broadcastCoordinator = new BroadcastCoordinator({
      stateManager: this.stateManager,
      broadcastService: BroadcastService.getInstance(),
      isHost: () => this.isHost,
      getMyUid: () => this.myUid,
    });

    // 3. 创建 SeatManager
    this.seatManager = new SeatManager({
      stateManager: this.stateManager,
      broadcastCoordinator: this.broadcastCoordinator,
      isHost: () => this.isHost,
      getMyUid: () => this.myUid,
    });

    // 4. 创建 ActionProcessor
    this.actionProcessor = new ActionProcessor({
      stateManager: this.stateManager,
      getTemplate: () => this.stateManager.getState()!.template,
      getRoleSeatMap: () => this.buildRoleSeatMap(),
    });

    // 5. 创建 NightFlowService
    this.nightFlowService = new NightFlowService({
      stateManager: this.stateManager,
      broadcastCoordinator: this.broadcastCoordinator,
      actionProcessor: this.actionProcessor,
      audioService: AudioService.getInstance(),
    });

    // 6. 创建 StatePersistence
    this.statePersistence = new StatePersistence({
      stateManager: this.stateManager,
    });
  }

  static getInstance(): GameCoordinator {
    if (!GameCoordinator.instance) {
      GameCoordinator.instance = new GameCoordinator();
    }
    return GameCoordinator.instance;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 公开 API（给 UI 层调用）
  // ═══════════════════════════════════════════════════════════════════════════

  // --- 状态读取 ---
  getState(): LocalGameState | null {
    return this.stateManager.getState();
  }

  subscribe(listener: GameStateListener): () => void {
    return this.stateManager.subscribe(listener);
  }

  // --- 房间管理 ---
  async createRoom(roomCode: string, template: GameTemplate): Promise<void> {
    this.isHost = true;
    // 初始化状态...
  }

  async joinRoom(roomCode: string): Promise<void> {
    this.isHost = false;
    // 连接广播服务...
  }

  // --- 座位管理 ---
  sit(seat: number, displayName: string): Promise<SeatResult> {
    return this.seatManager.sit(seat, displayName);
  }

  standUp(seat: number): Promise<void> {
    return this.seatManager.standUp(seat);
  }

  // --- 游戏流程 ---
  startNight(): Promise<void> {
    return this.nightFlowService.startNight();
  }

  // --- 行动处理 ---
  handlePlayerAction(schemaId: SchemaId, action: PlayerAction): ActionResult {
    return this.actionProcessor.handleAction(schemaId, action);
  }

  handleWolfVote(wolfSeat: number, targetSeat: number): void {
    this.actionProcessor.handleWolfVote(wolfSeat, targetSeat);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 内部回调
  // ═══════════════════════════════════════════════════════════════════════════

  private async onStateChange(state: BroadcastGameState, revision: number): Promise<void> {
    if (!this.isHost) return;

    // 广播给其他玩家
    await this.broadcastCoordinator.broadcastState(state, revision);

    // 持久化
    await this.statePersistence.saveState(state.roomCode);
  }
}

// 导出别名以保持兼容（可选，迁移期间使用）
export { GameCoordinator as GameStateService };
```

---

## 4. 文件结构

### 4.1 新目录结构

```
src/services/
├── GameCoordinator.ts          # 门面/协调器 (~200 行)
├── index.ts                    # 导出
├── types/
│   └── GameStateTypes.ts       # 类型定义 (已存在)
│
├── state/
│   ├── StateManager.ts         # 状态管理器 (~400 行)
│   ├── index.ts
│   └── __tests__/
│       └── StateManager.test.ts
│
├── broadcast/
│   ├── BroadcastCoordinator.ts # 广播协调器 (~300 行)
│   ├── BroadcastService.ts     # 已存在，保持不变
│   ├── index.ts
│   └── __tests__/
│       └── BroadcastCoordinator.test.ts
│
├── seat/
│   ├── SeatManager.ts          # 座位管理器 (~400 行)
│   ├── index.ts
│   └── __tests__/
│       └── SeatManager.test.ts
│
├── action/
│   ├── ActionProcessor.ts      # 行动处理器 (~600 行)
│   ├── index.ts
│   └── __tests__/
│       └── ActionProcessor.test.ts
│
├── night/
│   ├── NightFlowService.ts     # 夜晚流程服务 (~500 行)
│   ├── NightFlowController.ts  # 已存在，保持不变
│   ├── resolvers/              # 已存在，保持不变
│   ├── index.ts
│   └── __tests__/
│       └── NightFlowService.test.ts
│
└── persistence/
    ├── StatePersistence.ts     # 状态持久化 (~150 行)
    ├── index.ts
    └── __tests__/
        └── StatePersistence.test.ts
```

### 4.2 代码行数对比

| 模块 | 重构前 | 重构后 |
|------|--------|--------|
| GameStateService.ts | 2653 行 | 删除 |
| GameCoordinator.ts | - | ~200 行 |
| StateManager.ts | - | ~400 行 |
| BroadcastCoordinator.ts | - | ~300 行 |
| SeatManager.ts | - | ~400 行 |
| ActionProcessor.ts | - | ~600 行 |
| NightFlowService.ts | - | ~500 行 |
| StatePersistence.ts | - | ~150 行 |
| **总计** | **2653 行** | **~2550 行** |

---

## 5. 迁移计划

### 5.1 阶段划分

| 阶段 | 内容 | 风险 | 预计工作量 |
|------|------|------|-----------|
| **Phase 1** | 创建 StateManager + 单元测试 | 低 | 3h |
| **Phase 2** | 创建 StatePersistence | 低 | 1h |
| **Phase 3** | 创建 BroadcastCoordinator | 中 | 3h |
| **Phase 4** | 创建 SeatManager | 中 | 3h |
| **Phase 5** | 创建 ActionProcessor | 高 | 5h |
| **Phase 6** | 创建 NightFlowService | 高 | 4h |
| **Phase 7** | 创建 GameCoordinator + 集成 | 高 | 3h |
| **Phase 8** | 删除 GameStateService + 全量测试 | 高 | 3h |

**总计**：约 25 小时工作量（3-4 天）

### 5.2 Phase 1：创建 StateManager

**目标**：创建核心状态管理模块

**文件变更**：
- 新增 `src/services/state/StateManager.ts`
- 新增 `src/services/state/index.ts`
- 新增 `src/services/state/__tests__/StateManager.test.ts`

**从 GameStateService 迁移**：
- `state: LocalGameState | null`
- `listeners: Set<GameStateListener>`
- `stateRevision: number`
- `notifyListeners()`
- `subscribe()`
- `toBroadcastState()`
- `applyStateUpdate()`

**验证**：
- StateManager 单元测试全部通过
- toBroadcastState snapshot 测试

### 5.3 Phase 2：创建 StatePersistence

**目标**：创建状态持久化模块

**文件变更**：
- 新增 `src/services/persistence/StatePersistence.ts`
- 新增 `src/services/persistence/index.ts`
- 新增 `src/services/persistence/__tests__/StatePersistence.test.ts`

**从 GameStateService 迁移**：
- `saveStateToStorage()`
- `loadStateFromStorage()`
- `clearStoredState()`
- `STORAGE_KEY_PREFIX`
- `STATE_EXPIRY_MS`

**验证**：
- 持久化读写测试通过

### 5.4 Phase 3：创建 BroadcastCoordinator

**目标**：创建广播通信模块

**文件变更**：
- 新增 `src/services/broadcast/BroadcastCoordinator.ts`
- 新增 `src/services/broadcast/index.ts`
- 新增 `src/services/broadcast/__tests__/BroadcastCoordinator.test.ts`

**从 GameStateService 迁移**：
- `handleHostBroadcast()`
- `handlePlayerMessage()`
- `broadcastState()`
- `requestSnapshot()`
- `handleSnapshotResponse()`

**验证**：
- 消息处理测试通过
- 广播发送测试通过

### 5.5 Phase 4：创建 SeatManager

**目标**：创建座位管理模块

**文件变更**：
- 新增 `src/services/seat/SeatManager.ts`
- 新增 `src/services/seat/index.ts`
- 新增 `src/services/seat/__tests__/SeatManager.test.ts`

**从 GameStateService 迁移**：
- `sitDown()`
- `standUp()`
- `processSeatAction()`
- `handleSeatActionAck()`
- `pendingSeatRequests`
- `lastSeatError`

**验证**：
- 座位操作测试通过
- 冲突检测测试通过

### 5.6 Phase 5：创建 ActionProcessor

**目标**：创建行动处理模块（最复杂）

**文件变更**：
- 新增 `src/services/action/ActionProcessor.ts`
- 新增 `src/services/action/index.ts`
- 新增 `src/services/action/__tests__/ActionProcessor.test.ts`

**从 GameStateService 迁移**：
- `handlePlayerAction()`
- `handleWolfVote()`
- `validateAction()`
- 所有角色特定的处理逻辑：
  - `handleSeerCheck()`
  - `handleWitchAction()`
  - `handleGuardAction()`
  - `handleHunterConfirm()`
  - 等等...
- `calculateDeaths()`
- `resolveWolfVotes()`

**验证**：
- 每个角色行动测试通过
- 死亡计算测试通过

### 5.7 Phase 6：创建 NightFlowService

**目标**：创建夜晚流程控制模块

**文件变更**：
- 新增 `src/services/night/NightFlowService.ts`
- 更新 `src/services/night/index.ts`
- 新增 `src/services/night/__tests__/NightFlowService.test.ts`

**从 GameStateService 迁移**：
- `nightFlow: NightFlowController`
- `startNight()`
- `advanceNightStep()`
- `handleNightEvent()`
- `endNight()`
- 音频播放相关逻辑

**验证**：
- 夜晚流程测试通过
- 步骤推进测试通过

### 5.8 Phase 7：创建 GameCoordinator

**目标**：创建门面/协调器，组装所有模块

**文件变更**：
- 新增 `src/services/GameCoordinator.ts`
- 更新 `src/services/index.ts`

**职责**：
- 初始化和组装所有模块
- 提供公开 API 给 UI 层
- 处理模块间依赖注入

**验证**：
- 集成测试通过
- UI 层调用正常

### 5.9 Phase 8：删除 GameStateService

**目标**：删除旧代码，完成迁移

**文件变更**：
- 删除 `src/services/GameStateService.ts`
- 更新所有 import 语句

**验证**：
- 全量 Jest 测试通过
- E2E 测试通过
- Lint 无错误

---

## 6. 详细设计：关键场景

### 6.1 场景：预言家查验

**重构前**（容易遗漏 notifyListeners）：
```
GameStateService.handlePlayerAction('seer', { targetSeat: 3 })
     ↓
验证 + 计算结果
     ↓
this.state.seerReveal = { targetSeat: 3, result: 'wolf' }
     ↓
broadcastState()
  └─ notifyListeners()  ← 当前 fix 位置，容易遗漏
  └─ 发送给 Players
     ↓
Host UI 读取 this.state.seerReveal → 显示弹窗
```

**重构后**（自动通知，无遗漏风险）：
```
GameCoordinator.handlePlayerAction('seer', { targetSeat: 3 })
     ↓
ActionProcessor.handleAction('seer', action)
     ↓
验证 + 计算结果
     ↓
StateManager.updateState(s => ({ seerReveal: { targetSeat: 3, result: 'wolf' } }))
     ↓
  ┌─ 自动 increment revision
  ├─ 自动 notifyListeners()  ← 不可能遗漏
  └─ 自动 onStateChange() → BroadcastCoordinator.broadcastState()
     ↓
Host UI 收到通知 → 显示弹窗
```

### 6.2 场景：Player 加入房间

**重构后**：
```
Player 连接 BroadcastService
     ↓
收到 STATE_UPDATE { state, revision }
     ↓
BroadcastCoordinator.handleHostMessage(msg)
     ↓
StateManager.applyBroadcastState(msg.state, msg.revision, myUid)
  ├─ revision 检查（跳过旧版本）
  ├─ broadcastToLocal() 转换状态
  ├─ 追踪 mySeat
  └─ notifyListeners()
     ↓
{ applied: true, mySeat: 3 }
     ↓
GameCoordinator.mySeatNumber = 3
     ↓
Player UI 更新
```

### 6.3 场景：狼人投票

**重构后**：
```
Wolf 1 提交投票
     ↓
GameCoordinator.handleWolfVote(wolfSeat=1, targetSeat=5)
     ↓
ActionProcessor.handleWolfVote(1, 5)
     ↓
StateManager.updateState(s => {
  const newVotes = new Map(s.wolfVotes);
  newVotes.set(1, 5);
  return { wolfVotes: newVotes };
})
     ↓
  ┌─ 自动 notifyListeners()
  └─ 自动广播
     ↓
ActionProcessor.checkWolfVoteComplete()
  ├─ 如果所有狼人已投票
  └─ 计算结果，触发 NightFlowService.advanceToNextStep()
```

### 6.4 场景：夜晚流程控制

**重构后**：
```
GameCoordinator.startNight()
     ↓
NightFlowService.startNight()
     ↓
buildNightPlan(template.roles)
     ↓
StateManager.updateState(() => ({
  status: GameStatus.ongoing,
  currentActionerIndex: 0,
}))
     ↓
playNightIntro()
     ↓
advanceToNextStep()
  ├─ nightFlow.advance() → 获取下一步骤
  ├─ StateManager.updateState() → 更新 currentStepId
  ├─ BroadcastCoordinator.broadcastRoleTurn() → 通知 Players
  └─ playStepAudio() → 播放音频
     ↓
等待行动或音频结束
     ↓
循环直到所有步骤完成
     ↓
endNight()
  ├─ ActionProcessor.calculateDeaths()
  ├─ StateManager.updateState() → 更新 lastNightDeaths
  └─ BroadcastCoordinator.broadcastNightEnd()
```

---

## 7. 测试策略

### 7.1 单元测试：每个模块独立测试

#### StateManager 测试

```typescript
// src/services/state/__tests__/StateManager.test.ts

describe('StateManager', () => {
  describe('updateState', () => {
    it('should update state and notify listeners', () => {
      const manager = new StateManager();
      const listener = jest.fn();
      manager.subscribe(listener);
      
      manager.initialize(createMockState());
      listener.mockClear();
      
      manager.updateState(s => ({ status: GameStatus.ongoing }));
      
      expect(listener).toHaveBeenCalledTimes(1);
      expect(manager.getState()?.status).toBe(GameStatus.ongoing);
    });

    it('should trigger onStateChange callback', async () => {
      const onStateChange = jest.fn().mockResolvedValue(undefined);
      const manager = new StateManager({ onStateChange });
      
      manager.initialize(createMockState());
      manager.updateState(s => ({ status: GameStatus.ongoing }));
      
      expect(onStateChange).toHaveBeenCalledWith(
        expect.objectContaining({ status: GameStatus.ongoing }),
        1
      );
    });

    it('should increment revision on each update', () => {
      const manager = new StateManager();
      manager.initialize(createMockState());
      
      expect(manager.getRevision()).toBe(0);
      manager.updateState(s => ({ status: GameStatus.ongoing }));
      expect(manager.getRevision()).toBe(1);
      manager.updateState(s => ({ status: GameStatus.ended }));
      expect(manager.getRevision()).toBe(2);
    });
  });

  describe('applyBroadcastState', () => {
    it('should skip stale updates', () => {
      const manager = new StateManager();
      manager.initialize(createMockState());
      
      manager.applyBroadcastState(createMockBroadcastState(), 5, 'user-123');
      
      const { applied } = manager.applyBroadcastState(
        createMockBroadcastState({ status: GameStatus.ended }),
        3, // stale
        'user-123'
      );
      
      expect(applied).toBe(false);
    });

    it('should track mySeat correctly', () => {
      const manager = new StateManager();
      const broadcast = createMockBroadcastState({
        players: { 3: { uid: 'user-123', seatNumber: 3, displayName: 'Test' } },
      });
      
      const { mySeat } = manager.applyBroadcastState(broadcast, 1, 'user-123');
      
      expect(mySeat).toBe(3);
    });
  });

  describe('toBroadcastState', () => {
    it('should convert seerReveal correctly', () => {
      const manager = new StateManager();
      manager.initialize(createMockState({
        seerReveal: { targetSeat: 3, result: 'wolf' },
      }));
      
      const broadcast = manager.toBroadcastState();
      
      expect(broadcast.seerReveal).toEqual({ targetSeat: 3, result: 'wolf' });
    });

    it('should include wolfVoteStatus', () => {
      const manager = new StateManager();
      const wolfVotes = new Map([[1, 5], [2, 5]]);
      manager.initialize(createMockState({ wolfVotes }));
      
      const broadcast = manager.toBroadcastState();
      
      expect(broadcast.wolfVoteStatus).toEqual({ 1: true, 2: true });
    });
  });
});
```

#### ActionProcessor 测试

```typescript
// src/services/action/__tests__/ActionProcessor.test.ts

describe('ActionProcessor', () => {
  describe('handleAction - seer', () => {
    it('should set seerReveal in state', () => {
      const stateManager = createMockStateManager();
      const processor = new ActionProcessor({ stateManager, ... });
      
      processor.handleAction('seer', { targetSeat: 3 });
      
      expect(stateManager.updateState).toHaveBeenCalledWith(
        expect.any(Function)
      );
      // 验证 updateState 的参数会设置 seerReveal
    });

    it('should reject invalid target', () => {
      const processor = new ActionProcessor({ ... });
      
      const result = processor.handleAction('seer', { targetSeat: 99 });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid');
    });
  });

  describe('handleWolfVote', () => {
    it('should update wolfVotes', () => {
      const stateManager = createMockStateManager();
      const processor = new ActionProcessor({ stateManager, ... });
      
      processor.handleWolfVote(1, 5);
      
      expect(stateManager.updateState).toHaveBeenCalled();
    });

    it('should trigger next step when all wolves voted', () => {
      // ... 测试投票完成后的行为
    });
  });

  describe('calculateDeaths', () => {
    it('should calculate deaths correctly', () => {
      // ... 死亡计算测试
    });
  });
});
```

### 7.2 集成测试

```typescript
// src/services/__tests__/GameCoordinator.integration.test.ts

describe('GameCoordinator Integration', () => {
  it('should handle complete night flow', async () => {
    const coordinator = GameCoordinator.getInstance();
    
    // 创建房间
    await coordinator.createRoom('1234', createMockTemplate());
    
    // 坐下
    await coordinator.sit(1, 'Player 1');
    await coordinator.sit(2, 'Player 2');
    // ...
    
    // 开始夜晚
    await coordinator.startNight();
    
    // 验证状态
    const state = coordinator.getState();
    expect(state?.status).toBe(GameStatus.ongoing);
  });

  it('should notify listeners on all state changes', async () => {
    const coordinator = GameCoordinator.getInstance();
    const listener = jest.fn();
    coordinator.subscribe(listener);
    
    await coordinator.createRoom('1234', createMockTemplate());
    listener.mockClear();
    
    // 任何状态变更都应触发通知
    await coordinator.sit(1, 'Player 1');
    expect(listener).toHaveBeenCalled();
    
    listener.mockClear();
    await coordinator.startNight();
    expect(listener).toHaveBeenCalled();
  });
});
```

### 7.3 E2E 测试

```bash
# 运行所有 Night 1 相关测试
npm run e2e -- --grep "Night 1"

# 运行座位相关测试
npm run e2e -- --grep "Seating"
```

---

## 8. 回滚计划

### 8.1 按 Phase 回滚

由于每个 Phase 都有独立提交，可以按需回滚：

| 阶段 | 回滚方式 | 影响 |
|------|---------|------|
| Phase 1-2 | `git revert` 相关 commits | 无影响，新模块未使用 |
| Phase 3-4 | `git revert` + 恢复 GameStateService 对应代码 | 中等 |
| Phase 5-6 | `git revert` + 恢复 GameStateService 对应代码 | 较大 |
| Phase 7 | 删除 GameCoordinator | 需恢复 GameStateService 导出 |
| Phase 8 | `git revert` + 恢复 GameStateService.ts | 完全回滚 |

### 8.2 完全回滚

如果需要完全回滚：

```bash
# 找到重构开始前的 commit
git log --oneline

# 回滚到重构前
git revert --no-commit <phase8-commit>..<phase1-commit>
git commit -m "Revert: GameStateService refactor"
```

---

## 9. 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 模块间依赖复杂 | 中 | 高 | 使用依赖注入，避免循环依赖 |
| 测试覆盖不足 | 中 | 高 | 每个模块 80%+ 覆盖率 |
| 性能退化 | 低 | 中 | 基准测试对比 |
| 状态同步问题 | 中 | 高 | 增加集成测试 |
| 工期延长 | 中 | 中 | 分阶段交付，每阶段可用 |

---

## 10. 对比分析

### 10.1 重构前 vs 重构后

| 维度 | 重构前 (God Class) | 重构后 (6 模块) |
|------|-------------------|-----------------|
| 代码行数 | 2653 行 / 1 文件 | ~2550 行 / 6+ 文件 |
| 单一职责 | ❌ 7 个职责混合 | ✅ 每模块 1 职责 |
| 可测试性 | ❌ 难以隔离测试 | ✅ 每模块可独立测试 |
| 可维护性 | ❌ 改一处影响多处 | ✅ 模块边界清晰 |
| 并行开发 | ❌ 容易冲突 | ✅ 可分模块开发 |
| 理解成本 | ❌ 需读完 2600+ 行 | ✅ 每模块 200-600 行 |
| 状态更新 | ❌ 20+ 处 notifyListeners | ✅ 单一入口 updateState |

### 10.2 方案对比回顾

| 维度 | 方案 A (当前 fix) | 方案 B/C | **方案 D (完全重构)** |
|------|------------------|----------|---------------------|
| 改动量 | 3 行 | 50-80 行 | **~2500 行** |
| 根治问题 | ❌ | ⚠️ 部分 | **✅ 完全** |
| 解决 God Class | ❌ | ❌ | **✅** |
| 长期收益 | 无 | 低-中 | **高** |
| 工作量 | 0.5h | 2-4h | **25h** |

### 10.3 为何选择方案 D

1. **根治 God Class** - 从根本上解决职责混乱问题
2. **单一状态入口** - 消除 20+ 处散落的 `notifyListeners()` 调用
3. **可测试性** - 每个模块可独立进行单元测试
4. **可维护性** - 模块边界清晰，改动影响范围可控
5. **可扩展性** - 添加新功能只需修改相关模块
6. **团队协作** - 多人可并行开发不同模块

---

## 11. 检查清单

### 11.1 实施前

- [ ] 用户确认 "开始"
- [ ] 确保分支干净（无未提交变更）
- [ ] 记录当前测试状态（113 tests passing）
- [ ] 备份当前 GameStateService.ts

### 11.2 每个 Phase 后

- [ ] 运行 `npm run lint:fix && npm run format:write`
- [ ] 运行模块单元测试（如 `npx jest --testPathPattern="StateManager"`）
- [ ] 运行相关集成测试
- [ ] 提交代码（独立 commit，便于回滚）
- [ ] 记录改动摘要

### 11.3 完成后

- [ ] 运行全量 Jest 测试
- [ ] 运行 E2E 测试
- [ ] 删除 GameStateService.ts
- [ ] 更新所有 import 语句
- [ ] 更新 copilot-instructions.md（如需要）
- [ ] 清理 TODO 注释
- [ ] 创建 PR

---

## 12. 总结

### 12.1 核心改进

本方案通过将 **2653 行的 God Class** 拆分为 **6 个职责单一的模块**：

| 模块 | 职责 | 约行数 |
|------|------|--------|
| `StateManager` | 纯状态管理 | 400 |
| `BroadcastCoordinator` | 广播通信 | 300 |
| `SeatManager` | 座位管理 | 400 |
| `ActionProcessor` | 行动处理 | 600 |
| `NightFlowService` | 夜晚流程 | 500 |
| `StatePersistence` | 状态持久化 | 150 |
| `GameCoordinator` | 门面/协调器 | 200 |

### 12.2 解决的问题

1. ✅ **God Class** → 职责分离
2. ✅ **20+ 散落的 notifyListeners()** → 单一 `updateState()` 入口
3. ✅ **seerReveal bug** → 自动通知机制
4. ✅ **难以测试** → 每模块可独立单元测试
5. ✅ **难以理解** → 每模块 200-600 行，职责清晰

### 12.3 工作量

**总计**：约 25 小时（3-4 天）

### 12.4 依赖关系图

```
                 GameCoordinator (门面)
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
  SeatManager    NightFlowService  BroadcastCoordinator
        │               │               │
        │               ▼               │
        │       ActionProcessor         │
        │               │               │
        └───────────────┼───────────────┘
                        │
                        ▼
                  StateManager ◄──── StatePersistence
                   (核心)
```

---

## 附录 A：全局 SRP 违规清单

> 本附录列出整个代码库中违反单一职责原则 (SRP) 的文件，按严重程度排序。
> **规则**：每个 class/module 不应超过 ~400 行或处理多个不相关的职责。

### A.1 严重违规（>600 行，必须重构）

| 文件 | 行数 | 问题 | 建议拆分 |
|------|------|------|----------|
| `src/services/GameStateService.ts` | 2652 | God Class，7 个职责混合 | 见本文档 Phase 1-8 |
| `src/screens/RoomScreen/RoomScreen.tsx` | 1183 | UI + 状态协调 + 多个 dialogs | 见 A.2 建议 |
| `src/models/Room.ts` | 939 | 模型定义 + 序列化 + 工具函数 + 游戏逻辑 | 见 A.2 建议 |
| `src/screens/SettingsScreen/SettingsScreen.tsx` | 875 | UI + 样式 + 多个独立功能区 | 提取子组件 |
| `src/screens/HomeScreen/HomeScreen.tsx` | 840 | UI + 样式 + 多个 modals | 提取子组件 |
| `src/screens/ConfigScreen/ConfigScreen.tsx` | 662 | UI + 样式 + 模板验证逻辑 | 提取子组件 |
| `src/screens/RoomScreen/hooks/useRoomActions.ts` | 655 | 多种 action intent 逻辑 | 按 schema kind 拆分 |

### A.2 中等违规（400-600 行，应当重构）

| 文件 | 行数 | 问题 | 建议拆分 |
|------|------|------|----------|
| `src/hooks/useGameRoom.ts` | 490 | 多个关注点：房间管理 + 座位 + 行动 + 连接 | 提取子 hooks |
| `src/services/BroadcastService.ts` | 432 | 类型定义 + 连接管理 + 消息处理 | 分离类型文件 |

### A.3 建议的重构方案

#### A.3.1 RoomScreen.tsx (1183 行)

**当前职责混合**：
1. 屏幕布局和导航
2. 状态读取和转换
3. 多个 dialog 的状态管理
4. Host/Player 分支逻辑
5. 夜晚进度显示

**建议拆分**：

```
src/screens/RoomScreen/
├── RoomScreen.tsx              # 只负责布局协调 (~200 行)
├── RoomScreen.helpers.ts       # ✅ 已存在，纯函数
├── hooks/
│   ├── useRoomInit.ts          # 初始化逻辑
│   ├── useRoomActions.ts       # ✅ 已存在，但需拆分
│   ├── useActionerState.ts     # ✅ 已存在
│   └── useRoomDialogs.ts       # 合并所有 dialog 状态 (新增)
├── components/
│   ├── RoomHeader.tsx          # 顶部导航 (新增)
│   ├── HostControlPanel.tsx    # Host 控制区 (新增)
│   ├── PlayerControlPanel.tsx  # Player 控制区 (新增)
│   └── ...existing components
└── dialogs/
    ├── ActionDialog.tsx        # 通用行动确认 (新增)
    ├── WolfVoteDialog.tsx      # 狼人投票 (新增)
    └── RevealDialog.tsx        # 查验结果 (新增)
```

#### A.3.2 Room.ts (939 行)

**当前职责混合**：
1. `Room` 接口定义
2. `GameRoomLike` 接口 (兼容层)
3. 序列化/反序列化
4. 游戏逻辑函数 (getWolfVoteSummary, getPlayersNotViewedRole 等)
5. 验证函数

**建议拆分**：

```
src/models/
├── Room.ts                     # 只保留 Room 接口 + createRoom (~150 行)
├── Room.types.ts               # 类型定义 (新增 ~100 行)
├── Room.serialization.ts       # 序列化/反序列化 (新增 ~200 行)
├── Room.queries.ts             # 查询函数 (新增 ~200 行)
│   ├── getWolfVoteSummary()
│   ├── getPlayersNotViewedRole()
│   ├── getCurrentActionerRole()
│   └── ...
└── Room.validation.ts          # 验证函数 (新增 ~100 行)
```

#### A.3.3 useRoomActions.ts (655 行)

**当前职责混合**：
1. ActionIntent 类型定义
2. Wolf vote 逻辑
3. Witch 逻辑
4. Seer/Psychic 逻辑
5. 其他角色逻辑
6. Bottom button 逻辑

**建议拆分**：

```
src/screens/RoomScreen/hooks/
├── useRoomActions.ts           # 协调器 (~150 行)
├── actions/
│   ├── types.ts                # ActionIntent 类型 (~50 行)
│   ├── wolfVote.ts             # 狼人投票逻辑 (~100 行)
│   ├── witch.ts                # 女巫逻辑 (~100 行)
│   ├── targetAction.ts         # 通用 target 逻辑 (~100 行)
│   ├── confirmAction.ts        # 确认类行动逻辑 (~100 行)
│   └── bottomButton.ts         # 底部按钮逻辑 (~100 行)
└── index.ts
```

#### A.3.4 useGameRoom.ts (490 行)

**建议拆分**：

```
src/hooks/
├── useGameRoom.ts              # 协调器 (~100 行)
├── useGameRoomConnection.ts    # 连接状态管理 (~100 行)
├── useGameRoomSeat.ts          # 座位操作 (~100 行)
├── useGameRoomActions.ts       # 游戏行动 (~150 行)
└── index.ts
```

#### A.3.5 Screen 组件通用模式

对于 `SettingsScreen`, `HomeScreen`, `ConfigScreen` 等超长 Screen 组件：

**问题模式**：
- 样式定义与组件混在一起
- 多个功能区块在同一文件
- Modal 状态和逻辑散落

**通用解决方案**：

```
src/screens/XxxScreen/
├── XxxScreen.tsx               # 主屏幕组件 (~200-300 行)
├── XxxScreen.styles.ts         # 样式定义 (提取)
├── components/
│   ├── XxxHeader.tsx           # 头部组件
│   ├── XxxSection1.tsx         # 功能区块 1
│   ├── XxxSection2.tsx         # 功能区块 2
│   └── ...
└── hooks/
    └── useXxxState.ts          # 状态逻辑
```

### A.4 重构优先级

| 优先级 | 文件 | 原因 |
|--------|------|------|
| P0 | `GameStateService.ts` | 核心问题，本文档主题 |
| P1 | `Room.ts` | 模型层基础，影响多处 |
| P1 | `useRoomActions.ts` | 行动逻辑复杂，易出 bug |
| P2 | `RoomScreen.tsx` | 已部分模块化，继续推进 |
| P2 | `useGameRoom.ts` | Hook 拆分相对简单 |
| P3 | `HomeScreen.tsx` | UI 组件，影响较小 |
| P3 | `SettingsScreen.tsx` | UI 组件，影响较小 |
| P3 | `ConfigScreen.tsx` | UI 组件，影响较小 |

### A.5 重构工作量估算（总计）

| 阶段 | 内容 | 工作量 |
|------|------|--------|
| 本文档 Phase 1-8 | GameStateService 重构 | 25h |
| A.3.2 | Room.ts 拆分 | 4h |
| A.3.3 | useRoomActions.ts 拆分 | 3h |
| A.3.1 | RoomScreen.tsx 组件化 | 6h |
| A.3.4 | useGameRoom.ts 拆分 | 2h |
| A.3.5 | Screen 组件样式提取 | 4h |
| **总计** | | **~44h** |

---

**等待用户确认 "开始" 后执行。**
