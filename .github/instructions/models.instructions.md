---
applyTo: src/models/**
---

# Model 层规范

## 核心原则

- **声明式内容 only**：`src/models/roles/**` 只允许 spec / schema / types 等声明式定义。
- **禁止副作用**：禁止 service 逻辑、禁止 import service、禁止 IO 操作。

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
