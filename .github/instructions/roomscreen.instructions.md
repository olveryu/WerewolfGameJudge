---
applyTo: src/screens/RoomScreen/**
description: 'Use when editing RoomScreen files: policy, hooks, executors, seatTap, components, share modules. Covers RoomScreen sub-directory structure and screen-specific conventions.'
---

# RoomScreen 规范

## 子目录

| 目录          | 职责                                                                    |
| ------------- | ----------------------------------------------------------------------- |
| `policy/`     | 纯逻辑 policy 函数（输入 → Instruction）                                |
| `hooks/`      | Screen 级 hooks（`useRoomScreenState` 等）                              |
| `components/` | RoomScreen 专属 UI 组件                                                 |
| `executors/`  | Action 执行器（从 hooks 拆出的执行层）                                  |
| `seatTap/`    | 座位点击交互逻辑                                                        |
| `share*.ts`   | 分享功能模块（shareImage / shareRoom / shareQRCode / shareNightReview） |

## Screen 总览

| Screen               | 位置                          | 职责                                    |
| -------------------- | ----------------------------- | --------------------------------------- |
| `HomeScreen`         | `screens/HomeScreen/`         | 主页 — 创建/加入房间入口                |
| `ConfigScreen`       | `screens/ConfigScreen/`       | 游戏配置 — 选择板子、角色、人数         |
| `RoomScreen`         | `screens/RoomScreen/`         | 房间主屏 — 座位、夜晚流程、所有游戏交互 |
| `EncyclopediaScreen` | `screens/EncyclopediaScreen/` | 角色图鉴                                |
| `SettingsScreen`     | `screens/SettingsScreen/`     | 用户设置                                |
| `Auth*Screen`        | `screens/AuthScreen/`         | 登录 / 注册 / 忘记密码 / 重置密码       |

RoomScreen UI 状态机速查参见 `docs/roomscreen-state-machine.md`。
