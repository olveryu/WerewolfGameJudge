# PlayerActions 接口设计

> 创建日期: 2026-01-21
> 状态: 实施中

## 1. 问题背景

在 v2 架构中，Host 设备上的用户既是 Host（主持人）也是 Player（玩家）。之前的实现方式是在每个方法中单独处理 Host/Player 分支：

```typescript
async someMethod(...) {
  // Host mode
  if (this.hostEngine) {
    await this.hostEngine.hostSomeMethod(...);
    return;
  }
  // Player mode
  if (!this.playerEngine) return;
  await this.playerEngine.someMethod(...);
}
```

**问题：**
1. **容易遗漏** - 新增或修改方法时容易忘记处理 Host 模式
2. **重复代码** - 每个方法都有相同的模式判断
3. **违反 SRP** - HostEngine 混合了 Host 职责和 Player 行为
4. **无编译时保证** - 遗漏只能在运行时发现

## 2. 解决方案

### 2.1 核心思想

- 定义 `PlayerActions` 接口，描述所有玩家行为
- `PlayerEngine` 实现此接口（通过网络发送给 Host）
- `LocalPlayerAdapter` 实现此接口（本地调用 HostEngine 内部方法）
- `GameFacade` 通过 `getPlayerActions()` 获取正确的实现

### 2.2 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        GameFacade                            │
│  - 对外统一 API                                              │
│  - getPlayerActions() 返回正确的实现                         │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
     ┌─────────────────┐             ┌─────────────────┐
     │   HostEngine    │             │  PlayerEngine   │
     │  - Host 职责    │             │  implements     │
     │  - 游戏流程控制 │             │  PlayerActions  │
     │  - 处理玩家消息 │             │  (发消息给 Host)│
     └────────┬────────┘             └─────────────────┘
              │ 组合
              ▼
     ┌──────────────────────┐
     │  LocalPlayerAdapter  │
     │  implements          │
     │  PlayerActions       │
     │  (本地调用 Host 方法)│
     └──────────────────────┘
```

## 3. 接口定义

```typescript
// src/services/v2/domain/PlayerActions.ts

import type { RoleId } from '../../../models/roles';

/**
 * PlayerActions - 玩家行为接口
 * 
 * 定义所有玩家可以执行的行动。
 * PlayerEngine 和 LocalPlayerAdapter 都实现此接口。
 */
export interface PlayerActions {
  /**
   * 请求入座
   */
  takeSeat(seat: number, uid: string, displayName?: string, avatarUrl?: string): Promise<boolean>;
  
  /**
   * 请求离座
   */
  leaveSeat(seat: number, uid: string): Promise<boolean>;
  
  /**
   * 通知已查看角色
   */
  viewedRole(seat: number): Promise<void>;
  
  /**
   * 提交夜间行动
   */
  submitAction(seat: number, role: RoleId, target: number | null, extra?: unknown): Promise<void>;
  
  /**
   * 提交狼人投票
   */
  submitWolfVote(seat: number, target: number): Promise<void>;
  
  /**
   * 提交揭示确认
   */
  submitRevealAck(seat: number, role: RoleId, revision: number): Promise<void>;
}
```

## 4. 实现类

### 4.1 LocalPlayerAdapter

Host 设备上的本地玩家适配器，实现 `PlayerActions`，内部调用 HostEngine 的处理方法。

```typescript
// src/services/v2/domain/LocalPlayerAdapter.ts

export interface HostPlayerHandler {
  handleLocalTakeSeat(seat: number, uid: string, displayName?: string, avatarUrl?: string): Promise<boolean>;
  handleLocalLeaveSeat(seat: number, uid: string): Promise<boolean>;
  handleLocalViewedRole(seat: number): Promise<void>;
  handleLocalAction(seat: number, role: RoleId, target: number | null, extra?: unknown): Promise<void>;
  handleLocalWolfVote(seat: number, target: number): Promise<void>;
  handleLocalRevealAck(seat: number, role: RoleId, revision: number): Promise<void>;
}

export class LocalPlayerAdapter implements PlayerActions {
  constructor(private readonly hostHandler: HostPlayerHandler) {}
  
  // ... 每个方法委托给 hostHandler
}
```

### 4.2 PlayerEngine 更新

PlayerEngine 声明实现 `PlayerActions` 接口，确保方法签名一致。

### 4.3 HostEngine 更新

HostEngine 实现 `HostPlayerHandler` 接口，并组合 `LocalPlayerAdapter`。

## 5. Facade 层使用

```typescript
// GameFacade.ts

private getPlayerActions(): PlayerActions | null {
  if (this.hostEngine) {
    return this.hostEngine.getPlayerActions();
  }
  return this.playerEngine;
}

async submitAction(target: number | null, extra?: unknown): Promise<void> {
  const seat = this.getMySeatNumber();
  const role = this.getMyRole();
  const uid = this.myUid;
  if (seat === null || !role || !uid) return;
  
  const actions = this.getPlayerActions();
  if (!actions) return;
  
  await actions.submitAction(seat, role, target, extra);
}
```

## 6. 变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `domain/PlayerActions.ts` | 新增 | 接口定义 |
| `domain/LocalPlayerAdapter.ts` | 新增 | Host 本地玩家适配器 |
| `domain/HostEngine.ts` | 修改 | 实现 HostPlayerHandler，组合 LocalPlayerAdapter |
| `domain/PlayerEngine.ts` | 修改 | 声明实现 PlayerActions 接口 |
| `domain/index.ts` | 修改 | 导出新类型 |
| `facade/GameFacade.ts` | 修改 | 使用 getPlayerActions() |

## 7. 优势

1. **编译时保证** - 新增玩家行为必须在接口中定义，TypeScript 强制两边实现
2. **SRP** - HostEngine 只关心 Host 职责，LocalPlayerAdapter 处理玩家行为
3. **可测试** - LocalPlayerAdapter 可以独立 mock 测试
4. **清晰的依赖** - 使用 HostPlayerHandler 接口避免循环依赖
5. **扩展性** - 未来增加新的玩家行为只需在 PlayerActions 添加

## 8. 迁移步骤

1. 创建 `PlayerActions.ts` 接口
2. 创建 `LocalPlayerAdapter.ts` 实现
3. 修改 `HostEngine.ts` 实现 HostPlayerHandler，删除旧的 host* 方法
4. 修改 `PlayerEngine.ts` 声明实现 PlayerActions
5. 修改 `GameFacade.ts` 使用 getPlayerActions()
6. 更新测试
7. 运行 E2E 验证
