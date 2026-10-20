/**
 * 接入报告 (integration report) builder: after a generation run the
 * operator gets one markdown file at the repository root listing what
 * the generator wrote, which shared files it edited, and the manual
 * steps that remain before the new game is a real game.
 */

export function buildIntegrationReport({
  gameId,
  preset,
  names,
  home,
  rewards,
  capabilities,
  createdFiles,
  editedFiles,
  migrationName,
  production,
}) {
  const capabilityRows = Object.entries(capabilities)
    .map(([key, value]) => `| \`${key}\` | ${value ? '开' : '关'} |`)
    .join('\n');
  const created = createdFiles.map((file) => `- \`${file}\``).join('\n');
  const edited = editedFiles.map((file) => `- \`${file}\``).join('\n');
  return `# ${home.displayName}（${gameId}）接入报告

> 由 \`pnpm new-game ${gameId} --preset ${preset}\` 生成。骨架已经接通底盘与注册，
> 但**还不是一个能玩的游戏**：所有 \`// TODO(gameplay):\` 标记处都是待填的玩法，
> 未填的玩法命令会显式抛「未实现」，不会假绿。

## 生成参数

| 项 | 值 |
| --- | --- |
| 游戏 ID | \`${gameId}\` |
| 原型预设 | ${preset === 'identity' ? '身份推理型（identity）' : '舞台回合型（stage）'} |
| 生产态 | ${production ? '是（--production）' : '否（默认非生产，上线动作见第 8 步）'} |
| 展示名 / 副标题 | ${home.displayName} / ${home.subtitle} |
| 首页图标 / 档位 | ${home.iconName} / ${home.tier} |
| 完成奖励（flat） | xpEarned ${rewards.xpEarned} · normalDrawsEarned ${rewards.normalDrawsEarned} · dailyCompletionTarget ${rewards.dailyCompletionTarget} |
| 类名派生 | ${names.pascal} / ${names.camel} / ${names.upper} |

## 能力开关声明（引擎 engine.ts，已与 contract 期望表对齐）

| 开关 | 声明 |
| --- | --- |
${capabilityRows}

开关只表示「接没接这块底盘能力」。生成后按玩法改声明时，必须同步改
\`capabilities.contract.test.ts\` 的期望行——contract 会逐项验声明与接线是否一致。

## 生成的文件

${created}

## 生成器改动的共享文件

${edited}

## 还差的人工步骤（按顺序）

1. **设计定稿**：把 \`docs/${gameId}-game-design.md\` 里的 10 项需求表填完并走批准流程
   （new-game skill Phase 1）；骨架里的默认人数、展示名、副标题、图标都是占位值。${
     preset === 'identity'
       ? `\n   身份型预设另需把 \`TODO_IDENTITY\` 占位身份换成真实身份表，并按仓库立绘流程生产
   角色立绘与图鉴素材（prompt 先审、生成过目后才入库）。`
       : ''
   }
2. **玩法填空**：全仓 grep \`TODO(gameplay)\`（限定 \`packages/game-engine/src/games/${gameId}\`、
   \`packages/api-worker/src/games/${gameId}\`、\`src/games/${gameId}\`），逐个填掉：
   身份/回合的玩法状态机在 \`domain/decision.ts\` 与 \`engine.ts\` 的 TODO 接缝处接入，
   视图投影在 \`domain/visibility.ts\` 补齐隐私裁剪。
3. **奖励数值确认**：注册表与参数表里的三数是占位值（见上表），按新游戏的档位改
   \`games/registry.ts\` 与 \`product/rewards/earnings.ts\` 两处（contract 会验两处一致）。
4. **审 migration**：\`packages/api-worker/migrations/${migrationName}\` 是从上一份注册
   migration 机械派生的骨架——应用前人工核对重建表集合与现行 schema 一致；
   游戏自有表按文件末尾的 TODO 补进同一份 migration。
5. **e2e 启用需用户批准**：\`e2e/specs/${gameId}.spec.ts.tmpl\` 是多真人多 context 的
   spec 骨架，默认不进 CI。启用时改名为 \`${gameId}.spec.ts\` 并把文件名加进
   \`.github/workflows/ci.yml\` 的 e2e 分片矩阵（ciE2eCoverage contract 会验全量一致）。
6. **词库（如需要）**：把引擎 \`wordLibrary\` 开关打开时，必须同时在注册表
   \`workerWorkflows\` 登记供词 workflow 导出（capabilities contract 会验两者一致），
   并按 new-game skill Phase 3d 建词表与灌种子词，不许空表上线。
7. **门禁复跑**：\`pnpm exec tsc --noEmit\`、引擎与 worker 的 vitest、根 jest、
   \`pnpm run knip\`、改动文件 prettier/eslint，全部绿了再开 PR。${
     production
       ? `
8. **上线（同步绊线名单）**：本次以 \`--production\` 生成，注册表已是
   \`isProduction: true\`，上线前只剩一步：把 \`'${gameId}'\` 按它在 \`GAME_TYPES\`
   中的顺序位置，加进 \`src/games/__tests__/homeProductionFilter.contract.test.ts\`
   的 \`PRODUCTION_GAME_TYPES\` 名单——这份硬编码名单是刻意保留的绊线，
   生产集合变更永远是显式动作。名单同步、contract 转绿即上线完成。`
       : `
8. **上线（翻生产）**：本次生成默认非生产（注册表 \`isProduction: false\`）——
   游戏已全注册、凭房间码可进，但首页/建房/guide/spotlight/公告等玩家面不可见。
   玩法完成、门禁全绿后，在同一个 PR 里做两处显式动作才算上线：
   ① \`packages/game-engine/src/games/registry.ts\` 本游戏条目改 \`isProduction: true\`；
   ② 把 \`'${gameId}'\` 按它在 \`GAME_TYPES\` 中的顺序位置，加进
   \`src/games/__tests__/homeProductionFilter.contract.test.ts\` 的
   \`PRODUCTION_GAME_TYPES\` 名单（硬编码名单是刻意保留的绊线）。
   两处只改其一会被 contract 拦住；两处齐、contract 转绿即上线完成。`
   }
`;
}
