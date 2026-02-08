---
applyTo: src/utils/**
---

# Utils 层规范

## 核心原则

- ✅ 纯函数工具（无副作用、无业务逻辑）。
- ✅ 通用能力：logger、alert、random、id 生成、roomCode、shuffle、timeout。
- ✅ `logger.ts` 是全项目日志入口，提供命名 logger（`gameRoomLog`、`roomScreenLog` 等）。
- ✅ `random.ts` / `id.ts` 封装随机数/ID 生成，禁止业务代码直接调用 `Math.random()` / `crypto`。
- ❌ 禁止 import service / hooks / UI 组件 / contexts / navigation。
- ❌ 禁止业务逻辑（状态迁移、resolver 计算、night flow）。
- ❌ 禁止 `console.*`（logger 模块自身实现除外）。
- ❌ 禁止 `Math.random()` 直接调用（必须通过 `random.ts` 封装）。
