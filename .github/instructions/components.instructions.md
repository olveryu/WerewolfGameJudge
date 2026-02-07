---
applyTo: src/screens/**/components/**
---

# UI 组件层规范

## 核心原则

- ✅ 渲染 UI + 上报用户 intent（`onPress` / `onChange` 回调）。
- ✅ 接收 styles prop（由父组件通过 `createXxxStyles(colors)` 创建并传入）。
- ✅ 视觉置灰（样式 / `activeOpacity` / `accessibilityState`）。
- ✅ `import type` 引用 `services/types/**` 的纯类型定义。
- ❌ 禁止 import services（runtime 值）、禁止 `showAlert`、禁止 navigation。
- ❌ 禁止组件内部做业务逻辑判断（gate 决策由 policy 层完成）。
- ❌ 禁止 `console.*`（使用命名 logger）。

## 性能模式（MUST follow）

- 使用 `React.memo(Component, arePropsEqual)` 做 memo 化。
- Styles 由父组件通过 `createXxxStyles(colors)` 创建并传入，子组件禁止各自 `StyleSheet.create`。
- 回调通过 props 传入，父组件用 `useCallback` 稳定化引用。

## 禁止组件层"吞点击"（Hard rule）

- ❌ 禁止用 `disabled={true}` 阻断 `onPress` 事件（RN 会直接不触发回调）。
- ❌ 禁止在 `onPress` 里 `if (xxx) return;` 作为业务 gate。
- ✅ 允许视觉置灰（样式 / activeOpacity / accessibilityState）。
- ✅ 所有 gate 决策由 policy 层完成（`src/screens/RoomScreen/policy/**`）。

## Theme Token（MUST follow）

- 所有颜色用 `colors.*`（来自 `useColors()`）。
- 间距用 `spacing.*`，字号用 `typography.*`，圆角用 `borderRadius.*`。
- `componentSizes`、`fixed` 必须从 `src/theme/tokens` 直接导入。
- ❌ 禁止硬编码：`'#xxx'`、`padding: 16`、`fontSize: 14`、`borderRadius: 12`。

## 卡片 / Banner 风格（SHOULD follow）

- 卡片用 `shadows.sm` + `borderRadius.large` + `colors.surface`，不用 border 描边。
- 全宽 bar 应卡片化（加 marginHorizontal + borderRadius + shadows）。
- Banner 用浅色背景（主色 + `'20'` 透明度后缀）+ `borderWidth: fixed.borderWidth` + `borderRadius.large`，文字用 `colors.text`。
