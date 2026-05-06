---
name: debug
description: '结构化调试工作流：诊断 bug/异常行为、定位根因、验证修复。Use when: debugging, 调试, bug, 排查问题, 定位问题, 异常, error, 报错, crash, 不工作, 不显示, timeout, 断连.'
argument-hint: '症状描述（如：进入房间后座位不显示、WebSocket 频繁断连、E2E hunter spec timeout）'
---

# 结构化调试 Skill

按症状分类 → 静态分析 → 动态诊断 → 根因修复 → 验证闭环的结构化流程。

## When to Use

- 用户报告 bug、异常行为、崩溃、性能问题
- E2E / 单元测试失败需要排查
- WebSocket 断连、状态不同步、API 报错

---

## Procedure

### Phase 1 — 症状分类 + 信息收集

从用户描述提取以下信息：

| 字段     | 说明                         | 示例                         |
| -------- | ---------------------------- | ---------------------------- |
| 症状     | 具体表现                     | 座位不显示 / 401 报错        |
| 复现条件 | 触发场景                     | 进入房间后 / 第三次点击      |
| 涉及平台 | Web / iOS / Android / 全平台 | Web                          |
| 错误信息 | console / Sentry / 弹窗文案  | `TypeError: Cannot read...`  |
| 最近变更 | 是否刚改过相关代码           | 昨天重构了 ConnectionManager |

根据症状分类到场景分支（可组合）：

| 分支 | 场景               | 典型症状                                      |
| ---- | ------------------ | --------------------------------------------- |
| A    | 客户端 UI 异常     | 组件不渲染、状态不更新、样式错乱、闪烁        |
| B    | WebSocket/网络问题 | 断连、消息丢失、timeout、重连循环             |
| C    | 游戏逻辑 bug       | 角色行动结果不符预期、状态 drift、reveal 错误 |
| D    | API/Worker 错误    | 4xx/5xx、DO 异常、D1 查询失败                 |
| E    | E2E 测试失败       | Playwright spec 报错、timeout、selector 失效  |
| F    | 性能问题           | 加载慢、渲染卡顿、内存泄漏                    |

---

### Phase 2 — 静态分析（首选）

**原则：能静态定位的绝不动态诊断。**

1. **定位代码区域** — `grep_search` / `semantic_search` 找到相关文件
2. **追踪数据流** — 输入 → 转换 → 输出，逐步验证
3. **双向追踪** — 修改调用方时追踪被调用方，反之亦然
4. **检查类型约束** — schema 校验、边界条件、`noUncheckedIndexedAccess` 下标访问
5. **检查最近变更** — `git log --oneline -20 -- <path>`
6. **每个受影响符号** — 用 `grep_search` 或 `vscode_listCodeUsages` 验证所有消费者

#### 场景分支首查路径

**A — 客户端 UI 异常：**

| 首查路径                | 排查重点                          |
| ----------------------- | --------------------------------- |
| `src/screens/<Screen>/` | Policy hooks 返回值、条件渲染逻辑 |
| `src/services/facade/`  | GameState snapshot 推导、selector |
| `src/contexts/`         | Context Provider 挂载、值传递     |
| `src/components/`       | props 类型、memo 依赖、key 稳定性 |

常见根因：selector 返回新引用导致无限渲染、Context 未挂载、条件渲染遗漏状态

**B — WebSocket/网络问题：**

| 首查路径                                  | 排查重点                          |
| ----------------------------------------- | --------------------------------- |
| `src/services/infra/ConnectionManager.ts` | 重连逻辑、错误分类、state machine |
| `src/services/infra/RealtimeService.ts`   | 订阅/取消订阅、消息路由           |
| `src/services/facade/`                    | applySnapshot 时序                |
| `packages/api-worker/src/do/`             | DO WebSocket handler、广播逻辑    |

常见根因：token 过期未刷新、DO 冷启动 race condition、消息序列号跳跃

**C — 游戏逻辑 bug：**

| 首查路径                                      | 排查重点                      |
| --------------------------------------------- | ----------------------------- |
| `packages/game-engine/src/resolvers/`         | resolver 处理逻辑、edge case  |
| `packages/game-engine/src/models/roles/spec/` | NIGHT_STEPS 顺序、schema 约束 |
| `packages/api-worker/src/do/`                 | DO 内 reducer 调用、状态写入  |
| `src/services/facade/`                        | 客户端 snapshot 解读          |

常见根因：resolver 未处理跳过情况、NIGHT_STEPS 顺序错误、DO 写入时 race condition

**D — API/Worker 错误：**

| 首查路径                              | 排查重点                  |
| ------------------------------------- | ------------------------- |
| `packages/api-worker/src/routes/`     | Zod schema 校验、参数传递 |
| `packages/api-worker/src/middleware/` | auth 中间件、rate limit   |
| `packages/api-worker/src/do/`         | DO stub 调用、SQLite 查询 |
| `packages/api-worker/src/d1/`         | D1 migration 兼容性       |

常见根因：Zod schema 不匹配请求体、DO id 构造错误、D1 migration 缺列

**E — E2E 测试失败：**

| 首查路径                      | 排查重点                            |
| ----------------------------- | ----------------------------------- |
| `e2e/specs/<failing-spec>.ts` | selector 变更、wait 逻辑            |
| `e2e/helpers/night-driver.ts` | role action helpers 是否匹配当前 UI |
| `e2e/helpers/waits.ts`        | 等待条件是否充分                    |
| `e2e/helpers/diagnostics.ts`  | DiagnosticData 是否捕获有用信息     |

常见根因：testid 变更未同步、WebSocket 连接未就绪就操作、timeout 不足

**F — 性能问题：**

| 首查路径           | 排查重点                          |
| ------------------ | --------------------------------- |
| `src/screens/`     | 大列表未虚拟化、不必要 re-render  |
| `src/services/`    | 频繁 setState、未 debounce 的操作 |
| `src/hooks/`       | useMemo/useCallback 依赖项过宽    |
| Worker network tab | 请求瀑布、payload 过大            |

常见根因：selector 每次返回新对象、未用 memo 的列表项、音频预加载阻塞

---

### Phase 3 — 动态诊断（静态无法确定根因时）

**仅在 Phase 2 无法定位根因时才进入此阶段。**

#### 3a. 添加 `[DIAG]` 诊断日志

```typescript
// 用项目 logger，禁止 console.*
import { log } from '@/utils/logger';
const diagLog = log.extend('DIAG');

// 在关键路径添加诊断
diagLog.info('[DIAG] snapshot applied', { phase, playerCount: state.players.length });
```

规则：

- 前缀 `[DIAG]` 确保 E2E diagnostics.ts 会转发到 Playwright 输出
- 使用 `log.extend('DIAG')` 或现有模块 logger
- 记录关键变量值、分支走向、时序信息
- **修复后必须清除所有 `[DIAG]` 日志**

#### 3b. 运行相关测试

```bash
# 单元测试（指定文件）
node node_modules/.bin/jest --no-coverage --forceExit --testPathPattern="<pattern>"

# E2E 测试（指定 spec）
pnpm exec playwright test e2e/specs/<spec> --reporter=list

# 类型检查
npx tsc --noEmit
```

#### 3c. 解读诊断输出

- Playwright trace：`test-results/` 目录自动保存
- Sentry：生产环境结构化日志（sentryTransport 已配置）
- Mobile debug panel：内存 500 条日志，on-screen 查看

---

### Phase 4 — 根因修复

**禁止 band-aid 修复。** 不得用条件判断、guard clause、`?.` 绕过结构性问题的症状。

#### 修复前必须：

1. 明确根因（一句话描述为什么出错）
2. 列出变更清单：

```
文件: <path>
变更: <具体改动>
风险: <可能影响的其他功能>
```

3. **等待用户确认后再编码**

#### 修复时必须：

- 每个受影响符号用 `grep_search` / `vscode_listCodeUsages` 验证所有消费者
- 改参数/schema 时双向追踪（调用方 ↔ 被调用方）
- 错误处理三层齐备：`log.error()` + `Sentry.captureException()` + `showAlert(中文提示)`
- 可预期错误（401/403/429、用户取消）只 `log.warn()` + UI 反馈，不报 Sentry

#### 禁止的修复模式：

| 禁止                            | 正确做法                         |
| ------------------------------- | -------------------------------- |
| `value?.prop` 绕过 required     | 追查为何 value 可能 undefined    |
| `as any` 消除类型错误           | 修正类型定义或调用方             |
| `try { } catch { }` 吞异常      | 分类处理：expected vs unexpected |
| `if (!x) return` guard 掩盖根因 | 修正 x 为何不存在                |
| `setTimeout` 等待竞态           | 用事件/状态机正确同步            |

---

### Phase 5 — 验证闭环

1. **清除所有 `[DIAG]` 日志** — `grep_search` 搜索 `[DIAG]` 确认零残留
2. **跑 quality 管道** — `pnpm run quality`（typecheck + knip + lint + format + test）
3. **相关 E2E spec 通过**（如有）— `pnpm exec playwright test e2e/specs/<spec> --reporter=list`
4. **确认无回归** — 受影响模块的测试全部通过

---

## 约束

- **静态分析首选。** 能 grep/read 定位的问题不加诊断日志。
- **禁止 `console.*`。** 诊断用 `log.extend('DIAG')` + `[DIAG]` 前缀。
- **修复后清理。** 不得遗留 `[DIAG]` 日志。
- **不改无关代码。** 调试过程中发现的"顺手可改"的问题单独提出，不混入本次修复。
- **Escalation。** 同一方案尝试 3 次仍失败 → 立即停止报告状态。
