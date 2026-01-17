# Schema-Driven 合规审查报告

> 扫描日期：2025-01-17
> 目标：识别所有非 schema-driven 的硬编码 UI 文案

---

## 📊 审查结论

| 类别 | 数量 | 是否红线 | 说明 |
|------|------|----------|------|
| 🔴 游戏逻辑相关的角色特定文案 | 5 处 | **是** | 应迁移到 schema |
| 🟡 动态文案（带参数替换） | ~10 处 | **否** | 需要运行时数据 |
| 🟢 系统级通用文案 | ~15 处 | **否** | 与 schema 无关 |
| ⚪ 测试文件中的文案 | 多处 | **否** | 验证用途 |

---

## 🔴 红线项目（必须迁移到 schema）

### 1. Hunter/DarkWolfKing 角色名硬编码
**位置**：`src/screens/RoomScreen/RoomScreen.tsx:604-620`

```tsx
let roleDisplayName = '';
if (myRole === 'hunter') {
  roleDisplayName = '猎人';    // ❌ 硬编码
} else if (myRole === 'darkWolfKing') {
  roleDisplayName = '黑狼王';  // ❌ 硬编码
}
const statusMessage = canShoot
  ? `${roleDisplayName}可以发动技能`
  : `${roleDisplayName}不能发动技能`;
```

**应改为**：从 `getRoleSpec(myRole).displayName` 获取

**schema 扩展建议**：
```typescript
// 在 confirm schema 中添加
ui: {
  statusMessageCanAct: '${displayName}可以发动技能',
  statusMessageCannotAct: '${displayName}不能发动技能',
}
```

---

### 2. 梦魇封锁提示硬编码
**位置**：`src/screens/RoomScreen/RoomScreen.tsx:566-568`

```tsx
actionDialogs.showRoleActionPrompt(
  '技能被封锁',
  '你被梦魇封锁了，请点击下方按钮跳过',
  () => {}
);
```

**位置**：`src/screens/RoomScreen/useRoomActionDialogs.ts:103`

```tsx
showAlert('技能被封锁', '你被梦魇封锁了，本回合无法行动', ...);
```

**应改为**：添加到 schema 的 `blockedMessage` 字段

---

### 3. 跳过确认硬编码 fallback
**位置**：`src/screens/RoomScreen/RoomScreen.tsx:544`

```tsx
(skipStepSchema?.ui?.confirmText || intent.message || '确定不发动技能吗？'),
```

**问题**：最后一个 `'确定不发动技能吗？'` 是 fallback，违反 fail-fast

**应改为**：删除 fallback，确保所有 schema 都有 `ui.confirmText`

---

### 4. 女巫特殊场景硬编码
**位置**：`src/screens/RoomScreen/useRoomActionDialogs.ts:182-197`

```tsx
showAlert('昨夜无人倒台', '', ...);
showAlert(`昨夜倒台玩家为${killedIndex + 1}号（你自己）`, '女巫无法自救', ...);
showAlert(`昨夜倒台玩家为${killedIndex + 1}号`, '是否救助?', ...);
```

**应改为**：在 witchAction compound schema 的 save step 中添加：
```typescript
ui: {
  noKillMessage: '昨夜无人倒台',
  selfKillMessage: '昨夜倒台玩家为${seat}号（你自己）',
  selfKillHint: '女巫无法自救',
  killMessage: '昨夜倒台玩家为${seat}号',
  saveConfirmHint: '是否救助?',
}
```

---

### 5. 女巫毒药场景硬编码
**位置**：`src/screens/RoomScreen/useRoomActionDialogs.ts:210-223`

```tsx
showAlert('请选择是否使用毒药', '点击玩家头像使用毒药，如不使用毒药，请点击下方「不使用技能」', ...);
showAlert(`确定要毒杀${targetIndex + 1}号玩家吗？`, '', ...);
```

**应改为**：在 witchAction compound schema 的 poison step 中添加

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

## 📋 迁移优先级

| 优先级 | 任务 | 预估工作量 |
|--------|------|-----------|
| P0 | 删除 RoomScreen.tsx:544 的 fallback `'确定不发动技能吗？'` | 1 行 |
| P1 | Hunter/DarkWolfKing displayName 改为 `getRoleSpec().displayName` | ~10 行 |
| P2 | 梦魇封锁提示加入 schema | schema 扩展 + ~5 行 UI |
| P3 | 女巫 save/poison 动态提示加入 schema（模板字符串） | schema 扩展 + ~20 行 UI |

---

## 🚦 下一步

1. **你确认要执行哪些优先级？**
   - [ ] 只做 P0（最小 fail-fast 修复）
   - [ ] 做 P0 + P1（角色名 schema-driven）
   - [ ] 做全部 P0-P3（完整 schema-driven）

2. **P2-P3 需要 schema 类型扩展**，是否要我先设计 schema 结构？
