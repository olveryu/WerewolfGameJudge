# Vercel Serverless → Supabase Edge Functions 迁移方案

> ⚠️ **已完成** — 迁移已于 2025 年完成，本文档仅作历史参考。

## 一、动机

当前游戏操作链路：客户端 → Vercel Serverless (pdx1) → Supavisor → Postgres → 返回。  
Vercel Serverless 冷启动 1-2 秒，即使有 GitHub Actions 每 5 分钟 keep-warm，仍不可靠（cron 不保证准时、多实例不共享热度）。

Supabase Edge Functions 优势：

- **全球边缘部署**，默认在离用户最近的节点执行（可指定 region 跟 DB 同区）
- **冷启动极短**（Deno 轻量 runtime）
- **可直连 Postgres**（`SUPABASE_DB_URL` 自动注入），无需额外配置
- **无函数数量限制**（Vercel Hobby 限 12 个）

## 二、现状盘点

### 2.1 Vercel Handler 文件

| 文件                           | 行数 | 子路由                                                                                                                          |
| ------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------- |
| `api/game/[action].ts`         | 270  | assign, clear-seats, fill-bots, mark-bots-viewed, restart, seat, set-animation, share-review, start, update-template, view-role |
| `api/game/night/[action].ts`   | 345  | action, audio-ack, audio-gate, end, group-confirm-ack, progression, reveal-ack, wolf-robot-viewed, wolf-vote                    |
| `api/_lib/gameStateManager.ts` | 161  | 通用"读-算-写"+ 乐观锁                                                                                                          |
| `api/_lib/db.ts`               | 55   | postgres.js 单例连接                                                                                                            |
| `api/_lib/handlerContext.ts`   | 26   | HandlerContext 构建                                                                                                             |
| `api/_lib/responseStatus.ts`   | 14   | HTTP 状态码映射                                                                                                                 |
| `api/_lib/cors.ts`             | 44   | 开发环境 CORS                                                                                                                   |
| `api/_lib/types.ts`            | 173  | 请求/响应类型定义                                                                                                               |
| `api/health.ts`                | —    | 健康检查                                                                                                                        |

### 2.2 DB 连接

`postgres.js` 直连 Supavisor Transaction Mode，`prepare: false`，单例复用。

### 2.3 客户端调用

- `src/services/facade/apiUtils.ts`：`fetch(API_BASE_URL + path)` POST JSON
- `src/config/api.ts`：`API_BASE_URL` 生产环境为空字符串（Vercel 同域相对路径）
- 含乐观更新（optimistic UI）+ 客户端冲突重试（最多 2 次）
- 服务端响应含 `state` + `revision` 时立即 `applySnapshot`

### 2.4 状态同步

客户端通过 Supabase `postgres_changes` 监听 rooms 表变更，无需服务端主动广播。Edge Function 写 DB 后此机制自动生效，**无需额外改动**。

### 2.5 Keep-warm

`.github/workflows/warm-api.yml` 每 5 分钟 ping Vercel。迁移后可删除。

## 三、迁移设计

### 3.1 Edge Function 结构

采用 Supabase 官方推荐的 **fat function** 模式（少量大函数，减少冷启动），合并所有游戏操作为 1 个 Edge Function：

```
supabase/functions/
├── _shared/
│   ├── cors.ts                  (CORS helper，Web 标准 API)
│   ├── db.ts                    (postgres.js 连接，复用现有逻辑)
│   ├── gameStateManager.ts      (读-算-写流程，几乎原样复用)
│   ├── handlerContext.ts        (原样复用)
│   ├── responseStatus.ts        (原样复用)
│   ├── types.ts                 (原样复用，删除 VercelRequest/Response)
│   └── game-engine/             (esbuild 预编译 ESM bundle)
│       └── index.js
├── game/                        (合并后的单个 Edge Function)
│   ├── index.ts
│   └── deno.json                (per-function 依赖配置，推荐方式)
└── groq-proxy/                  (已有，不变)
    └── index.ts
```

### 3.2 DB 连接方案

**直连 Postgres（复用 `postgres.js`）**

Supabase 官方文档明确支持在 Edge Function 中使用 `postgres.js`：

```ts
import postgres from 'postgres';

const connectionString = Deno.env.get('SUPABASE_DB_URL')!;

const sql = postgres(connectionString, { prepare: false });
```

- `SUPABASE_DB_URL` 由 Supabase 自动注入，无需手动配置
- `prepare: false` 与当前 Vercel handler 一致（Supavisor Transaction Mode 要求）
- 查询延迟与当前相当（~5-15ms）

**与现有 `api/_lib/db.ts` 的差异**：

- 连接创建在模块顶层（Supabase Edge Runtime 会在请求间复用 worker，跟 Vercel 单例模式效果类似）
- 环境变量从 `DATABASE_URL` 改为 `SUPABASE_DB_URL`（Supabase 自动注入）
- 其余参数（`max: 1`、`prepare: false`、`idle_timeout`）保持不变

### 3.3 game-engine 集成

**问题**：`@werewolf/game-engine` 是 pnpm workspace 包，编译为 CommonJS。Deno 需要 ESM。且 `supabase functions deploy` 的 bundle 范围是 `supabase/functions/` 目录内。

**方案：esbuild 预编译为 ESM bundle**

```bash
# 新增 script 到 packages/game-engine/package.json
npx esbuild src/index.ts --bundle --format=esm \
  --outfile=../../supabase/functions/_shared/game-engine/index.js
```

Edge Function 里：

```ts
import { handleAssignRoles, gameReducer } from '../_shared/game-engine/index.js';
```

**为什么不用 import_map 直接引用源码**：

- `supabase functions deploy` 的 bundler 可能无法 resolve `supabase/functions/` 目录之外的相对路径（如 `../../packages/game-engine/src/`）
- esbuild 方案最可靠，单文件零依赖，部署时不存在路径问题
- 构建步骤可集成到现有 `scripts/build.sh`

### 3.4 URL 路由设计

Edge Function 名为 `game`，URL 为 `POST /functions/v1/game`。

在 function 内部通过 URL path 参数路由：

```
POST /functions/v1/game/assign          → handleAssign
POST /functions/v1/game/night/action    → handleAction
POST /functions/v1/game/night/audio-ack → handleAudioAck
...
```

Supabase Edge Function 支持 wildcard 匹配，`game/index.ts` 可处理 `/game/*` 的所有请求。解析 `new URL(req.url).pathname` 即可，跟现有 dispatcher 逻辑一致。

### 3.5 区域执行策略

Edge Function 默认在离用户最近的边缘节点执行。但本项目的 handler 每次都要读写 Postgres（DB 在 `us-west-2`），跨区访问 DB 会增加延迟。

**方案**：客户端调用时通过 `x-region: us-west-1` header 指定就近 region（Supabase 边缘节点无 `us-west-2`，`us-west-1` 最近）。或使用 query parameter `?forceFunctionRegion=us-west-1`（适用于无法添加自定义 header 的场景如 CORS preflight）。

在 `apiUtils.ts` 的 fetch 中添加：

```ts
headers: {
  'Content-Type': 'application/json',
  'x-region': 'us-west-1',
}
```

### 3.6 认证方案

当前 Vercel handler **无 JWT 验证**（同域请求，靠 roomCode + hostUid 做业务层校验）。

Edge Function 默认要求 `Authorization: Bearer <anon_key>` header。两个选项：

**选项 A：关闭 JWT 验证（推荐，与现有行为一致）**

```toml
# supabase/config.toml
[functions.game]
verify_jwt = false
```

保持现有的业务层校验（roomCode + uid），不引入额外认证逻辑。

**选项 B：启用 JWT 验证**

客户端在 `apiUtils.ts` 的 fetch header 中加 `Authorization: Bearer <SUPABASE_ANON_KEY>`。提供额外的传输层安全，但需要改客户端代码。

### 3.7 客户端改动

**改动范围极小**，只涉及 2 个文件：

**`src/config/api.ts`**：

```ts
// 之前：空字符串（Vercel 同域相对路径 /api/game/...）
// 之后：Supabase Edge Function URL
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://<project-ref>.supabase.co/functions/v1';
```

**`src/services/facade/apiUtils.ts`**（如果选择选项 B 启用 JWT）：

```ts
// fetch header 增加 Authorization
headers: {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
}
```

**`src/services/facade/apiUtils.ts`** — 添加 `x-region` header（见 3.5 节）：

```ts
headers: {
  'Content-Type': 'application/json',
  'x-region': 'us-west-1',
}
```

**URL path 映射**：

| 现有客户端调用 path                     | 迁移后 path          |
| --------------------------------------- | -------------------- |
| `/api/game/assign`                      | `/game/assign`       |
| `/api/game/night/action`                | `/game/night/action` |
| `/api/game/seat`                        | `/game/seat`         |
| ...（所有 21 处，统一去掉 `/api` 前缀） |                      |

最终 fetch URL = `API_BASE_URL + path`：

- 现有：`'' + '/api/game/assign'` → `/api/game/assign`（Vercel 同域）
- 迁移后：`'https://xxx.supabase.co/functions/v1' + '/game/assign'` → Edge Function URL

需要改动的文件（共 22 处 path 字符串）：

- `src/services/facade/gameActions.ts`（20 处）
- `src/services/facade/seatActions.ts`（1 处）
- `src/services/facade/apiUtils.ts` JSDoc 注释（1 处）
- `src/services/facade/__tests__/` 中的测试断言（~20 处，跟随更新）

### 3.8 CORS

当前：Vercel 同域部署，生产环境无 CORS 问题。本地开发走 `api/_lib/cors.ts`。

迁移后：Edge Function URL 是跨域的（`*.supabase.co` vs 你的前端域名）。需要在 Edge Function 中加 CORS headers：

```ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // 或指定前端域名
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
```

这与现有的 `groq-proxy/index.ts` 中的 CORS 处理方式一致。

## 四、已知限制

| 限制                                 | 值         | 影响评估                                                        |
| ------------------------------------ | ---------- | --------------------------------------------------------------- |
| Wall time（总执行时间，含 I/O 等待） | 400 秒     | 无影响（handler 总耗时 <1s）                                    |
| CPU 执行时间（纯计算，不含 I/O）     | 200 ms     | 无影响（game-engine 纯函数 + JSON 解析远小于此，DB I/O 不计入） |
| 请求体                               | 2 MB       | 无影响（game_state JSON 远小于此）                              |
| Bundle 大小                          | 10 MB      | 需关注 game-engine bundle 后体积                                |
| 内存                                 | 150 MB     | 无影响                                                          |
| 并发                                 | 自动扩展   | 无硬限制                                                        |
| 免费计划调用次数                     | 50 万次/月 | 需根据游戏使用量评估（Pro 200 万次/月，超出 $2/百万次）         |

## 五、本地开发

### 5.1 现有流程（已迁移）

| 命令                     | 作用                                                                     |
| ------------------------ | ------------------------------------------------------------------------ |
| `pnpm run web`           | Metro :8081（前端 hot-reload）                                           |
| `pnpm run dev:functions` | `supabase functions serve`（Edge Functions hot-reload，写 `.env.local`） |
| `pnpm run dev`           | concurrently 跑 Edge Functions + Expo web（E2E / 日常开发用）            |

### 5.2 实现细节

`supabase functions serve` 通过本地 Supabase API gateway 提供 Edge Functions（`http://127.0.0.1:54321/functions/v1`）。

**已完成改动**：

1. **`scripts/lib/devConfig.mjs`** — 移除 `spawnVercelDev` / `buildChildEnv`，新增 `spawnProcess` / `buildGameEngineEsm`
2. **`scripts/dev-api.mjs`** — 写 `.env.local` → build ESM → `supabase functions serve`
3. **`scripts/run-e2e-web.mjs`** — 写 `.env.local` → build ESM → concurrently: Edge Functions + Expo web
4. **`scripts/deploy.sh`** — build ESM → `supabase functions deploy game`

5. **`package.json` scripts**：

   ```json
   {
     "dev": "node scripts/run-e2e-web.mjs",
     "dev:functions": "node scripts/dev-api.mjs"
   }
   ```

6. **前置条件**：
   - `supabase start` 必须先运行（提供本地 DB + Auth + Realtime）
   - Supabase CLI：`brew install supabase/tap/supabase`（macOS）
   - CI runner 使用 `supabase/setup-cli@v1` action

### 5.3 本地 Supabase 兼容

现有本地开发可以用 `supabase start` 跑本地 Supabase 全家桶（DB + Auth + Realtime）。Edge Function `serve` 会自动连接本地 Supabase 实例，`SUPABASE_DB_URL` 指向 `localhost:54322`。这与现有的 `e2e.local.json` 配置兼容。

## 六、CI / CD

### 6.1 现有 CI 流程

```
git push → Vercel Git Integration → scripts/build.sh（编译 game-engine CJS + expo export）
         → GitHub CI → quality（typecheck + lint + test）+ E2E（vercel dev）
```

- `scripts/build.sh` 编译 game-engine + Expo Web → 输出到 `dist/`
- Vercel 自动部署 `dist/`（前端）+ `api/`（Serverless Functions）
- E2E 在 CI 中由 `run-e2e-web.mjs` 启动 Edge Functions + Expo web

### 6.2 迁移后 CI 流程

```
git push → Vercel Git Integration → scripts/build.sh（编译 game-engine CJS+ESM + expo export）
                                  ↓
         → GitHub CI → quality + E2E
                                  ↓
         → GitHub CI（新 job）→ supabase functions deploy game
```

**改动清单**：

1. **`scripts/build.sh`** — 添加 game-engine ESM build：

   ```bash
   # ── 1. 编译 game-engine ─────────────────────────
   echo "🔧 编译 game-engine (CJS)..."
   (cd packages/game-engine && npx tsc -p tsconfig.build.json)

   echo "🔧 编译 game-engine (ESM → Edge Function)..."
   (cd packages/game-engine && npx esbuild src/index.ts --bundle --format=esm \
     --outfile=../../supabase/functions/_shared/game-engine/index.js)
   ```

2. **`.github/workflows/ci.yml`** — 新增 deploy-edge-functions job：

   ```yaml
   deploy-edge-functions:
     runs-on: ubuntu-latest
     if: github.event_name == 'push' && github.ref == 'refs/heads/main'
     needs: quality
     steps:
       - uses: actions/checkout@v4
       - uses: pnpm/action-setup@v4
       - uses: actions/setup-node@v4
         with:
           node-version-file: '.nvmrc'
           cache: 'pnpm'
       - run: pnpm install --frozen-lockfile

       - name: Build game-engine ESM
         run: cd packages/game-engine && npx esbuild src/index.ts --bundle --format=esm --outfile=../../supabase/functions/_shared/game-engine/index.js

       - uses: supabase/setup-cli@v1
         with:
           version: latest

       - name: Deploy Edge Functions
         run: supabase functions deploy game --project-ref $SUPABASE_PROJECT_REF
         env:
           SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
           SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}
   ```

3. **GitHub Secrets 新增**：
   - `SUPABASE_ACCESS_TOKEN`：Supabase Dashboard → Account → Access Tokens
   - `SUPABASE_PROJECT_REF`：Supabase Dashboard → Project Settings → General

4. **E2E CI 改动**：
   - 现有 E2E 用 `vercel dev` 同时跑前端+API
   - 迁移后需要 `supabase functions serve` + 前端静态服务（或继续用 `vercel dev` 只跑前端 + 环境变量指向 `supabase functions serve`）
   - **最简方案**：E2E 继续跑 remote 环境（`E2E_ENV=remote`），直接测已部署的 Edge Function，不需要改 E2E CI

5. **`.github/workflows/warm-api.yml`** — 迁移完成后删除

### 6.3 部署依赖关系

```
                     ┌─────────────┐
git push ──────────> │  Vercel CI  │ ──> 前端静态资源部署
                     └─────────────┘
                     ┌─────────────┐
git push (main) ──> │  GitHub CI  │ ──> quality → deploy-edge-functions
                     └─────────────┘
```

前端部署和 Edge Function 部署是**独立的**：

- 前端由 Vercel Git Integration 自动部署
- Edge Function 由 GitHub CI 通过 `supabase functions deploy` 部署
- 两者可以独立回滚

## 七、实施步骤

> **总预估时间：4-6 小时**（不含等待 CI 和灰度观察）
>
> 按 commit 粒度拆分，每个 commit 可独立提交，任一步失败不影响现有线上功能。

### Phase 1：准备（不影响现有功能）— 约 2-3 小时

#### Commit 1：`feat(game-engine): add ESM build for Edge Functions`

**时间：~20 min**

- `packages/game-engine/package.json` 添加 `"build:esm"` script：
  ```json
  "build:esm": "esbuild src/index.ts --bundle --format=esm --outfile=../../supabase/functions/_shared/game-engine/index.js"
  ```
- `.gitignore` 添加 `supabase/functions/_shared/game-engine/`
- 运行 `pnpm --filter @werewolf/game-engine run build:esm`，验证产物生成 & 大小 < 10 MB
- `pnpm run quality` 确认无破坏

#### Commit 2：`feat(edge): add game Edge Function with all handlers`

**时间：~1.5-2 小时**（主要工作量在这里）

核心移植，1082 行 Vercel handler 代码 → Deno Edge Function：

- 创建 `supabase/functions/game/index.ts`：
  - `Deno.serve()` 入口
  - CORS preflight 处理（参考 `groq-proxy` 已有模式）
  - URL pathname 解析 → dispatcher 路由到各 handler
- 创建 `supabase/functions/game/deno.json`：
  ```json
  { "imports": { "postgres": "npm:postgres@3" } }
  ```
- 创建 `supabase/functions/_shared/` 文件（从 `api/_lib/` 复制+改写）：
  - `db.ts` — `DATABASE_URL` → `SUPABASE_DB_URL`，`process.env` → `Deno.env.get()`
  - `gameStateManager.ts` — 改 import 路径，Vercel resp API → Web Response
  - `handlerContext.ts` — 改 import 路径
  - `responseStatus.ts` — 原样
  - `types.ts` — 删除 `VercelRequest`/`VercelResponse` 类型，改用 Web 标准 `Request`/`Response`
  - `cors.ts` — 简化为 CORS headers 常量（参考 `groq-proxy`）
- 从 `api/game/[action].ts` 和 `api/game/night/[action].ts` 复制各 handler 函数到 `game/index.ts`（或拆为子模块 `game/handlers/`）
- 所有 `import { ... } from '@werewolf/game-engine'` → `import { ... } from '../_shared/game-engine/index.js'`
- 更新 `supabase/config.toml`：添加 `[functions.game]` 区块

**验证**：

- `pnpm --filter @werewolf/game-engine run build:esm`
- `supabase functions serve --no-verify-jwt`
- 用 curl 逐一测试所有 20 个子路由

#### Commit 3：`ci(edge): add Edge Function deploy job`

**时间：~20 min**

- `.github/workflows/ci.yml` 添加 `deploy-edge-functions` job（见第六节）
- `scripts/build.sh` 添加 ESM build 步骤
- GitHub repo 添加 Secrets：`SUPABASE_ACCESS_TOKEN`、`SUPABASE_PROJECT_REF`

**验证**：push 到 branch → 确认 CI job 跑通 → `supabase functions deploy game` 成功

### Phase 2：部署 + 灰度切换 — 约 1-1.5 小时

#### Commit 4：`feat(client): switch API to Edge Functions`

**时间：~40 min**

- `src/config/api.ts`：更新 `API_BASE_URL` 默认值为 Edge Function URL
- `src/services/facade/apiUtils.ts`：
  - fetch headers 添加 `'x-region': 'us-west-1'`
  - 更新 JSDoc 注释中的路径示例
- `src/services/facade/gameActions.ts`：20 处 path 去掉 `/api` 前缀
- `src/services/facade/seatActions.ts`：1 处 path 去掉 `/api` 前缀
- `src/services/facade/__tests__/` 测试断言跟随更新（~20 处）

**验证（灰度）**：

- `.env` 设置 `EXPO_PUBLIC_API_URL` 指向 Edge Function
- 本地 `pnpm run dev` 全流程测试
- `pnpm run quality` 全跑
- E2E 测试全通过
- 合并到 main → 线上观察 1-2 局游戏

### Phase 3：清理 — ✅ 已完成

> Phase 2 稳定运行后执行。已于迁移完成后执行。

#### Commit 5：`chore: remove Vercel API handlers` ✅

- 删除 `api/` 整个目录（handlers、\_lib、tests、tsconfig）
- `jest.config.js` 移除 `api` root
- `vercel.json` 简化 rewrites（移除 `(?!api/)` 排除模式）
- `package.json` 移除 `postgres` 依赖

#### Commit 6：`chore: add health sub-route, update docs` ✅

- 在 `game` Edge Function 中加 `/game/health` GET 子路由
- 更新 `copilot-instructions.md`：Vercel Serverless → Supabase Edge Functions
- 更新本文档标记完成

### 时间汇总

| Phase           | Commits       | 预估时间 | 风险                     |
| --------------- | ------------- | -------- | ------------------------ |
| Phase 1（准备） | Commit 1-3    | 2-3h     | 零风险，不影响线上       |
| Phase 2（灰度） | Commit 4      | 1-1.5h   | 低风险，可秒级回滚       |
| Phase 3（清理） | Commit 5-6    | 0.5h     | 零风险（Phase 2 已验证） |
| **总计**        | **6 commits** | **4-6h** |                          |

> Phase 1-2 可以在同一天完成。Phase 3 已完成。

## 八、回退方案

- Vercel handler 代码已在 Phase 3 删除，如需回退可从 git 历史恢复
- Edge Functions 已稳定运行，回退概率极低

## 九、待确认事项

1. [x] Supabase 项目 DB region → `us-west-2`（从 pooler URL 确认：`aws-0-us-west-2.pooler.supabase.com`）。客户端应通过 `x-region: us-west-1` header 或 `forceFunctionRegion=us-west-1` 指定就近 region（Supabase 无 `us-west-2` 边缘节点，`us-west-1` 最近）
2. [x] 认证方案选择 → 选项 A：关闭 JWT（`verify_jwt = false`），与现有 Vercel handler 行为一致
3. [x] game-engine ESM bundle 产物是否纳入 git → **不纳入 git**。现有 `packages/game-engine/dist/`（CJS 产物）也未纳入 git（CI/Vercel build 时现场编译）。ESM bundle 同理，`.gitignore` 添加 `supabase/functions/_shared/game-engine/`
4. [x] Edge Function 部署是否纳入 CI 自动化 → 纳入 CI，见第六节
5. [x] `supabase functions deploy` 是否能正确 bundle `_shared/game-engine/index.js` → **是**。Supabase 官方推荐 `_shared/` 目录存放共享代码，deploy 时 CLI 将 function 代码 + 依赖打包为 ESZip（包含完整 module graph）。`_shared/` 下的 `.js` 文件通过相对路径 `import` 会被自动 resolve 和 bundle
6. [x] `groq-proxy` 是否需要补 `deno.json` → **不需要**。`groq-proxy` 零外部依赖（只用 `Deno.serve` + `Deno.env` + `fetch`，全部是 Deno 内置 API），无需依赖配置文件
