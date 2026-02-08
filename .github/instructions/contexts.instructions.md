---
applyTo: src/contexts/**
---

# Context 层规范

## 核心原则

- ✅ React Context 定义 + Provider 组件。
- ✅ 配套 `useXxxContext()` hook 封装（含 `null` guard + 明确错误信息）。
- ✅ Provider 内部允许调用 service / hooks 进行编排。
- ✅ `import type` 引用纯类型定义。
- ❌ 禁止在 Context 文件中直接写业务逻辑（resolver / state transition / night flow）。
- ❌ 禁止导出可变状态供外部直接修改（必须通过 dispatch / setter）。
- ❌ 禁止 `console.*`（使用命名 logger）。
- ❌ 禁止跨 Context 循环依赖。
