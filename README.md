# 🐺 Werewolf Game Judge

**狼人杀第一晚电子法官** - 专为线下同桌狼人杀设计的自动化裁判 App

[![Live Demo](https://img.shields.io/badge/Live-werewolf--judge.vercel.app-blue?style=flat-square)](https://werewolf-judge.vercel.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React Native](https://img.shields.io/badge/React%20Native-Expo-purple?style=flat-square&logo=expo)](https://expo.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime-green?style=flat-square&logo=supabase)](https://supabase.com/)

---

## ✨ 核心特性

- 🎙️ **自动语音播报** - 第一晚全流程自动引导，Host 也能闭眼参与
- 📱 **多设备同步** - 一人建房，多人扫码加入，实时同步
- �� **丰富角色** - 支持 20+ 角色，含狼人、预言家、女巫、守卫等
- ⚡ **即开即用** - 匿名登录，无需注册，4位房间码快速加入
- 🌐 **跨平台** - iOS / Android / Web 全平台支持

---

## 🎮 快速开始

### 玩家使用

| 步骤 | Host（房主）                             | 玩家             |
| ---- | ---------------------------------------- | ---------------- |
| 1    | 点击「创建房间」，选择板子和人数         | 点击「进入房间」 |
| 2    | 分享 4 位房间号给其他玩家                | 输入房间号加入   |
| 3    | 等待所有人入座，点击「准备看牌」         | 点击座位入座     |
| 4    | 所有人看牌后，点击「开始游戏」           | 查看身份，确认   |
| 5    | 夜晚结束后，点击「查看昨晚信息」宣布结果 | 根据身份执行行动 |

> 💡 白天发言与投票在线下进行，App 只负责第一晚。

### 线上体验

👉 **[werewolf-judge.vercel.app](https://werewolf-judge.vercel.app)**

---

## 🐺 支持角色

| 狼人阵营 | 神职阵营 | 村民阵营 |
| -------- | -------- | -------- |
| 狼人     | 预言家   | 村民     |
| 狼王     | 女巫     |          |
| 狼后     | 猎人     |          |
| 机械狼   | 守卫     |          |
| 恶灵骑士 | 骑士     |          |
| 暗狼王   | 白痴     |          |
|          | 魔术师   |          |
|          | 通灵师   |          |
|          | 石像鬼   |          |
|          | 梦魇     |          |
|          | 守墓人   |          |

---

## 🏗️ 架构设计

**核心原则：Host 是唯一权威**

- ✅ Host 本地内存控制所有游戏逻辑
- ✅ Supabase 只做传输/发现/身份
- ✅ 敏感信息通过私信发送，不公开广播

```
Host 设备 (GameStateService)
    │
    │ Realtime Broadcast
    ▼
Supabase (传输层)
    │
    ▼
玩家设备 (N个)
```

---

## 🛠️ 开发指南

### 环境要求

- Node.js >= 20
- npm 或 yarn
- Expo CLI
- Supabase CLI

### 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 启动本地 Supabase
supabase start

# 3. 配置环境变量
cp .env.example .env

# 4. 启动开发服务器
npm start

# 5. 运行测试
npm test                    # 单元测试 (Jest)
npm run e2e:core            # E2E 测试 (Playwright)
```

### 切换 Supabase 环境

| 环境              | 操作                               |
| ----------------- | ---------------------------------- |
| **本地 Supabase** | 创建 `.env.local` 文件（见下方）   |
| **远程 Supabase** | 删除 `.env.local`，自动使用 `.env` |

**使用本地 Supabase：**

```bash
# 1. 启动本地 Supabase
supabase start

# 2. 创建 .env.local（Expo 优先读取）
cat > .env.local << 'EOF'
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-local-anon-key>
EOF

# 获取本地 anon key
supabase status | grep anon
```

**切换回远程 Supabase：**

```bash
rm .env.local
# 重启 Metro bundler (Ctrl+C 后 npm start)
```

> 💡 Expo 环境变量优先级：`.env.local` > `.env`

### 项目结构

```
src/
├── models/roles/spec/     # 角色定义 (声明式)
├── services/
│   ├── GameStateService.ts    # Host 游戏状态机 (核心)
│   ├── night/resolvers/       # 夜晚行动解析器
│   └── DeathCalculator.ts     # 死亡结算
├── screens/               # 页面组件
└── hooks/                 # React Hooks
```

---

## 🚀 部署

### 1. 配置远程 Supabase

```bash
supabase link --project-ref <your-project-ref>
supabase db push
supabase projects api-keys --project-ref <your-project-ref>
```

### 2. 更新环境变量

```env
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

### 3. 构建 & 部署 Web

```bash
npx expo export --platform web
vercel deploy dist --prod
```

**当前生产环境：** https://werewolf-judge.vercel.app

---

## 📖 更多文档

| 文档                                | 说明                           |
| ----------------------------------- | ------------------------------ |
| [线下玩法 SOP](docs/offline-sop.md) | 完整的线下游戏流程指南         |
| [部署指南](docs/DEPLOYMENT.md)      | Supabase + Vercel 完整部署流程 |

---

## 📄 License

MIT
