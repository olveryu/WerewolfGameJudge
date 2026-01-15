# 🚀 部署指南

本文档覆盖从零到生产环境的完整部署流程，包括 Supabase 数据库配置和 Vercel 前端部署。

---

## 目录

1. [前置要求](#前置要求)
2. [Supabase 配置](#supabase-配置)
3. [环境变量配置](#环境变量配置)
4. [Web 构建与部署](#web-构建与部署)
5. [验证部署](#验证部署)
6. [常见问题](#常见问题)

---

## 前置要求

### 工具安装

```bash
# Node.js (>= 20)
node --version

# Supabase CLI
brew install supabase/tap/supabase
supabase --version

# Vercel CLI
npm install -g vercel
vercel --version
```

### 账号准备

- [Supabase](https://supabase.com) 账号
- [Vercel](https://vercel.com) 账号（可用 GitHub 登录）

---

## Supabase 配置

### 1. 创建 Supabase 项目

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 点击 **New Project**
3. 填写：
   - **Name**: `werewolf-judge`（或自定义）
   - **Database Password**: 生成强密码并保存
   - **Region**: 选择离用户最近的区域（如 `West US`）
4. 点击 **Create new project**，等待 2-3 分钟

### 2. 登录 Supabase CLI

```bash
supabase login
# 浏览器会打开，授权后回到终端
```

### 3. Link 到远程项目

```bash
# 查看项目列表，获取 project-ref
supabase projects list

# 输出示例：
# LINKED | ORG ID | REFERENCE ID         | NAME              | REGION
# ●      | xxxxx  | abmzjezdvpzyeooqhhsn | WerewolfGameJudge | West US

# Link 到项目
cd /path/to/WerewolfGameJudge
supabase link --project-ref <your-project-ref>
```

### 4. 推送数据库迁移

```bash
supabase db push
```

这会创建：
- `rooms` 表（房间数据）
- RLS 安全策略
- Realtime 订阅配置
- 自动清理过期房间的函数

### 5. 启用匿名登录

1. 打开 [Authentication > Providers](https://supabase.com/dashboard/project/_/auth/providers)
2. 找到 **Anonymous Sign-ins**
3. 切换为 **Enabled**
4. 点击 **Save**

> ⚠️ 这是必须的，否则玩家无法加入房间。

### 6. 获取 API Keys

```bash
supabase projects api-keys --project-ref <your-project-ref>

# 输出示例：
# NAME         | KEY VALUE
# anon         | eyJhbGciOiJIUzI1NiIs...（这是你需要的 key）
# service_role | eyJhbGciOiJIUzI1NiIs...（不要暴露这个）
```

或从 Dashboard 获取：
1. 打开 **Settings > API**
2. 复制 **Project URL** 和 **anon public** key

---

## 环境变量配置

### 本地开发（.env.local）

```bash
# 本地 Supabase（开发用）
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>
```

启动本地 Supabase：
```bash
supabase start
# 会输出本地的 URL 和 Key
```

### 生产环境（.env）

```bash
# 远程 Supabase（生产用）
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

> ⚠️ 不要提交 `.env` 到 Git！已在 `.gitignore` 中排除。

---

## Web 构建与部署

### 1. 确认环境变量

```bash
cat .env
# 确保是远程 Supabase 的 URL 和 Key
```

### 2. 构建 Web 版本

```bash
npx expo export --platform web
```

输出在 `dist/` 目录，包含：
- `index.html`
- `_expo/static/js/` (JS bundle)
- `assets/` (图片、音频等)

### 3. 登录 Vercel

```bash
vercel login
# 选择登录方式（GitHub/Email 等）
```

### 4. 部署到生产环境

```bash
vercel deploy dist --prod
```

首次部署会询问：
- **Set up and deploy?** → `yes`
- **Which scope?** → 选择你的账号
- **Link to existing project?** → `no`（首次）或 `yes`（后续）
- **Project name?** → `werewolf-judge`

### 5. 设置自定义域名（可选）

```bash
# 设置别名
vercel alias set <deployment-url> werewolf-judge.vercel.app

# 查看所有别名
vercel alias ls

# 删除不需要的别名
vercel alias rm <unwanted-alias> -y
```

---

## 验证部署

### 1. 检查 Supabase 连接

访问 https://werewolf-judge.vercel.app：
- 点击「创建房间」
- 如果成功创建房间，说明数据库连接正常

### 2. 测试多设备同步

1. 在设备 A 创建房间，记录房间号
2. 在设备 B 输入房间号加入
3. 如果设备 B 能看到房间状态，说明 Realtime 正常

### 3. 检查匿名登录

- 无需注册即可创建/加入房间 ✓
- 如果提示「需要登录」，检查 Supabase 的匿名登录设置

---

## 常见问题

### Q1: `supabase db push` 失败

**原因**: 可能是网络问题或未 link 项目

**解决**:
```bash
# 重新 link
supabase link --project-ref <your-project-ref>

# 再次推送
supabase db push
```

### Q2: 部署后页面空白

**原因**: 环境变量未正确配置

**解决**:
```bash
# 确认 .env 内容
cat .env

# 重新构建
npx expo export --platform web

# 重新部署
vercel deploy dist --prod
```

### Q3: Realtime 不工作（加入房间后看不到更新）

**原因**: Supabase Realtime 未启用

**解决**:
1. 打开 Supabase Dashboard > Database > Replication
2. 确保 `rooms` 表的 Realtime 已启用

### Q4: 如何更新部署？

```bash
# 1. 修改代码
# 2. 重新构建
npx expo export --platform web

# 3. 重新部署（会自动更新 werewolf-judge.vercel.app）
vercel deploy dist --prod
```

### Q5: 如何回滚？

```bash
# 查看部署历史
vercel ls

# 将某个旧部署设为生产
vercel alias set <old-deployment-url> werewolf-judge.vercel.app
```

---

## 快速参考

| 操作 | 命令 |
|------|------|
| 启动本地 Supabase | `supabase start` |
| 停止本地 Supabase | `supabase stop` |
| 推送数据库迁移 | `supabase db push` |
| 获取 API Keys | `supabase projects api-keys --project-ref <ref>` |
| 构建 Web | `npx expo export --platform web` |
| 部署到 Vercel | `vercel deploy dist --prod` |
| 查看部署别名 | `vercel alias ls` |

---

## 当前生产环境

| 服务 | URL |
|------|-----|
| **前端** | https://werewolf-judge.vercel.app |
| **后端** | https://abmzjezdvpzyeooqhhsn.supabase.co |
