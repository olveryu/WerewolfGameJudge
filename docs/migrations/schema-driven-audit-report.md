# Schema-Driven 合规审查报告

> 扫描日期：2025-01-17
> 最后更新：2025-01-17
> 目标：识别所有非 schema-driven 的硬编码 UI 文案

---

## 📊 审查结论

| 类别 | 数量 | 是否红线 | 说明 |
|------|------|----------|------|
| ✅ 已完成 P0-P3 | 5 处 | - | 已迁移到 schema |
| 🟡 动态文案（带参数替换） | ~10 处 | **否** | 需要运行时数据 |
| 🟢 系统级通用文案 | ~15 处 | **否** | 与 schema 无关 |
| ⚪ 测试文件中的文案 | 多处 | **否** | 验证用途 |

---

## ✅ 已完成的迁移

### P0: 跳过确认 fallback ✅
**Commit**: `a0d700c`

删除了 `RoomScreen.tsx` 中的 `'确定不发动技能吗？'` fallback，改为 fail-fast。

---

### P1: Hunter/DarkWolfKing displayName ✅
**Commit**: `a0d700c`

角色名现在从 `getRoleDisplayName(myRole)` 获取，不再硬编码。

---

### P2: 梦魇封锁提示 schema-driven ✅
**Commit**: `a5a3432`

新增 `BLOCKED_UI_DEFAULTS` 常量：
```typescript
export const BLOCKED_UI_DEFAULTS = {
  title: '技能被封锁',
  message: '你被梦魇封锁了，本回合无法行动',
  skipButtonText: '跳过（技能被封锁）',
  dismissButtonText: '知道了',
} as const;
```

所有消费端（RoomScreen, useRoomActionDialogs, useRoomActions, GameStateService）已更新。

---

### P3: 女巫 promptTemplate ✅
**Commit**: `a5a3432`

在 `SchemaUi` 中新增 `promptTemplate` 字段：
```typescript
readonly promptTemplate?: string;  // "{seat}号被狼人杀了，是否使用解药？"
```

女巫 save step 已添加 `promptTemplate: '{seat}号被狼人杀了，是否使用解药？'`。

---

## 🟡 可接受（动态文案/需要运行时数据）

这些文案包含动态参数（座位号、玩家名等），需要运行时计算，放在 schema 中不太合适：

| 位置 | 文案 | 原因 |
|------|------|------|
| `useRoomActionDialogs.ts:111` | `${index + 1}号，请选择第二位玩家` | 魔术师交换，需要动态座位号 |
| `useRoomActionDialogs.ts:248` | `昨夜${ctx.killedIndex + 1}号玩家死亡` | 女巫上下文，需要动态数据 |
| `RoomScreen.tsx:172` | `该座位已被占用，请选择其他位置。` | 系统级入座错误 |
| `useRoomSeatDialogs.ts:89` | `${pendingSeatIndex + 1}号座已被占用` | 系统级入座错误 |

**建议**：这类文案可以定义为 **模板字符串** 放在 schema 中：
```typescript
ui: {
  seatOccupied: '${seat}号座已被占用',
}
```

---

## 🟢 可接受（系统级通用文案）

这些与游戏角色/行动 schema 无关，属于应用级 UI：

| 位置 | 文案 | 类型 |
|------|------|------|
| `ConfigScreen.tsx:173` | `请至少选择一个角色` | 配置验证 |
| `ConfigScreen.tsx:200` | `创建房间失败` | 系统错误 |
| `HomeScreen.tsx:311` | `请先登录后继续` | 认证提示 |
| `HomeScreen.tsx:328` | `登录失败` | 认证错误 |
| `HomeScreen.tsx:403` | `没有上局游戏记录` | 系统提示 |
| `RoomScreen.tsx:907` | `等待房主点击"准备看牌"分配角色` | 等待状态 |
| `useRoomSeatDialogs.ts:125` | `离开房间？` | 确认对话框 |
| `useRoomHostDialogs.ts:93` | `确定查看昨夜信息？` | Host 操作确认 |

**结论**：不属于 schema 范畴，保持现状

---

## 📋 迁移状态

| 优先级 | 任务 | 状态 | Commit |
|--------|------|------|--------|
| P0 | 删除 RoomScreen.tsx 的 fallback `'确定不发动技能吗？'` | ✅ 完成 | `a0d700c` |
| P1 | Hunter/DarkWolfKing displayName 改为 `getRoleDisplayName()` | ✅ 完成 | `a0d700c` |
| P2 | 梦魇封锁提示加入 BLOCKED_UI_DEFAULTS | ✅ 完成 | `a5a3432` |
| P3 | 女巫 save promptTemplate 支持 | ✅ 完成 | `a5a3432` |

---

## 🚦 遗留项目（可选）

以下项目可以在未来迭代中继续完善：

### 女巫 UI 完整模板化（P4）
`useRoomActionDialogs.ts` 中的女巫对话框文案：
- `'昨夜无人倒台'`
- `'昨夜倒台玩家为${seat}号（你自己）'`
- `'女巫无法自救'`
- `'请选择是否使用毒药'`

可添加到 schema：
```typescript
witchAction.steps[0].ui: {
  noKillMessage: '昨夜无人倒台',
  selfKillTitle: '昨夜倒台玩家为{seat}号（你自己）',
  selfKillMessage: '女巫无法自救',
}
witchAction.steps[1].ui: {
  poisonPrompt: '请选择是否使用毒药',
}
```
