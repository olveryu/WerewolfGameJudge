# GameStateService 重構 V2 - 最終架構設計

> **狀態**：Phase 8a/8b/9 完成，Phase 8c 暫緩  
> **創建日期**：2026-01-20  
> **更新日期**：2026-01-20  
> **基於**：Phase 1-7 完成後的經驗總結  
> **目標**：將 GameStateService (1664 行) 減少到 ~150 行薄 Facade

## 進度更新

- ✅ Phase 8a：HostCoordinator 創建完成 (891 行)
- ✅ Phase 8b：PlayerCoordinator 創建完成 (469 行)
- ⏸️ Phase 8c：整合到 GameStateService（暫緩 - 需要更多規劃）
- ✅ Phase 9：刪除未使用的 GameCoordinator.ts

### 當前架構

```
GameStateService (1664 行) - 現有主入口，繼續工作
    │
    ├── StateManager (800 行)
    ├── BroadcastCoordinator (559 行)
    ├── SeatManager (583 行)
    ├── ActionProcessor (533 行)
    ├── NightFlowService (564 行)
    └── StatePersistence (264 行)

新創建但尚未整合：
    ├── HostCoordinator (891 行) - Host-only 邏輯（獨立可用）
    └── PlayerCoordinator (469 行) - Player-only 邏輯（獨立可用）
```

### 下一步計劃

1. 在 GameStateService 中逐步委託方法給 HostCoordinator/PlayerCoordinator
2. 每委託一個方法後運行測試確認
3. 最終將 GameStateService 重命名為 GameFacade

### 代碼行數統計

| 模組 | 行數 | 狀態 |
|------|------|------|
| GameStateService.ts | 1663 | 主入口（待精簡） |
| StateManager.ts | 794 | ✅ 完成 |
| BroadcastCoordinator.ts | 559 | ✅ 完成 |
| SeatManager.ts | 583 | ✅ 完成 |
| ActionProcessor.ts | 533 | ✅ 完成 |
| NightFlowService.ts | 564 | ✅ 完成 |
| StatePersistence.ts | 264 | ✅ 完成 |
| HostCoordinator.ts | 890 | ✅ 新建（未整合） |
| PlayerCoordinator.ts | 458 | ✅ 新建（未整合） |
| **總計** | 6308 | |

### Phase 8c 整合清單 (TODO)

**步驟 1：添加 Coordinator 成員**
- [ ] 在 GameStateService 中添加 `hostCoordinator: HostCoordinator`
- [ ] 在 GameStateService 中添加 `playerCoordinator: PlayerCoordinator`
- [ ] 在 constructor 中初始化並配置

**步驟 2：委託 Player 方法**
- [ ] `handleHostBroadcast` → `playerCoordinator.handleHostBroadcast`
- [ ] `requestSnapshot` → `playerCoordinator.requestSnapshot`
- [ ] `submitAction` → `playerCoordinator.submitAction`
- [ ] `submitWolfVote` → `playerCoordinator.submitWolfVote`
- [ ] `submitRevealAck` → `playerCoordinator.submitRevealAck`
- [ ] `playerViewedRole` → `playerCoordinator.playerViewedRole`

**步驟 3：委託 Host 方法**
- [ ] `initializeAsHost` → `hostCoordinator.initialize`
- [ ] `rejoinAsHost` → `hostCoordinator.rejoin`
- [ ] `handlePlayerMessage` → `hostCoordinator.handlePlayerMessage`
- [ ] `startGame` → `hostCoordinator.startGame`
- [ ] `restartGame` → `hostCoordinator.restartGame`
- [ ] `updateTemplate` → `hostCoordinator.updateTemplate`
- [ ] `assignRoles` → `hostCoordinator.assignRoles`

**步驟 4：刪除重複代碼**
- [ ] 從 GameStateService 刪除已委託的方法實現
- [ ] 重命名 GameStateService → GameFacade

---

## 1. 問題診斷

### 1.1 當前狀態 (Phase 7 完成後)

| 模組                    | 行數 | 職責                     | 問題                         |
| ----------------------- | ---- | ------------------------ | ---------------------------- |
| GameStateService.ts     | 1664 | God Class - 什麼都做     | 🔴 仍然太大，職責混亂        |
| StateManager.ts         | 800  | 狀態讀寫                 | ✅ 職責清晰                  |
| BroadcastCoordinator.ts | 559  | 網絡通訊                 | ✅ 職責清晰                  |
| SeatManager.ts          | 583  | 座位操作                 | ✅ 職責清晰                  |
| ActionProcessor.ts      | 533  | 行動處理（純函數）       | ✅ 職責清晰                  |
| NightFlowService.ts     | 564  | 夜間流程狀態機           | ✅ 職責清晰                  |
| StatePersistence.ts     | 264  | 本地持久化               | ✅ 職責清晰                  |
| GameCoordinator.ts      | 382  | 新協調層（未完成）       | ⚠️ 大部分是 TODO             |

**總計**：~5349 行（不含 GameCoordinator）

### 1.2 GameStateService 剩餘職責分析

通過代碼審查，GameStateService 目前仍然承擔以下職責：

| 職責類別             | 行數估算 | 具體內容                                                          |
| -------------------- | -------- | ----------------------------------------------------------------- |
| **房間生命週期**     | ~200     | initializeAsHost, rejoinAsHost, joinAsPlayer, leaveRoom           |
| **消息路由**         | ~150     | handleHostBroadcast, handlePlayerMessage, handleSnapshotResponse  |
| **夜間行動處理**     | ~250     | handlePlayerAction, handleWolfVote, handleRevealAck               |
| **遊戲流程控制**     | ~200     | startGame, restartGame, advanceToNextAction, endNight             |
| **角色上下文設置**   | ~50      | handleRoleTurnStart (witch/hunter context)                        |
| **玩家 API**         | ~100     | submitAction, submitWolfVote, submitRevealAck, playerViewedRole   |
| **工具方法**         | ~100     | broadcastState, buildActionContext, doCalculateDeaths             |
| **存取器/測試輔助**  | ~100     | getters, test helpers                                             |
| **成員變量/構造函數**| ~150     | 私有成員、構造函數、初始化                                        |
| **Facade 委託**      | ~50      | takeSeat/leaveSeat (委託給 SeatManager)                           |

---

## 2. 新架構設計

### 2.1 核心原則

1. **單一職責原則 (SRP)**：每個模組只做一件事
2. **依賴注入**：通過回調/接口注入依賴，便於測試
3. **Host/Player 分離**：Host 和 Player 走不同代碼路徑
4. **StateManager 是唯一狀態修改入口**：所有狀態變更必須通過 StateManager

### 2.2 模組拆分方案

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GameFacade (~150 行)                              │
│  - 單例入口點                                                                │
│  - 暴露公共 API：getState, addListener, takeSeat, submitAction, etc.        │
│  - 委託給 HostCoordinator 或 PlayerCoordinator                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
┌─────────────────────────────────┐         ┌─────────────────────────────────┐
│     HostCoordinator (~400)      │         │    PlayerCoordinator (~200)     │
│  - Host-only 邏輯               │         │  - Player-only 邏輯             │
│  - 處理玩家消息                 │         │  - 處理 Host 廣播               │
│  - 調用 NightFlowService        │         │  - 發送行動請求                 │
│  - 調用 ActionProcessor         │         │  - 狀態同步                     │
└─────────────────────────────────┘         └─────────────────────────────────┘
              │                                               │
              ▼                                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          共享服務層                                          │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│  StateManager   │ BroadcastCoord  │   SeatManager   │   StatePersistence    │
│  (狀態讀寫)     │ (網絡通訊)      │   (座位操作)    │   (本地持久化)        │
├─────────────────┼─────────────────┴─────────────────┴───────────────────────┤
│ ActionProcessor │                    NightFlowService                       │
│ (行動處理)      │                    (夜間流程)                              │
└─────────────────┴───────────────────────────────────────────────────────────┘
```

### 2.3 新模組職責定義

#### 2.3.1 GameFacade (~150 行)

**職責**：單例入口，API 路由

```typescript
class GameFacade {
  // 狀態訪問 - 委託給 StateManager
  getState(): LocalGameState | null
  addListener(listener): () => void
  getStateRevision(): number

  // 座位操作 - 委託給 SeatManager
  takeSeat(seat, displayName?, avatarUrl?): Promise<boolean>
  leaveSeat(): Promise<boolean>
  
  // 遊戲操作 - 委託給對應 Coordinator
  submitAction(target, extra?): Promise<void>
  submitWolfVote(target): Promise<void>
  submitRevealAck(role): Promise<void>
  playerViewedRole(): Promise<void>
  
  // Host-only 操作
  initializeAsHost(roomCode, hostUid, template): Promise<void>
  startGame(): Promise<void>
  restartGame(): Promise<boolean>
  updateTemplate(template): Promise<void>
  
  // Player-only 操作
  joinAsPlayer(roomCode, playerUid): Promise<void>
  leaveRoom(): Promise<void>
}
```

#### 2.3.2 HostCoordinator (~400 行) - 新建

**職責**：Host-only 邏輯，替代 GameStateService 中的 Host 部分

```typescript
class HostCoordinator {
  // 房間初始化
  initialize(roomCode, hostUid, template): Promise<void>
  rejoin(roomCode, hostUid): Promise<void>
  
  // 消息處理
  handlePlayerMessage(msg, senderId): Promise<void>
  handlePlayerAction(seat, role, target, extra?): Promise<void>
  handleWolfVote(seat, target): Promise<void>
  handleRevealAck(seat, role, revision): Promise<void>
  handleSeatActionRequest(msg): Promise<void>
  handleSnapshotRequest(msg): Promise<void>
  
  // 遊戲流程
  startGame(): Promise<void>
  restartGame(): Promise<boolean>
  updateTemplate(template): Promise<void>
  
  // 夜間流程回調
  handleRoleTurnStart(role, pendingSeats, stepId?): Promise<void>
  handleNightEnd(): Promise<void>
  
  // 狀態廣播
  broadcastState(): Promise<void>
}
```

#### 2.3.3 PlayerCoordinator (~200 行) - 新建

**職責**：Player-only 邏輯，替代 GameStateService 中的 Player 部分

```typescript
class PlayerCoordinator {
  // 房間加入
  join(roomCode, playerUid): Promise<void>
  leave(): Promise<void>
  
  // 處理 Host 廣播
  handleHostBroadcast(msg): void
  handleStateUpdate(state, revision): void
  handleRoleTurn(role, pendingSeats, options?): void
  handleNightEnd(deaths): void
  handleSeatActionAck(msg): void
  handleSnapshotResponse(msg): void
  
  // 發送請求
  submitAction(target, extra?): Promise<void>
  submitWolfVote(target): Promise<void>
  submitRevealAck(role): Promise<void>
  playerViewedRole(): Promise<void>
  requestSnapshot(): Promise<boolean>
}
```

### 2.4 現有模組調整

#### StateManager (保持 ~800 行)
- ✅ 已完成，無需大改
- 職責：狀態存儲、訂閱、序列化/反序列化

#### BroadcastCoordinator (保持 ~559 行)
- ✅ 已完成，無需大改
- 職責：網絡通訊，消息收發

#### SeatManager (保持 ~583 行)
- ✅ 已完成，無需大改
- 職責：座位入座/離座

#### ActionProcessor (保持 ~533 行)
- ✅ 已完成，無需大改
- 職責：行動驗證、Resolver 調用、死亡計算

#### NightFlowService (保持 ~564 行)
- ✅ 已完成，無需大改
- 職責：夜間流程狀態機、音頻播放

#### StatePersistence (保持 ~264 行)
- ✅ 已完成，無需大改
- 職責：AsyncStorage 持久化

---

## 3. 遷移計劃

### 3.1 Phase 8a：創建 HostCoordinator

**步驟**：
1. 創建 `src/services/host/HostCoordinator.ts`
2. 從 GameStateService 遷移 Host-only 方法：
   - `initializeAsHost`, `rejoinAsHost`
   - `handlePlayerMessage` (消息路由)
   - `handlePlayerAction`, `handleWolfVote`, `handleRevealAck`
   - `handleSeatActionRequest`, `handleSnapshotRequest`
   - `startGame`, `restartGame`, `updateTemplate`
   - `handleRoleTurnStart`, `endNight`, `advanceToNextAction`
   - `broadcastState`
3. 在 GameStateService 中委託給 HostCoordinator
4. 運行測試確認

**預計刪除行數**：~500 行

### 3.2 Phase 8b：創建 PlayerCoordinator

**步驟**：
1. 創建 `src/services/player/PlayerCoordinator.ts`
2. 從 GameStateService 遷移 Player-only 方法：
   - `joinAsPlayer`, `leaveRoom`
   - `handleHostBroadcast`
   - `handleStateUpdate`, `handleRoleTurn`, `handleNightEnd`
   - `handleSeatActionAck`, `handleSnapshotResponse`
   - `submitAction`, `submitWolfVote`, `submitRevealAck`
   - `playerViewedRole`, `requestSnapshot`
3. 在 GameStateService 中委託給 PlayerCoordinator
4. 運行測試確認

**預計刪除行數**：~300 行

### 3.3 Phase 8c：重命名為 GameFacade

**步驟**：
1. 將 GameStateService 重命名為 GameFacade
2. 刪除所有已遷移的代碼
3. 保留：
   - 單例模式
   - 公共 API（委託實現）
   - 成員變量和構造函數
4. 更新所有 import 語句
5. 運行測試確認

**最終 GameFacade 預計**：~150 行

### 3.4 Phase 9：刪除 GameCoordinator.ts

GameCoordinator.ts 目前大部分是 TODO，且與新設計重複。
完成 Phase 8 後刪除它。

---

## 4. 目錄結構

```
src/services/
├── GameFacade.ts          # ~150 行 - 單例入口
├── index.ts               # 導出
│
├── host/
│   ├── HostCoordinator.ts # ~400 行 - Host 協調器
│   └── index.ts
│
├── player/
│   ├── PlayerCoordinator.ts # ~200 行 - Player 協調器
│   └── index.ts
│
├── state/
│   ├── StateManager.ts    # ~800 行 - 狀態管理
│   └── index.ts
│
├── broadcast/
│   ├── BroadcastCoordinator.ts # ~559 行 - 網絡通訊
│   └── index.ts
│
├── seat/
│   ├── SeatManager.ts     # ~583 行 - 座位管理
│   └── index.ts
│
├── action/
│   ├── ActionProcessor.ts # ~533 行 - 行動處理
│   └── index.ts
│
├── night/
│   ├── NightFlowService.ts # ~564 行 - 夜間流程
│   ├── NightFlowController.ts
│   └── index.ts
│
├── persistence/
│   ├── StatePersistence.ts # ~264 行 - 持久化
│   └── index.ts
│
└── types/
    └── GameStateTypes.ts   # 類型定義
```

---

## 5. 風險評估

| 風險                       | 嚴重性 | 緩解措施                         |
| -------------------------- | ------ | -------------------------------- |
| Host/Player 邏輯交叉       | 中     | 仔細審查每個方法的調用方         |
| 遷移過程中測試失敗         | 低     | 每步完成後運行全部測試           |
| 回調依賴複雜               | 中     | 保持現有回調模式，不改變接口     |
| import 語句更新遺漏        | 低     | TypeScript 編譯會報錯            |

---

## 6. 成功標準

- [ ] GameFacade.ts ≤ 200 行
- [ ] 所有 1317 個測試通過
- [ ] TypeScript 編譯無錯誤
- [ ] ESLint 無錯誤
- [ ] E2E 測試通過（可選驗證）
- [ ] 每個模組職責單一、清晰

---

## 7. 附錄：方法遷移清單

### 7.1 遷移到 HostCoordinator

| 方法                        | 來源行數 | 說明                     |
| --------------------------- | -------- | ------------------------ |
| initializeAsHost            | 292-353  | 房間初始化               |
| rejoinAsHost                | 360-418  | Host 重新加入            |
| handlePlayerMessage         | 470-520  | 消息路由（switch）       |
| handlePlayerAction          | 722-795  | 處理玩家行動             |
| handleWolfVote              | 815-880  | 處理狼人投票             |
| handleRevealAck             | 527-562  | 處理揭示確認             |
| handleSeatActionRequest     | 568-581  | 座位請求（已委託）       |
| handleSnapshotRequest       | 586-603  | 快照請求                 |
| startGame                   | 1135-1162| 開始遊戲                 |
| restartGame                 | 1170-1204| 重新開始                 |
| updateTemplate              | 1210-1237| 更新模版                 |
| handleRoleTurnStart         | 1243-1289| 角色回合開始             |
| advanceToNextAction         | 1291-1320| 推進夜間                 |
| endNight                    | 1322-1376| 結束夜間                 |
| broadcastState              | (內聯)   | 廣播狀態                 |
| checkNightmareBlock         | 618-659  | 夢魘阻擋檢查             |
| rejectAction                | 665-680  | 拒絕行動                 |
| applyActionResult           | 692-719  | 應用行動結果             |
| finalizeWolfVote            | 886-930  | 完成狼人投票             |
| dispatchActionSubmittedAndAdvance | 802-815 | 派發事件並推進        |

### 7.2 遷移到 PlayerCoordinator

| 方法                        | 來源行數 | 說明                     |
| --------------------------- | -------- | ------------------------ |
| joinAsPlayer                | 424-449  | Player 加入房間          |
| leaveRoom                   | 454-518  | 離開房間                 |
| handleHostBroadcast         | 954-1013 | 處理 Host 廣播           |
| handleStateUpdate (內聯)    | -        | 狀態更新處理             |
| handleSeatActionAck         | 1016-1028| 座位 ACK                 |
| handleSnapshotResponse      | 1033-1061| 快照響應                 |
| applyStateUpdate            | 1066-1098| 應用狀態（已委託）       |
| submitAction                | 1500-1518| 發送行動                 |
| submitWolfVote              | 1520-1538| 發送狼投票               |
| submitRevealAck             | 1540-1564| 發送揭示確認             |
| playerViewedRole            | 1486-1498| 已查看角色               |
| requestSnapshot             | 1417-1478| 請求快照                 |
| takeSeatWithAck             | 1393-1406| 座位請求（已委託）       |
| leaveSeatWithAck            | 1408-1415| 離座請求（已委託）       |

### 7.3 保留在 GameFacade

| 方法                        | 說明                     |
| --------------------------- | ------------------------ |
| getInstance                 | 單例訪問                 |
| getState                    | 狀態訪問（委託）         |
| addListener                 | 訂閱（委託）             |
| isHostPlayer                | 角色查詢                 |
| getMyUid                    | 身份查詢                 |
| getMySeatNumber             | 座位查詢                 |
| getMyRole                   | 角色查詢                 |
| getLastSeatError            | 錯誤查詢（委託）         |
| clearLastSeatError          | 清除錯誤（委託）         |
| clearSavedState             | 清除存儲（委託）         |
| getStateRevision            | 版本查詢                 |
| getLastNightInfo            | 調試信息                 |
| __testGet*                  | 測試輔助                 |
