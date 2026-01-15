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

项目使用两套环境配置，自动切换：

| 文件 | 用途 | Supabase URL |
|------|------|--------------|
| `.env` | 生产环境 | `https://xxx.supabase.co` |
| `.env.local` | 本地开发 | `http://127.0.0.1:54321` |

> ⚠️ `.env.local` 优先级高于 `.env`。两个文件都不会被 Git 追踪。

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

---

## Web 构建与部署

### 方式一：使用部署脚本（推荐）

```bash
./scripts/deploy.sh
```

脚本会自动：
1. 备份本地开发配置 (`.env.local`)
2. 切换到生产配置
3. 清除缓存并构建
4. 部署到 Vercel
5. 设置别名 `werewolf-judge.vercel.app`
6. 恢复本地开发配置

### 方式二：手动部署

#### 1. 切换到生产配置

```bash
# 临时使用生产配置
cp .env .env.local
```

#### 2. 构建 Web 版本

```bash
# 清除缓存很重要！否则可能使用旧的环境变量
npx expo export --platform web --clear
```

验证构建使用了正确的 URL：
```bash
grep -o "supabase.co\|127.0.0.1" dist/_expo/static/js/web/*.js
# 应该输出 supabase.co，而不是 127.0.0.1
```

#### 3. 部署到 Vercel

```bash
cd dist
vercel --prod --yes
```

#### 4. 设置别名

```bash
vercel alias <deployment-url> werewolf-judge.vercel.app
```

#### 5. 恢复本地配置

```bash
cd ..
# 编辑 .env.local 改回 http://127.0.0.1:54321
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

### Q2: 部署后页面空白 / 手机上登录失败 (Load failed)

**原因**: 构建时使用了本地开发的环境变量（`127.0.0.1`），手机无法访问

**解决**:
```bash
# 检查构建中使用的 URL
grep -o "supabase.co\|127.0.0.1" dist/_expo/static/js/web/*.js

# 如果输出 127.0.0.1，需要：
# 1. 切换到生产配置
cp .env .env.local

# 2. 清除缓存重新构建（--clear 很重要！）
npx expo export --platform web --clear

# 3. 重新部署
cd dist && vercel --prod --yes
```

或直接使用部署脚本：
```bash
./scripts/deploy.sh
```

### Q3: Realtime 不工作（加入房间后看不到更新）

**原因**: Supabase Realtime 未启用

**解决**:
1. 打开 Supabase Dashboard > Database > Replication
2. 确保 `rooms` 表的 Realtime 已启用

### Q4: 如何更新部署？

```bash
# 使用部署脚本（推荐）
./scripts/deploy.sh

# 或手动：参考上面的「手动部署」步骤
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
| **本地开发** | |
| 启动本地 Supabase | `supabase start` |
| 停止本地 Supabase | `supabase stop` |
| 启动开发服务器 | `npm start` |
| **生产部署** | |
| 一键部署 | `./scripts/deploy.sh` |
| 推送数据库迁移 | `supabase db push` |
| 获取 API Keys | `supabase projects api-keys --project-ref <ref>` |
| 查看部署别名 | `vercel alias ls` |
| 回滚部署 | `vercel alias set <old-url> werewolf-judge.vercel.app` |

---

## 当前生产环境

| 服务 | URL |
|------|-----|
| **前端** | https://werewolf-judge.vercel.app |
| **后端** | https://abmzjezdvpzyeooqhhsn.supabase.co |
