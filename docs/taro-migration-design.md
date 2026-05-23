# Taro 跨端小程序 + H5 方案设计

> 阶段 1 交付物：架构方案文档

## 1. 技术选型结论

### 1.1 Taro 版本与兼容性

| 项目       | 结论                                                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Taro 版本  | 4.x（当前最新稳定）                                                                                                                      |
| 框架       | `framework: 'react'`                                                                                                                     |
| 编译器     | `compiler: 'webpack5'`（生产稳定；Vite 仍实验）                                                                                          |
| React 版本 | React 18（Taro 4.x 官方支持；React 19 需验证——Taro JSX transform 依赖 react/jsx-runtime，React 19 已兼容该入口，**风险低但需 CI 验证**） |
| TypeScript | 5.x（Taro CLI 使用 ts-node/esbuild 加载 config，TS 5.9 无阻塞）                                                                          |
| 包管理     | pnpm workspace monorepo（`packages/taro-client`）                                                                                        |
| 目标平台   | 微信小程序 + H5 双端编译                                                                                                                 |

### 1.2 为什么选 Taro（非 uni-app / 原生微信开发）

- **React 生态复用**：团队已全 React，game-engine 类型/逻辑直接 import。
- **H5 同构输出**：一套代码同时编译小程序和浏览器版，维护成本最低。
- **微信原生能力直调**：`Taro.connectSocket` / `wx.login` / 转发卡片，绕开 web-view 安全确认页。
- **社区活跃**：京东主导，4.x 稳定迭代，NervJS/taro-docs 6k+ snippets。

### 1.3 风险点

| 风险                                           | 影响                               | 缓解方案                                      |
| ---------------------------------------------- | ---------------------------------- | --------------------------------------------- |
| React 19 兼容未官方确认                        | JSX runtime 可能有 breaking        | 初期锁 React 18；CI 加 Taro 编译 smoke test   |
| WebSocket 小程序限制（max 5 连接）             | 同时开 5 房间才触发；本 app 单房间 | 无需处理，仅文档备注                          |
| 小程序包体积限制（2MB 主包 / 20MB 总）         | 音频文件大                         | 音频走 CDN 动态加载，不打入包内               |
| CSS 能力差异（无 CSS Variables、有限 flexbox） | 主题切换复杂度增加                 | 编译期注入主题色值；H5 端可保留 CSS Variables |
| 小程序无 DOM API                               | 动画库不可用                       | 用 `wx.createAnimation` + CSS animation       |
| `@tarojs/plugin-http` 兼容性                   | 底层 XHR polyfill 可能有 edge case | 核心 HTTP 用 `Taro.request`（保证小程序原生） |

---

## 2. 目录结构设计

```
packages/taro-client/
├── config/
│   ├── index.ts          # defineConfig: mini + h5 配置
│   ├── dev.ts
│   └── prod.ts
├── project.config.json   # 微信小程序项目配置
├── package.json
├── tsconfig.json
├── src/
│   ├── app.ts            # Taro 入口（Provider wrapper）
│   ├── app.config.ts     # 全局路由配置 pages + tabBar
│   ├── app.scss          # 全局样式
│   │
│   ├── pages/
│   │   ├── home/
│   │   │   ├── index.tsx
│   │   │   └── index.config.ts
│   │   ├── room/
│   │   │   ├── index.tsx
│   │   │   └── index.config.ts
│   │   ├── auth/
│   │   │   ├── login.tsx
│   │   │   └── login.config.ts
│   │   └── settings/
│   │       ├── index.tsx
│   │       └── index.config.ts
│   │
│   ├── components/        # 可复用 UI 组件
│   │   ├── PlayerGrid/
│   │   ├── SeatTile/
│   │   ├── BottomActionPanel/
│   │   ├── NightProgressBar/
│   │   ├── ConnectionStatus/
│   │   └── RoleCard/
│   │
│   ├── adapters/          # 平台适配层（核心）
│   │   ├── storage.ts     # IStorageAdapter → Taro.get/setStorage
│   │   ├── transport.ts   # IRealtimeTransport → Taro.connectSocket / WebSocket
│   │   ├── audio.ts       # AudioPlaybackStrategy → InnerAudioContext / Web Audio
│   │   ├── haptics.ts     # Haptics → wx.vibrateShort / Vibration API
│   │   └── http.ts        # HTTP → Taro.request（小程序）/ fetch（H5）
│   │
│   ├── services/          # 业务服务（复用核心逻辑 + adapter）
│   │   ├── AuthService.ts
│   │   ├── ConnectionManager.ts  # 复用 FSM 逻辑
│   │   ├── RoomService.ts
│   │   └── RealtimeService.ts
│   │
│   ├── hooks/             # 共享 React Hooks
│   │   ├── useConnection.ts
│   │   ├── useGameState.ts
│   │   ├── useAuth.ts
│   │   └── useNightProgress.ts
│   │
│   ├── store/             # 状态管理（Zustand / useContext）
│   │   ├── gameStore.ts
│   │   └── authStore.ts
│   │
│   ├── theme/             # 主题 token（复用色值/间距）
│   │   ├── colors.ts
│   │   ├── spacing.ts
│   │   └── mixins.scss
│   │
│   ├── utils/             # 工具函数
│   │   ├── logger.ts
│   │   ├── platform.ts    # 平台检测 + 条件分支
│   │   └── errorPipeline.ts
│   │
│   └── types/             # 项目类型定义
│       └── index.ts
│
├── assets/                # 静态资源（仅图标/图片，音频 CDN 加载）
│   └── icons/
└── jest.config.js
```

---

## 3. 分层架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                         Pages (Taro)                              │
│  home/index.tsx │ room/index.tsx │ auth/login.tsx │ settings/     │
└────────────────────────┬─────────────────────────────────────────┘
                         │ React Hooks
┌────────────────────────▼─────────────────────────────────────────┐
│                     Hooks Layer                                    │
│  useGameState │ useConnection │ useAuth │ useNightProgress        │
└────────────────────────┬─────────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────────┐
│                   Services Layer                                   │
│  AuthService │ ConnectionManager (FSM) │ RoomService              │
└────────────────────────┬─────────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────────┐
│                 Platform Adapters                                  │
│  StorageAdapter │ TransportAdapter │ AudioAdapter │ HttpAdapter   │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Taro.set/   │  │ connectSocket│  │InnerAudio│  │Taro.request│ │
│  │ getStorage  │  │ (小程序)     │  │ Context  │  │ (小程序)  │ │
│  │─────────────│  │──────────────│  │──────────│  │──────────│  │
│  │ localStorage│  │ new WebSocket│  │Web Audio │  │  fetch   │  │
│  │ (H5)       │  │ (H5)         │  │ (H5)     │  │  (H5)   │  │
│  └─────────────┘  └──────────────┘  └──────────┘  └──────────┘ │
└──────────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────────┐
│               @werewolf/game-engine (直接 import)                 │
│  models │ protocol/types │ engine/handlers │ growth │ utils      │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. MVP 页面清单

### 4.1 页面 → 组件映射

| 页面   | 路由                    | 核心组件                                                                                                     | 对应现有 Screen |
| ------ | ----------------------- | ------------------------------------------------------------------------------------------------------------ | --------------- |
| 首页   | `/pages/home/index`     | CreateRoomCard, JoinRoomInput, RecentRoomList                                                                | HomeScreen      |
| 房间页 | `/pages/room/index`     | PlayerGrid, SeatTile, BottomActionPanel, NightProgressBar, ConnectionStatusBar, RoleCardModal, HeaderActions | RoomScreen      |
| 认证页 | `/pages/auth/login`     | WxLoginButton, EmailForm, AnonymousEntry                                                                     | AuthLoginScreen |
| 设置页 | `/pages/settings/index` | ProfileEditor, RoomCodeDisplay                                                                               | SettingsScreen  |

### 4.2 MVP 功能范围

**包含：**

- 创建房间 + 选择板子（预设模板）
- 加入房间（输入房间号 / 扫码 / 分享卡片）
- 座位网格（12 人）+ 入座/换座
- 夜晚流程（Host 操作 + 音频播放）
- 日间投票
- 角色查看（本人角色弹窗）
- 认证：匿名 + 微信 `wx.login` + 邮箱（H5）
- 分享：原生转发卡片（小程序） + URL 复制（H5）
- WebSocket 实时同步 + 断线重连

**明确排除：**

- 扭蛋 / 成长 / 外观定制 / 头像框 / 座位动画
- 百科全书
- 管理后台
- 刮刮卡 / 碎锁链等花式动画
- 背景音乐（MVP 后加入）

---

## 5. 平台差异处理策略

| 功能               | 小程序实现                                 | H5 实现                      | 统一策略                                                         |
| ------------------ | ------------------------------------------ | ---------------------------- | ---------------------------------------------------------------- |
| **WebSocket**      | `Taro.connectSocket` → SocketTask          | `new WebSocket()`            | TransportAdapter 抽象，接口统一为 `connect/send/close/onMessage` |
| **HTTP**           | `Taro.request`（自动带 referer）           | `fetch` API                  | HttpAdapter；401 重试 + token 注入逻辑复用                       |
| **Storage**        | `Taro.getStorageSync`/`setStorageSync`     | `localStorage`               | StorageAdapter：同步 get/set/remove/clear                        |
| **认证**           | `wx.login` → code → server exchange        | 邮箱/匿名                    | AuthService 内 `if (isMiniProgram)` 分支                         |
| **分享**           | `useShareAppMessage` → 原生卡片            | URL 复制 + QR Code           | ShareService 抽象                                                |
| **音频**           | `Taro.createInnerAudioContext`             | Web Audio / HTMLAudioElement | AudioAdapter；CDN URL 加载                                       |
| **触觉反馈**       | `wx.vibrateShort()`                        | `navigator.vibrate()`        | HapticsAdapter；H5 fallback 静默                                 |
| **路由**           | Taro page stack（navigateTo/Back）         | H5 history（Taro 自动处理）  | Taro.navigateTo/Back 统一 API                                    |
| **动画**           | CSS animation + `createAnimation`          | CSS animation + keyframes    | 简单动画用 CSS；复杂用 Canvas 2D                                 |
| **二维码**         | 小程序码 `wx.getUnlimitedQRCode`（服务端） | 前端生成（qrcode 库）        | 服务端生成存 R2 + 客户端备用方案                                 |
| **全屏/StatusBar** | 自动管理                                   | `viewport-fit=cover`         | 各端独立处理                                                     |
| **字体**           | 系统字体                                   | 同现有 web 版                | 不加载自定义字体（MVP）                                          |

---

## 6. 代码复用评估

| 模块                       | 复用方式                       | 估计复用率 | 备注                                                          |
| -------------------------- | ------------------------------ | ---------- | ------------------------------------------------------------- |
| `@werewolf/game-engine`    | **直接 import**                | 100%       | 纯 TS，零平台依赖                                             |
| ConnectionFSM 状态机       | **直接复用**                   | 100%       | 纯函数 + 类型，从 `connection/ConnectionFSM.ts` 提取          |
| ConnectionManager 逻辑     | **提取核心 + 新 adapter**      | 70%        | 核心逻辑（retry/backoff/revision poll）复用，平台事件绑定重写 |
| Auth token 逻辑            | **提取核心 + storage adapter** | 80%        | JWT 刷新/轮转逻辑复用，存储层替换                             |
| HTTP 封装（cfFetch）       | **重写 + 复用模式**            | 50%        | 重试/401 拦截模式复用；底层换 `Taro.request`                  |
| 音频注册表 / 键映射        | **直接复用**                   | 100%       | 纯数据映射，不含平台代码                                      |
| AudioOrchestrator 编排逻辑 | **逻辑复用**                   | 60%        | 编排流程复用，播放 API 重写                                   |
| 座位交互策略 (`seatTap/`)  | **逻辑复用**                   | 90%        | 纯策略函数，UI 触发方式替换                                   |
| useNightProgress           | **逻辑复用**                   | 80%        | Hook 逻辑复用，去掉 RN 特定 import                            |
| 主题 token 色值/间距       | **复用常量**                   | 70%        | 数值复用，去掉 `PixelRatio` / `Dimensions` 缩放               |
| UI 组件                    | **重写**                       | 10%        | Taro 组件模型不同（`<View>` 来自 `@tarojs/components`）       |
| 导航                       | **重写**                       | 0%         | React Navigation → Taro page 模型                             |

### 6.1 建议提取到 game-engine 或新 shared 包的模块

目前在 `src/services/connection/` 的 **ConnectionFSM**（纯函数状态机）和 **types.ts**（状态枚举/常量）完全平台无关，建议：

```
packages/game-engine/src/connection/
├── ConnectionFSM.ts    # 从 src/services/connection/ 移入
├── types.ts            # 状态枚举 + 常量
└── index.ts
```

这样 Expo 客户端和 Taro 客户端共享同一份 FSM 代码，各自实现 imperative shell。

---

## 7. Adapter 层详细设计

### 7.1 TransportAdapter（WebSocket）

```typescript
// packages/taro-client/src/adapters/transport.ts
import Taro from '@tarojs/taro';
import type { IRealtimeTransport, TransportEventHandlers } from '@werewolf/game-engine/connection';

export class TaroRealtimeTransport implements IRealtimeTransport {
  #task: Taro.SocketTask | null = null;
  #handlers: TransportEventHandlers | null = null;
  #generation = 0;

  setEventHandlers(handlers: TransportEventHandlers): void {
    this.#handlers = handlers;
  }

  connect(roomCode: string, _userId: string): void {
    this.disconnect();
    const generation = ++this.#generation;
    const wsUrl = `${WS_BASE}/ws?roomCode=${encodeURIComponent(roomCode)}&token=${encodeURIComponent(token)}`;

    Taro.connectSocket({ url: wsUrl, protocols: [] }).then((task) => {
      if (generation !== this.#generation) {
        task.close({});
        return;
      }
      this.#task = task;

      task.onOpen(() => {
        if (generation !== this.#generation) return;
        this.#handlers?.onOpen();
      });
      task.onMessage((msg) => {
        if (generation !== this.#generation) return;
        this.#parseMessage(msg.data);
      });
      task.onClose((e) => {
        if (generation !== this.#generation) return;
        this.#task = null;
        this.#handlers?.onClose(e.code, e.reason);
      });
      task.onError(() => {
        if (generation !== this.#generation) return;
        this.#handlers?.onError(new Error('WebSocket error'));
      });
    });
  }

  disconnect(): void {
    /* close + generation++ */
  }
  send(data: string): void {
    this.#task?.send({ data });
  }
}
```

### 7.2 StorageAdapter

```typescript
// packages/taro-client/src/adapters/storage.ts
import Taro from '@tarojs/taro';

export const storage = {
  get(key: string): string | null {
    return Taro.getStorageSync(key) || null;
  },
  set(key: string, value: string): void {
    Taro.setStorageSync(key, value);
  },
  remove(key: string): void {
    Taro.removeStorageSync(key);
  },
  clear(): void {
    Taro.clearStorageSync();
  },
};
```

### 7.3 HttpAdapter

```typescript
// packages/taro-client/src/adapters/http.ts
import Taro from '@tarojs/taro';
import { API_BASE_URL, API_TIMEOUT_MS } from '../config/api';

export async function httpRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  options?: { body?: unknown; token?: string | null },
): Promise<T> {
  const header: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options?.token) header['Authorization'] = `Bearer ${options.token}`;

  const res = await Taro.request({
    url: `${API_BASE_URL}${path}`,
    method,
    header,
    data: options?.body,
    timeout: API_TIMEOUT_MS,
  });

  if (res.statusCode === 401) throw new AuthExpiredError();
  if (res.statusCode >= 400) throw new ApiError(res.statusCode, res.data);
  return res.data as T;
}
```

### 7.4 AudioAdapter

```typescript
// packages/taro-client/src/adapters/audio.ts
import Taro from '@tarojs/taro';
import type { AudioPlaybackStrategy } from './types';

export class TaroAudioStrategy implements AudioPlaybackStrategy {
  #ctx: Taro.InnerAudioContext | null = null;

  async play(url: string, _label: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stop();
      const ctx = Taro.createInnerAudioContext();
      ctx.src = url; // CDN URL
      ctx.onEnded(() => {
        resolve();
        ctx.destroy();
      });
      ctx.onError((err) => {
        reject(err);
        ctx.destroy();
      });
      ctx.play();
      this.#ctx = ctx;
    });
  }

  stop(): void {
    this.#ctx?.stop();
    this.#ctx?.destroy();
    this.#ctx = null;
  }
  // ... pause/resume/preload/setVolume/cleanup
}
```

---

## 8. 路由设计

### 8.1 Taro 页面路由配置

```typescript
// src/app.config.ts
export default defineAppConfig({
  pages: ['pages/home/index', 'pages/room/index', 'pages/auth/login', 'pages/settings/index'],
  window: {
    backgroundTextStyle: 'dark',
    navigationBarBackgroundColor: '#1a1a2e',
    navigationBarTitleText: '狼人杀法官',
    navigationBarTextStyle: 'white',
  },
});
```

### 8.2 React Navigation → Taro 路由映射

| RN 路由                       | Taro 路由                                 | 参数传递   |
| ----------------------------- | ----------------------------------------- | ---------- |
| `Home`                        | `/pages/home/index`                       | —          |
| `Room { roomCode, isHost }`   | `/pages/room/index?roomCode=XXX&isHost=1` | URL params |
| `AuthLogin`                   | `/pages/auth/login`                       | URL params |
| `Settings`                    | `/pages/settings/index`                   | —          |
| `Config { existingRoomCode }` | 合并到 home（板子选择 modal）             | —          |

### 8.3 深链 / 分享

- **小程序转发卡片**：`path: '/pages/room/index?roomCode=ABC123'`
- **H5 URL**：`https://h5.werewolfjudge.eu.org/pages/room/index?roomCode=ABC123`
- **扫码进入**：小程序码 scene 参数 → `roomCode`

---

## 9. 微信特有能力集成

### 9.1 登录流程

```
用户点击"微信登录" → wx.login() → code
→ Taro.request POST /auth/wechat-login { code }
→ Server: code → session_key + openid → JWT pair
→ 客户端存储 access/refresh token
```

与现有 web-view claim 流程不同：**不再需要 nonce + web-view 中转**。直接在原生小程序内完成 OAuth。

### 9.2 转发分享

```typescript
useShareAppMessage(() => ({
  title: `来一起玩狼人杀！房间 ${roomCode}`,
  path: `/pages/room/index?roomCode=${roomCode}`,
  imageUrl: shareImageUrl, // CDN 上的分享图
}));
```

### 9.3 订阅消息（后续）

游戏开始通知 / 轮到你操作通知 — MVP 后考虑。

---

## 10. 包体积策略

| 策略          | 说明                                   |
| ------------- | -------------------------------------- |
| 音频 CDN 加载 | 所有 .mp3 不打包，运行时从 R2 CDN 下载 |
| 分包加载      | 设置页/认证页放分包（`subPackages`）   |
| Tree-shaking  | game-engine 仅 import 使用到的函数     |
| 图片压缩      | 头像/badge 走 CDN，仅图标打包          |
| 目标          | 主包 < 1.5MB，总包 < 4MB               |

---

## 11. pnpm Workspace 集成

```yaml
# pnpm-workspace.yaml (追加)
packages:
  - 'packages/game-engine'
  - 'packages/api-worker'
  - 'packages/taro-client' # 新增
```

```json
// packages/taro-client/package.json
{
  "name": "@werewolf/taro-client",
  "private": true,
  "scripts": {
    "dev:weapp": "taro build --type weapp --watch",
    "dev:h5": "taro build --type h5 --watch",
    "build:weapp": "taro build --type weapp",
    "build:h5": "taro build --type h5",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@tarojs/cli": "4.x",
    "@tarojs/components": "4.x",
    "@tarojs/helper": "4.x",
    "@tarojs/plugin-framework-react": "4.x",
    "@tarojs/plugin-platform-weapp": "4.x",
    "@tarojs/plugin-platform-h5": "4.x",
    "@tarojs/react": "4.x",
    "@tarojs/runtime": "4.x",
    "@tarojs/taro": "4.x",
    "@werewolf/game-engine": "workspace:*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@tarojs/webpack5-runner": "4.x",
    "typescript": "^5.9.0"
  }
}
```

### Webpack 解析 workspace 包

```typescript
// config/index.ts
mini: {
  webpackChain(chain) {
    // 确保 @werewolf/game-engine 被正确 resolve
    chain.resolve.plugin('MultiPlatformPlugin').tap(args => {
      args[2]['include'] = ['@werewolf/game-engine']
      return args
    })
  },
}
```

---

## 12. 开发工作流

```bash
# 开发小程序（需微信开发者工具打开 dist/）
pnpm -F @werewolf/taro-client dev:weapp

# 开发 H5（浏览器 localhost:10086）
pnpm -F @werewolf/taro-client dev:h5

# 生产构建
pnpm -F @werewolf/taro-client build:weapp
pnpm -F @werewolf/taro-client build:h5

# 类型检查
pnpm -F @werewolf/taro-client typecheck
```

---

## 13. 风险和开放问题

| #   | 问题                                                                                             | 状态         | 决策建议                                                             |
| --- | ------------------------------------------------------------------------------------------------ | ------------ | -------------------------------------------------------------------- |
| 1   | React 19 vs 18 — Taro 4 是否完全兼容 React 19？                                                  | 待验证       | 先用 React 18，后续升级                                              |
| 2   | game-engine `import` 路径 — Taro webpack 能否解析 `@werewolf/game-engine/models/roles` subpath？ | 待验证       | 需确认 package.json `exports` field + Taro resolve                   |
| 3   | 音频自动播放 — 小程序 InnerAudioContext 是否需要用户交互才能播放？                               | 文档确认需要 | Host 操作时触发即满足；首次播放可能需 button tap                     |
| 4   | H5 部署域名 — 新域名还是复用 `pages.dev`？                                                       | 待定         | 建议新域名 `h5.werewolfjudge.eu.org`，CI 单独部署                    |
| 5   | 现有 miniapp 目录处置 — 是否删除旧 web-view 小程序？                                             | 待确认       | MVP 上线后停用旧版；过渡期并行                                       |
| 6   | 状态管理 — Zustand vs useContext + useReducer？                                                  | 待定         | 推荐 Zustand（团队已熟悉、体积小、支持 SSR）                         |
| 7   | CSS 方案 — SCSS modules vs Tailwind（@tarojs/plugin-tailwindcss）？                              | 待定         | 推荐 SCSS modules（与 Taro 默认集成好，无额外插件风险）              |
| 8   | E2E 测试 — Taro 小程序端如何自动化测试？                                                         | 调研中       | H5 端用 Playwright（现有基础设施）；小程序端用 miniprogram-automator |
| 9   | ConnectionFSM 提取时机 — 立即提取还是先在 taro-client 复制？                                     | 待定         | 建议阶段 2 先复制，验证可行后再提取到 game-engine                    |

---

## 14. 阶段 2 实施计划（确认后执行）

1. **初始化 Taro 项目** — `taro init` + pnpm workspace 集成 + CI 编译验证
2. **实现 Platform Adapters** — storage / transport / http / audio
3. **搭建首页空壳** — 创建/加入房间 UI + 路由跳转
4. **搭建房间页空壳** — PlayerGrid + 座位 + 连接状态
5. **接入 game-engine** — import 类型 + handlers + 验证编译
6. **WebSocket 联调** — 连接 → 收广播 → 渲染 GameState
7. **认证流程** — wx.login + 匿名 + token 管理
8. **分享能力** — 转发卡片 + 场景值解析
9. **H5 验证** — 双端编译通过 + 功能对齐
10. **提交审核** — 小程序审核 + H5 部署

---

## 附录 A: 现有 miniapp 目录对比

| 现有 miniapp                                 | Taro 方案                 |
| -------------------------------------------- | ------------------------- |
| 纯 web-view 壳 + `index.js` 处理 nonce claim | 原生页面，无 web-view     |
| 依赖 pages.dev 加载 → 安全确认页阻塞         | 原生渲染，无跨域问题      |
| 分享走 `webViewUrl` 解析                     | 原生 `useShareAppMessage` |
| wx.login 通过 web-view nonce 中转            | 直接 wx.login → server    |
| 无离线能力                                   | 可用小程序缓存 + Storage  |

Taro 方案完全替代现有 miniapp，解决安全确认页问题的根本方式是**不再使用 web-view**。
