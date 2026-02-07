---
applyTo: src/screens/**/*.ts,src/screens/**/*.tsx
---

# Screen 层规范

## UI 风格统一（以 SettingsScreen 为标准）

- **Header**：`colors.surface` 背景 + `borderBottom`（`colors.border` + `fixed.divider`）。
- **返回/操作按钮**：方形 `componentSizes.avatar.md` × `avatar.md` + `colors.background` 背景 + `borderRadius.medium`。
- **内容卡片**：`colors.surface` 背景 + `borderRadius.large` + `shadows.sm`（**不用 border 描边**）。
- **页面背景**：`colors.background`。

## 性能模式（MUST follow）

1. **Styles factory 上提**：用 `createXxxScreenStyles(colors)` 集中创建，Screen 里 `useMemo` 只创建一次。
2. **子组件 memo 化**：`React.memo(Component, arePropsEqual)`，只比较 UI primitive + styles 引用。
3. **Handler 稳定化**：父级用 `useCallback` 固定回调引用。

## RoomScreen 交互三层分工

| 层 | 职责 | 位置 |
|---|---|---|
| **Policy** | 纯逻辑：输入 → Instruction（NOOP/ALERT/SUBMIT 等） | `src/screens/RoomScreen/policy/**` |
| **Orchestrator** | 调用 policy → 执行副作用 | RoomScreen / hooks |
| **Presentational** | 渲染 + 上报 intent | `src/screens/RoomScreen/components/**` |

## Actor Identity 三层语义

- `my*`：真实身份（展示用）。
- `effective*`：提交身份（向 Host 提交行动时使用）。
- `actor*`：UI 决策身份（policy / useRoomActions 使用）。

## Theme Token（MUST follow）

- 所有样式值必须来自 theme token，禁止硬编码。
- `componentSizes`、`fixed` 从 `src/theme/tokens` 直接导入。
- 详细规则见 `copilot-instructions.md` 的 "Theme Token 使用规范"。
