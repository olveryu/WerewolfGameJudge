```instructions
---
applyTo: src/models/**
---

# Model 层规范

源代码在 `packages/game-engine/src/models/`，`src/models/` 下为 proxy stubs（详见 `game-engine.instructions.md`）。

## 规则

- 声明式内容（spec / schema / types / enums / 常量），纯函数查询/工厂（`getRoleSpec()`、`makeActionTarget()`、type guard `isActionTarget()`）。
- 禁止 import service / hooks / UI / contexts / navigation。禁止副作用（IO / 网络 / 音频 / Alert / `console.*`）。禁止 runtime 业务逻辑（状态迁移、resolver 计算、death calculation）。

## 三层表驱动（单一真相）

| 层 | 文件 | 职责 |
|---|---|---|
| `ROLE_SPECS` | `spec/specs.ts` | 角色固有属性（不随步骤变化） |
| `SCHEMAS` | `spec/schemas.ts` | 行动输入协议（约束/提示/meeting） |
| `NIGHT_STEPS` | `spec/nightSteps.ts` | Night-1 步骤顺序 + 音频 |

- Step id = 稳定 `SchemaId`，禁止 UI 文案作逻辑 key。`audioKey` 来自 `NIGHT_STEPS`，禁止 specs/steps 双写。
- 输入合法性写在 `SCHEMAS[*].constraints`（schema-first）。禁止跨夜约束（`previousActions` / `lastNightTarget` 等）。
- 狼刀中立：可刀任意座位（包括自己/狼队友），不加 `notSelf` / `notWolf`。
- `schema.meeting.canSeeEachOther`（开关："何时显示队友"）vs `ROLE_SPECS[role].wolfMeeting.canSeeWolves`（过滤："谁被高亮"）— 不是双写。

```
