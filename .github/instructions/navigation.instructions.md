---
applyTo: src/navigation/**
---

# Navigation 层规范

## 核心原则

- ✅ React Navigation 路由定义与配置。
- ✅ 类型安全的路由参数（`RootStackParamList` 等）。
- ✅ Screen 组件注册（`Stack.Screen`）。
- ❌ 禁止在 navigation 文件中写业务逻辑。
- ❌ 禁止 import service（路由跳转由 screen 层调用 `navigation.navigate()`）。
- ❌ 禁止 `console.*`（使用命名 logger）。
