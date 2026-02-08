---
applyTo: src/config/**
---

# Config 层规范

## 核心原则

- ✅ 纯配置值导出（Supabase URL/key、版本号等）。
- ✅ 环境变量读取与默认值。
- ✅ `as const` 收窄配置类型。
- ❌ 禁止 import service / hooks / UI 组件 / contexts / navigation。
- ❌ 禁止运行时业务逻辑。
- ❌ 禁止副作用（IO / 网络请求 / `console.*`）。
- ❌ 禁止存储可变状态。
