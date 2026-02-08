---
applyTo: src/models/**
---

# Model 层规范

## 核心原则

- ✅ 声明式内容（spec / schema / types / enums / 常量定义）。
- ✅ 纯函数查询/工厂（`getRoleSpec()`、`makeActionTarget()`、type guard `isActionTarget()`）— 仅从声明式数据派生，无副作用。
- ✅ 纯类型定义和导出（`type` / `interface` / `enum`）。
- ❌ 禁止 import service / hooks / UI 组件 / contexts / navigation。
- ❌ 禁止副作用（IO / 网络请求 / 音频 / Alert / `console.*`）。
- ❌ 禁止 runtime 业务逻辑（状态迁移、resolver 计算、death calculation）。

## 三层表驱动架构（单一真相）

| 层 | 文件 | 职责 |
|---|---|---|
| `ROLE_SPECS` | `src/models/roles/spec/specs.ts` | 角色固有属性（不随步骤变化） |
| `SCHEMAS` | `src/models/roles/spec/schemas.ts` | 行动输入协议（约束/提示/meeting） |
| `NIGHT_STEPS` | `src/models/roles/spec/nightSteps.ts` | Night-1 步骤顺序 + 音频 |

## 规则

- Step id 必须是稳定的 `SchemaId`，禁止使用 UI 文案作为逻辑 key。
- `audioKey` 必须来自 `NIGHT_STEPS`，禁止在 specs/steps 双写 audio key。
- 输入合法性必须写在 `SCHEMAS[*].constraints`（schema-first）。
- 禁止跨夜约束（`previousActions`、`lastNightTarget` 等）。
- 狼刀是中立的：可以刀任意座位（包括自己/狼队友），不要加 `notSelf`/`notWolf`。
- `schema.meeting.canSeeEachOther` 决定"何时显示队友"（开关）；`ROLE_SPECS[role].wolfMeeting.canSeeWolves` 决定"谁被高亮"（过滤）— 不是双写。
